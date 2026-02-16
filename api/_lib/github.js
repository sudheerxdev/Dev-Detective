import { buildAnalysisResult, preRankImportanceScore } from "./analysis.js";
import { mapWithConcurrency, withTimeout } from "./utils.js";

const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const MAX_REPO_PAGES = 3;
const MAX_DEEP_REPOS = 30;
const CONCURRENCY_LIMIT = 5;
const REQUEST_TIMEOUT_MS = Number(process.env.GITHUB_REQUEST_TIMEOUT_MS || 10_000);
const GITHUB_CACHE_TTL_MS = Number(process.env.GITHUB_CACHE_TTL_MS || 120_000);

const githubResponseCache = new Map();

export class GitHubError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = "GitHubError";
    this.type = type;
    this.details = details;
  }
}

export function parseProfileInput(rawInput) {
  const value = (rawInput || "").trim();

  if (!value) {
    return { ok: false, error: "Enter a GitHub username or profile URL." };
  }

  let candidate = value;

  if (/github\.com\//i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") {
        return { ok: false, error: "URL must be a valid github.com profile URL." };
      }

      const segments = url.pathname.split("/").filter(Boolean);
      if (!segments.length) {
        return { ok: false, error: "GitHub URL is missing a username." };
      }

      candidate = segments[0];
    } catch {
      return { ok: false, error: "Invalid URL format. Use a username or github.com profile URL." };
    }
  }

  candidate = candidate.replace(/^@+/, "").trim();
  if (candidate.endsWith(".git")) {
    candidate = candidate.slice(0, -4);
  }

  const isValid = /^[A-Za-z0-9-]{1,39}$/.test(candidate) && !candidate.startsWith("-") && !candidate.endsWith("-");

  if (!isValid) {
    return { ok: false, error: "Invalid GitHub username format." };
  }

  return { ok: true, username: candidate.toLowerCase() };
}

export async function runAnalysisPipeline(username, token, signal) {
  const profileResponse = await githubRequest(`/users/${encodeURIComponent(username)}`, { token, signal });
  const profile = profileResponse.data;

  const allRepos = await fetchAllRepositories(profile.login, token, signal);
  const scorableRepos = allRepos.filter((repo) => !repo.fork);

  const deepEnrichment = await enrichTopRepositories(profile.login, scorableRepos, token, signal);
  const deepMap = new Map(deepEnrichment.items.map((item) => [item.id, item]));

  const enrichedScorableRepos = scorableRepos.map((repo) => {
    const extra = deepMap.get(repo.id);
    return {
      ...repo,
      _languageBytes: extra ? extra.languageBytes : null,
      _languageChecked: extra ? extra.languageChecked : false,
      _hasReadme: extra ? extra.hasReadme : null,
      _readmeChecked: extra ? extra.readmeChecked : false
    };
  });

  const contributions = await fetchContributionSignals(profile.login, token, signal);
  const pinnedFromGraphql = token ? await fetchPinnedRepositories(profile.login, token, signal) : null;

  return buildAnalysisResult({
    profile,
    scorableRepos: enrichedScorableRepos,
    contributions,
    partial: deepEnrichment.partial,
    pinnedFromGraphql
  });
}

async function fetchAllRepositories(username, token, signal) {
  const repos = [];

  for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
    const path = `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=${page}`;
    const response = await githubRequest(path, { token, signal });
    const data = Array.isArray(response.data) ? response.data : [];

    repos.push(...data);

    if (data.length < 100) {
      break;
    }
  }

  return repos;
}

async function enrichTopRepositories(owner, scorableRepos, token, signal) {
  const candidates = [...scorableRepos]
    .sort((a, b) => preRankImportanceScore(b) - preRankImportanceScore(a))
    .slice(0, MAX_DEEP_REPOS);

  const partial = {
    deepRepoCount: candidates.length,
    languageChecked: 0,
    readmeChecked: 0,
    languageFailures: 0,
    readmeFailures: 0
  };

  const items = await mapWithConcurrency(candidates, CONCURRENCY_LIMIT, async (repo) => {
    return fetchRepoDeepMeta(owner, repo, token, signal, partial);
  });

  return { items, partial };
}

async function fetchRepoDeepMeta(owner, repo, token, signal, partial) {
  const details = {
    id: repo.id,
    languageBytes: null,
    languageChecked: false,
    hasReadme: null,
    readmeChecked: false
  };

  try {
    const languagesResponse = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/languages`,
      { token, signal }
    );
    details.languageBytes = languagesResponse.data && typeof languagesResponse.data === "object" ? languagesResponse.data : {};
    details.languageChecked = true;
    partial.languageChecked += 1;
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    partial.languageFailures += 1;
  }

  try {
    await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/readme`,
      { token, signal }
    );
    details.hasReadme = true;
    details.readmeChecked = true;
    partial.readmeChecked += 1;
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    if (error instanceof GitHubError && error.type === "NotFound") {
      details.hasReadme = false;
      details.readmeChecked = true;
      partial.readmeChecked += 1;
    } else {
      partial.readmeFailures += 1;
    }
  }

  return details;
}

async function fetchContributionSignals(username, token, signal) {
  const [prCount, issueCount] = await Promise.all([
    fetchSearchCountWithFallback(`author:${username} type:pr`, token, signal),
    fetchSearchCountWithFallback(`author:${username} type:issue`, token, signal)
  ]);

  return { prCount, issueCount };
}

async function fetchSearchCountWithFallback(query, token, signal) {
  try {
    return await fetchSearchCount(query, token, signal);
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    // GitHub Search can return 422 for valid-but-unsearchable users.
    // Do not fail the whole analysis when contribution counts are unavailable.
    return 0;
  }
}

async function fetchSearchCount(query, token, signal) {
  const path = `/search/issues?q=${encodeURIComponent(query)}&per_page=1`;
  const response = await githubRequest(path, { token, signal });
  return Number(response.data && response.data.total_count) || 0;
}

async function fetchPinnedRepositories(username, token, signal) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              url
              stargazerCount
            }
          }
        }
      }
    }
  `;

  try {
    const data = await githubGraphQL(query, { login: username }, token, signal);
    const nodes = data && data.user && data.user.pinnedItems ? data.user.pinnedItems.nodes : [];

    if (!Array.isArray(nodes)) {
      return null;
    }

    return nodes
      .filter((node) => node && node.name && node.url)
      .map((node) => ({
        name: node.name,
        url: node.url,
        stars: Number(node.stargazerCount) || 0
      }));
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

async function githubRequest(path, options = {}) {
  const {
    token = "",
    method = "GET",
    signal,
    retry = 1,
    body,
    accept = "application/vnd.github+json"
  } = options;

  const url = path.startsWith("http") ? path : `${GITHUB_API_ROOT}${path}`;
  const cacheKey = method === "GET" && !body ? url : null;

  if (cacheKey) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let attempt = 0;
  while (attempt <= retry) {
    attempt += 1;

    const timeout = withTimeout(signal, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        signal: timeout.signal,
        headers: {
          Accept: accept,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      const rateInfo = extractRateInfo(response.headers);
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errorPayload = null;
        try {
          errorPayload = contentType.includes("application/json")
            ? await response.json()
            : { message: await response.text() };
        } catch {
          errorPayload = { message: `GitHub API error (${response.status})` };
        }

        const message =
          (errorPayload && typeof errorPayload.message === "string" && errorPayload.message.trim()) ||
          `GitHub API error (${response.status})`;

        if (response.status === 404) {
          throw new GitHubError("NotFound", message, { status: response.status, rateInfo });
        }

        if (response.status === 401) {
          throw new GitHubError("Unauthorized", message, { status: response.status, rateInfo });
        }

        const rateLimited =
          response.status === 429 ||
          (response.status === 403 && (rateInfo.remaining === 0 || /rate limit/i.test(message)));

        if (rateLimited) {
          throw new GitHubError("RateLimited", message, {
            status: response.status,
            resetAt: rateInfo.resetAt,
            rateInfo
          });
        }

        throw new GitHubError("Api", message, { status: response.status, rateInfo });
      }

      if (response.status === 204) {
        const result = { data: null, headers: response.headers, rateInfo };
        if (cacheKey) {
          setToCache(cacheKey, result);
        }
        return result;
      }

      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      const result = { data, headers: response.headers, rateInfo };
      if (cacheKey) {
        setToCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }

      if (error instanceof GitHubError) {
        throw error;
      }

      if (attempt > retry) {
        throw new GitHubError("Network", "Failed to reach GitHub API.", { cause: error });
      }
    } finally {
      timeout.dispose();
    }
  }

  throw new GitHubError("Network", "Failed to reach GitHub API.");
}

async function githubGraphQL(query, variables, token, signal) {
  if (!token) {
    throw new GitHubError("Unauthorized", "GitHub token is required for GraphQL requests.");
  }

  const timeout = withTimeout(signal, REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new GitHubError("Network", "Failed to reach GitHub GraphQL API.", { cause: error });
  } finally {
    timeout.dispose();
  }

  const rateInfo = extractRateInfo(response.headers);
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitHubError("Unauthorized", "GitHub token is invalid for GraphQL API.", {
        status: response.status,
        rateInfo
      });
    }

    const message = (payload && payload.message) || `GitHub GraphQL error (${response.status})`;
    throw new GitHubError("Api", message, { status: response.status, rateInfo });
  }

  if (payload.errors && payload.errors.length) {
    throw new GitHubError("Api", payload.errors[0].message || "GraphQL query failed.", {
      errors: payload.errors,
      rateInfo
    });
  }

  return payload.data;
}

function extractRateInfo(headers) {
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const resetEpoch = Number(headers.get("x-ratelimit-reset"));

  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt: Number.isFinite(resetEpoch) && resetEpoch > 0 ? new Date(resetEpoch * 1000).toISOString() : null
  };
}

function getFromCache(key) {
  const item = githubResponseCache.get(key);
  if (!item) {
    return null;
  }

  if (Date.now() > item.expiresAt) {
    githubResponseCache.delete(key);
    return null;
  }

  return item.value;
}

function setToCache(key, value) {
  githubResponseCache.set(key, {
    value,
    expiresAt: Date.now() + GITHUB_CACHE_TTL_MS
  });

  if (githubResponseCache.size > 500) {
    const oldestKey = githubResponseCache.keys().next().value;
    if (oldestKey) {
      githubResponseCache.delete(oldestKey);
    }
  }
}
