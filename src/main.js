import {
  ANALYZE_ENDPOINT,
  CACHE_PREFIX,
  CACHE_TTL_MS,
  HISTORY_LIMIT,
  STORAGE_KEYS
} from "./config/constants.js";
import { getUiElements } from "./ui/elements.js";
import { renderInitialState, renderAnalysis, renderHistory } from "./ui/render.js";
import { renderCharts } from "./ui/charts.js";
import { buildMarkdownReport } from "./report/markdown.js";
import { readJsonStorage } from "./utils/core.js";

const ui = getUiElements();

const state = {
  currentUsername: "",
  analysisResult: null,
  abortController: null,
  charts: {
    language: null,
    importance: null,
    subscoreRadar: null,
    activity: null
  },
  history: readJsonStorage(STORAGE_KEYS.history, [])
};

class ApiError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.details = details;
  }
}

init();

function init() {
  bindEvents();

  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  applyTheme(savedTheme);

  renderInitialState(ui);
  renderHistory(state.history, ui, handleHistorySelect);

  if (state.history[0]) {
    ui.profileInput.value = state.history[0];
  } else {
    ui.profileInput.value = "sudheerxdev";
  }
}

function bindEvents() {
  ui.analyzeBtn.addEventListener("click", handleAnalyze);

  ui.profileInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleAnalyze();
    }
  });

  ui.themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    if (state.analysisResult) {
      renderCharts(state.analysisResult, state, ui);
    }
  });

  ui.downloadReportBtn.addEventListener("click", downloadMarkdownReport);
}

async function handleAnalyze() {
  clearBanners();

  const parsed = parseProfileInput(ui.profileInput.value);
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }

  const username = parsed.username;
  state.currentUsername = username;
  ui.profileInput.value = username;

  if (state.abortController) {
    state.abortController.abort();
  }

  const controller = new AbortController();
  state.abortController = controller;

  setLoading(true, "Preparing analysis...");

  try {
    let analysis = getCachedAnalysis(username);

    if (analysis) {
      setLoading(true, "Loaded cached analysis from the last 10 minutes...");
    } else {
      setLoading(true, "Analyzing GitHub profile via secure API...");
      analysis = await fetchAnalysisFromApi(username, controller.signal);
      setCachedAnalysis(username, analysis);
    }

    if (controller.signal.aborted) {
      return;
    }

    state.analysisResult = analysis;
    ui.downloadReportBtn.disabled = false;

    saveHistory(username);
    renderHistory(state.history, ui, handleHistorySelect);

    renderAnalysis(analysis, ui);
    renderCharts(analysis, state, ui);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    handleAnalysisError(error);
  } finally {
    if (state.abortController === controller) {
      state.abortController = null;
    }
    setLoading(false);
  }
}

async function fetchAnalysisFromApi(username, signal) {
  const url = `${ANALYZE_ENDPOINT}?username=${encodeURIComponent(username)}`;

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json"
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new ApiError("Network", "Failed to reach analysis API.", { cause: error });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const type = payload && payload.error && payload.error.type ? payload.error.type : mapStatusToType(response.status);
    const message =
      payload && payload.error && payload.error.message
        ? payload.error.message
        : `Analysis API failed with status ${response.status}.`;

    throw new ApiError(type, message, {
      status: response.status,
      resetAt: payload && payload.error ? payload.error.resetAt : response.headers.get("x-ratelimit-reset-at")
    });
  }

  return payload.data;
}

function mapStatusToType(status) {
  if (status === 404) {
    return "NotFound";
  }
  if (status === 429) {
    return "RateLimited";
  }
  if (status === 400) {
    return "Validation";
  }
  if (status === 401 || status === 403) {
    return "Unauthorized";
  }
  return "Api";
}

function handleHistorySelect(username) {
  ui.profileInput.value = username;
  handleAnalyze();
}

function handleAnalysisError(error) {
  if (!(error instanceof ApiError)) {
    showError("Unexpected error while analyzing the profile.");
    return;
  }

  if (error.type === "NotFound") {
    showError("Profile not found. Enter a valid GitHub username or GitHub profile URL.");
    return;
  }

  if (error.type === "RateLimited") {
    showError("Rate limit reached. Please retry in a minute.");
    showRateLimit(error.details.resetAt || null);
    return;
  }

  if (error.type === "Validation") {
    showError(error.message || "Invalid username or URL input.");
    return;
  }

  if (error.type === "Unauthorized") {
    showError("Server GitHub token is missing or invalid. Configure deployment environment variables.");
    return;
  }

  if (error.type === "Network") {
    showError("Network issue while contacting analysis API. Please retry.");
    return;
  }

  showError(error.message || "Analysis request failed.");
}

function downloadMarkdownReport() {
  if (!state.analysisResult) {
    showError("Run an analysis before downloading a report.");
    return;
  }

  const markdown = buildMarkdownReport(state.analysisResult);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.analysisResult.profile.login}-portfolio-report.md`;
  anchor.click();

  URL.revokeObjectURL(url);
}

function saveHistory(username) {
  const clean = (username || "").trim().toLowerCase();
  if (!clean) {
    return;
  }

  state.history = [clean, ...state.history.filter((item) => item !== clean)].slice(0, HISTORY_LIMIT);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function setLoading(isLoading, message = "") {
  ui.analyzeBtn.disabled = isLoading;

  if (isLoading) {
    ui.loadingState.classList.remove("hidden");
    ui.loadingText.textContent = message || "Analyzing profile...";
  } else {
    ui.loadingState.classList.add("hidden");
    ui.loadingText.textContent = "Analyzing profile...";
  }
}

function clearBanners() {
  ui.errorBanner.classList.add("hidden");
  ui.errorBanner.textContent = "";

  ui.rateLimitBanner.classList.add("hidden");
  ui.rateLimitBanner.textContent = "";
}

function showError(message) {
  ui.errorBanner.textContent = message;
  ui.errorBanner.classList.remove("hidden");
}

function showRateLimit(resetAt) {
  const when = resetAt ? new Date(resetAt).toLocaleString() : "the API reset window";
  ui.rateLimitBanner.textContent = `Rate limited. Retry after ${when}.`;
  ui.rateLimitBanner.classList.remove("hidden");
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", normalized);
  localStorage.setItem(STORAGE_KEYS.theme, normalized);
  ui.themeToggleBtn.textContent = normalized === "dark" ? "Switch to Light" : "Switch to Dark";
}

function getCachedAnalysis(username) {
  const key = `${CACHE_PREFIX}${username.toLowerCase()}`;
  const payload = readJsonStorage(key, null);

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const isFresh = Number(payload.savedAt) && Date.now() - Number(payload.savedAt) <= CACHE_TTL_MS;

  const hasExpectedShape =
    payload.analysis &&
    typeof payload.analysis === "object" &&
    typeof payload.analysis.overallScore === "number" &&
    typeof payload.analysis.hireabilityScore === "number" &&
    payload.analysis.readiness &&
    payload.analysis.recruiterSimulation &&
    Array.isArray(payload.analysis.improvementRoadmap);

  if (!isFresh || !hasExpectedShape) {
    localStorage.removeItem(key);
    return null;
  }

  return payload.analysis;
}

function setCachedAnalysis(username, analysis) {
  const key = `${CACHE_PREFIX}${username.toLowerCase()}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      savedAt: Date.now(),
      analysis
    })
  );
}

function parseProfileInput(rawInput) {
  const value = (rawInput || "").trim();

  if (!value) {
    return { ok: false, error: "Enter a GitHub username or profile URL to analyze." };
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
      return { ok: false, error: "Invalid URL format. Use a username or a github.com profile URL." };
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
