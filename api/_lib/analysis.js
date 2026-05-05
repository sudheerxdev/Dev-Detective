import { WEIGHTS } from "../../src/config/constants.js";
import {
  cap01,
  clampToRange,
  safeRatio,
  scoreFromRatio,
  daysSinceDate,
  joinRepoNames,
  formatPercent,
  dedupe
} from "../../src/utils/core.js";

export function getNamedSubscore(key) {
  const labels = {
    documentationQuality: "Documentation Quality",
    codeActivityConsistency: "Code Activity / Consistency",
    projectPopularity: "Project Popularity",
    repositoryCompleteness: "Repository Completeness",
    languageDiversity: "Language Diversity",
    recentActivity: "Recent Activity",
    impactSignals: "Impact Signals"
  };

  return labels[key] || key;
}

export function preRankImportanceScore(repo) {
  const days = daysSinceDate(repo.pushed_at);
  const freshness = days <= 30 ? 10 : days <= 90 ? 6 : days <= 180 ? 3 : 0;

  return (
    (Number(repo.stargazers_count) || 0) * 3 +
    (Number(repo.forks_count) || 0) * 2 +
    (Number(repo.watchers_count) || 0) +
    freshness
  );
}

export function buildAnalysisResult({ profile, scorableRepos, contributions, partial, pinnedFromGraphql }) {
  const now = Date.now();
  const scorableCount = scorableRepos.length;

  const totalStars = scorableRepos.reduce((sum, repo) => sum + (Number(repo.stargazers_count) || 0), 0);
  const totalForks = scorableRepos.reduce((sum, repo) => sum + (Number(repo.forks_count) || 0), 0);
  const totalWatchers = scorableRepos.reduce((sum, repo) => sum + (Number(repo.watchers_count) || 0), 0);

  const descriptionCoverage = safeRatio(
    scorableRepos.filter((repo) => Boolean((repo.description || "").trim())).length,
    scorableCount
  );

  const readmeScannedRepos = scorableRepos.filter((repo) => repo._readmeChecked);
  const readmeCoverage = safeRatio(
    readmeScannedRepos.filter((repo) => repo._hasReadme === true).length,
    readmeScannedRepos.length
  );

  const nonEmptyRepoRatio = safeRatio(
    scorableRepos.filter((repo) => (Number(repo.size) || 0) > 0).length,
    scorableCount
  );

  const homepageRatio = safeRatio(
    scorableRepos.filter((repo) => Boolean((repo.homepage || "").trim())).length,
    scorableCount
  );

  const topicsRatio = safeRatio(
    scorableRepos.filter((repo) => Array.isArray(repo.topics) && repo.topics.length > 0).length,
    scorableCount
  );

  const pushedDays = scorableRepos
    .map((repo) => daysSinceDate(repo.pushed_at, now))
    .filter((days) => Number.isFinite(days));

  const reposUpdated30d = pushedDays.filter((days) => days <= 30).length;
  const reposUpdated90d = pushedDays.filter((days) => days <= 90).length;
  const reposInactive180d = pushedDays.filter((days) => days > 180).length;

  const activityBuckets = {
    updated30d: pushedDays.filter((days) => days <= 30).length,
    updated31to90d: pushedDays.filter((days) => days > 30 && days <= 90).length,
    updated91to180d: pushedDays.filter((days) => days > 90 && days <= 180).length,
    updated181plus: pushedDays.filter((days) => days > 180).length
  };

  const lastPushRepo = [...scorableRepos]
    .filter((repo) => repo.pushed_at)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())[0] || null;

  const daysSinceLastPush = lastPushRepo ? daysSinceDate(lastPushRepo.pushed_at, now) : 9999;

  const activity = computeActivityInLastSixMonths(scorableRepos);
  const activeMonthsLast6Ratio = activity.ratio;

  const starsPerRepo = scorableCount ? totalStars / scorableCount : 0;
  const forksPerRepo = scorableCount ? totalForks / scorableCount : 0;
  const watchersPerRepo = scorableCount ? totalWatchers / scorableCount : 0;

  const languageTotals = aggregateLanguageTotals(scorableRepos);
  const languageEntries = Object.entries(languageTotals).sort((a, b) => b[1] - a[1]);
  const uniqueLanguages = languageEntries.length;
  const normalizedShannonEntropy = computeNormalizedEntropy(languageTotals);
  const totalLanguageBytes = languageEntries.reduce((sum, [, bytes]) => sum + (Number(bytes) || 0), 0);
  const dominantLanguage = languageEntries[0] ? languageEntries[0][0] : "Unknown";
  const dominantLanguageShare =
    totalLanguageBytes > 0 && languageEntries[0] ? cap01((Number(languageEntries[0][1]) || 0) / totalLanguageBytes) : 0;
  const topLanguages = languageEntries.slice(0, 5).map(([language]) => language);

  const topRepoByStars = [...scorableRepos].sort(
    (a, b) => (Number(b.stargazers_count) || 0) - (Number(a.stargazers_count) || 0)
  )[0] || null;

  const topRepoStars = topRepoByStars ? Number(topRepoByStars.stargazers_count) || 0 : 0;

  const reposUpdated90dRatio = safeRatio(reposUpdated90d, scorableCount);
  const reposUpdated30dRatio = safeRatio(reposUpdated30d, scorableCount);
  const recencyBucket = getRecencyBucket(daysSinceLastPush);

  const subscores = {
    documentationQuality: scoreFromRatio(0.75 * readmeCoverage + 0.25 * descriptionCoverage),
    codeActivityConsistency: scoreFromRatio(0.6 * activeMonthsLast6Ratio + 0.4 * reposUpdated90dRatio),
    projectPopularity: scoreFromRatio(
      0.6 * cap01(starsPerRepo / 50) +
      0.25 * cap01(forksPerRepo / 20) +
      0.15 * cap01(watchersPerRepo / 20)
    ),
    repositoryCompleteness: scoreFromRatio(
      0.5 * nonEmptyRepoRatio +
      0.3 * homepageRatio +
      0.2 * topicsRatio
    ),
    languageDiversity: scoreFromRatio(
      0.7 * cap01(uniqueLanguages / 8) +
      0.3 * normalizedShannonEntropy
    ),
    recentActivity: scoreFromRatio(0.7 * recencyBucket + 0.3 * reposUpdated30dRatio),
    impactSignals: scoreFromRatio(
      0.35 * cap01(topRepoStars / 300) +
      0.25 * cap01((Number(profile.followers) || 0) / 500) +
      0.25 * cap01(contributions.prCount / 200) +
      0.15 * cap01(contributions.issueCount / 100)
    )
  };

  const overallScore = clampToRange(
    Math.round(
      (subscores.documentationQuality * WEIGHTS.documentationQuality +
        subscores.codeActivityConsistency * WEIGHTS.codeActivityConsistency +
        subscores.projectPopularity * WEIGHTS.projectPopularity +
        subscores.repositoryCompleteness * WEIGHTS.repositoryCompleteness +
        subscores.languageDiversity * WEIGHTS.languageDiversity +
        subscores.recentActivity * WEIGHTS.recentActivity +
        subscores.impactSignals * WEIGHTS.impactSignals) / 100
    ),
    0,
    100
  );

  const rankedRepos = buildRankedRepositories(scorableRepos);

  const pinnedRepos = pinnedFromGraphql && pinnedFromGraphql.length
    ? {
      source: "graphql",
      items: pinnedFromGraphql
    }
    : {
      source: "fallback",
      items: rankedRepos.slice(0, 6).map((repo) => ({
        name: repo.name,
        url: repo.url,
        stars: repo.stars
      }))
    };

  const metrics = {
    scorableRepoCount: scorableCount,
    totalStars,
    totalForks,
    totalWatchers,
    readmeCoverage,
    reposUpdated30d,
    reposUpdated90d,
    daysSinceLastPush,
    authoredPRCount: contributions.prCount,
    authoredIssueCount: contributions.issueCount,
    authoredReviewCount: contributions.reviewCount,
    uniqueLanguages,
    topLanguages,
    dominantLanguage,
    dominantLanguageShare,

    descriptionCoverage,
    descriptionlessRatio: cap01(1 - descriptionCoverage),
    activeMonthsLast6: activity.activeMonths,
    activeMonthsLast6Ratio,
    reposInactive180d,
    reposInactive180dRatio: safeRatio(reposInactive180d, scorableCount),
    emptyRepoRatio: cap01(1 - nonEmptyRepoRatio),
    nonEmptyRepoRatio,
    homepageRatio,
    topicsRatio,
    starsPerRepo,
    forksPerRepo,
    watchersPerRepo,
    reposUpdated30dRatio,
    reposUpdated90dRatio,
    recencyBucket,
    topRepoStars,
    normalizedShannonEntropy,
    readmeSampleSize: readmeScannedRepos.length,
    lastPushDate: lastPushRepo ? lastPushRepo.pushed_at : null,
    partialReadmeFailures: partial.readmeFailures,
    partialLanguageFailures: partial.languageFailures,
    deepRepoCount: partial.deepRepoCount,
    activityBuckets
  };

  const strengths = buildStrengths(subscores, metrics, rankedRepos);
  const redFlags = buildRedFlags(subscores, metrics);
  const suggestions = buildSuggestions(subscores, metrics, rankedRepos, pinnedRepos);
  const hiddenRisks = buildHiddenRisks(subscores, metrics, rankedRepos);
  const hireabilityScore = calculateHireabilityScore(subscores, overallScore, hiddenRisks);
  const readiness = classifyReadiness(hireabilityScore, overallScore);
  const careerPath = buildCareerPathRecommendation(metrics, rankedRepos, subscores);
  const improvementRoadmap = buildImprovementRoadmap(subscores, metrics, rankedRepos, careerPath, hiddenRisks);
  const recruiterSimulation = buildRecruiterSimulation({
    overallScore,
    hireabilityScore,
    readiness,
    subscores,
    metrics,
    strengths,
    redFlags,
    hiddenRisks,
    rankedRepos
  });

  const grade = scoreToGrade(overallScore);
  const scoreSummary = buildScoreSummary(overallScore, grade, subscores, metrics, hireabilityScore, readiness.label);

  return {
    profile: {
      login: profile.login,
      name: profile.name || profile.login,
      htmlUrl: profile.html_url,
      followers: Number(profile.followers) || 0,
      following: Number(profile.following) || 0,
      publicRepos: Number(profile.public_repos) || 0,
      avatarUrl: profile.avatar_url,
      bio: profile.bio || "No bio provided.",
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    },
    generatedAt: new Date().toISOString(),
    weights: WEIGHTS,
    subscores,
    overallScore,
    hireabilityScore,
    readiness,
    readinessLevel: readiness.label,
    metrics,
    strengths,
    redFlags,
    suggestions,
    hiddenRisks,
    recruiterSimulation,
    careerPath,
    improvementRoadmap,
    pinnedRepos,
    rankedRepos: rankedRepos.map((repo) => ({
      name: repo.name,
      url: repo.url,
      importance: repo.importance,
      stars: repo.stars,
      forks: repo.forks,
      watchers: repo.watchers,
      pushedAt: repo.pushedAt,
      hasReadme: repo.hasReadme,
      language: repo.language,
      homepage: repo.homepage,
      topicsCount: repo.topicsCount,
      hasDescription: repo.hasDescription,
      isEmpty: repo.isEmpty,
      readmeKnown: repo.readmeKnown
    })),
    languageTotals,
    grade,
    scoreSummary
  };
}

function aggregateLanguageTotals(repos) {
  const totals = {};

  repos.forEach((repo) => {
    let hasDetailedBreakdown = false;

    if (repo._languageBytes && typeof repo._languageBytes === "object") {
      const entries = Object.entries(repo._languageBytes);
      if (entries.length) {
        entries.forEach(([language, bytes]) => {
          totals[language] = (totals[language] || 0) + (Number(bytes) || 0);
        });
        hasDetailedBreakdown = true;
      }
    }

    if (!hasDetailedBreakdown && repo.language) {
      totals[repo.language] = (totals[repo.language] || 0) + 1000;
    }
  });

  return totals;
}

function computeNormalizedEntropy(totals) {
  const values = Object.values(totals).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0 || values.length <= 1) {
    return 0;
  }

  const entropy = values.reduce((sum, value) => {
    const p = value / total;
    return sum - p * Math.log2(p);
  }, 0);

  const maxEntropy = Math.log2(values.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

function buildRankedRepositories(repos) {
  if (!repos.length) {
    return [];
  }

  const ranked = repos.map((repo) => {
    const ageDays = daysSinceDate(repo.pushed_at);

    const recencyBoost = ageDays <= 30 ? 15 : ageDays <= 90 ? 8 : ageDays <= 180 ? 4 : 0;
    const readmeBoost = repo._hasReadme === true ? 8 : 0;
    const homepageBoost = (repo.homepage || "").trim() ? 4 : 0;
    const topicsBoost = Array.isArray(repo.topics) && repo.topics.length > 0 ? 3 : 0;
    const descriptionBoost = (repo.description || "").trim() ? 3 : 0;
    const sizeBoost = (Number(repo.size) || 0) > 0 ? 2 : 0;

    const rawImportance =
      (Number(repo.stargazers_count) || 0) * 4 +
      (Number(repo.forks_count) || 0) * 3 +
      (Number(repo.watchers_count) || 0) * 2 +
      recencyBoost +
      readmeBoost +
      homepageBoost +
      topicsBoost +
      descriptionBoost +
      sizeBoost;

    return {
      name: repo.name,
      url: repo.html_url,
      rawImportance,
      stars: Number(repo.stargazers_count) || 0,
      forks: Number(repo.forks_count) || 0,
      watchers: Number(repo.watchers_count) || 0,
      pushedAt: repo.pushed_at,
      hasReadme: repo._hasReadme === true,
      readmeKnown: Boolean(repo._readmeChecked),
      language: repo.language || "Unknown",
      homepage: (repo.homepage || "").trim(),
      topicsCount: Array.isArray(repo.topics) ? repo.topics.length : 0,
      hasDescription: Boolean((repo.description || "").trim()),
      isEmpty: (Number(repo.size) || 0) === 0
    };
  });

  const maxRaw = Math.max(...ranked.map((repo) => repo.rawImportance), 1);

  ranked.forEach((repo) => {
    repo.importance = clampToRange(Math.round((repo.rawImportance / maxRaw) * 100), 0, 100);
  });

  return ranked.sort((a, b) => b.importance - a.importance || b.stars - a.stars);
}

function buildStrengths(subscores, metrics, rankedRepos) {
  const strengths = [];

  if (subscores.codeActivityConsistency >= 70) {
    strengths.push(
      `Strong activity consistency with ${metrics.activeMonthsLast6}/6 active months and ${metrics.reposUpdated90d} repositories updated in the last 90 days.`
    );
  }

  if (subscores.projectPopularity >= 70) {
    const top = rankedRepos[0];
    strengths.push(
      `Good popularity signals: ${metrics.totalStars} total stars and ${top ? `${top.name} as a leading project` : "multiple visible projects"}.`
    );
  }

  if (subscores.languageDiversity >= 70) {
    strengths.push(`Diverse technical stack with ${metrics.uniqueLanguages} detected languages.`);
  }

  if (subscores.recentActivity >= 70) {
    strengths.push(`Recent contribution momentum: latest push was ${metrics.daysSinceLastPush} day(s) ago.`);
  }

  if (subscores.documentationQuality >= 70) {
    strengths.push(
      `Documentation quality is strong with ${(metrics.readmeCoverage * 100).toFixed(0)}% README coverage in sampled repositories.`
    );
  }

  if (subscores.impactSignals >= 70) {
    strengths.push(
      `Impact signals are healthy with ${metrics.authoredPRCount} authored PRs and ${metrics.authoredIssueCount} authored issues.`
    );
  }

  if (!strengths.length) {
    strengths.push(
      `Public portfolio is visible (${metrics.scorableRepoCount} non-fork repositories) but still needs stronger recruiter-facing signals.`
    );
  }

  return strengths.slice(0, 6);
}

function buildRedFlags(subscores, metrics) {
  const redFlags = [];

  if (metrics.readmeCoverage < 0.5) {
    redFlags.push(
      `Low README coverage (${(metrics.readmeCoverage * 100).toFixed(0)}%) in sampled repositories makes project intent harder to evaluate.`
    );
  }

  if (metrics.reposInactive180dRatio > 0.5) {
    redFlags.push(
      `${metrics.reposInactive180d} of ${metrics.scorableRepoCount} repositories have been inactive for more than 180 days.`
    );
  }

  if (metrics.emptyRepoRatio > 0.3) {
    redFlags.push(
      `${(metrics.emptyRepoRatio * 100).toFixed(0)}% of repositories look empty or near-empty based on repository size.`
    );
  }

  if (metrics.descriptionlessRatio > 0.4) {
    redFlags.push(
      `${(metrics.descriptionlessRatio * 100).toFixed(0)}% of repositories have missing descriptions, which weakens recruiter readability.`
    );
  }

  if (metrics.daysSinceLastPush > 90) {
    redFlags.push(`No recent pushes in the last 90 days (latest push was ${metrics.daysSinceLastPush} day(s) ago).`);
  }

  if (subscores.impactSignals < 40) {
    redFlags.push(
      `Impact signals are weak (${subscores.impactSignals}/100) due to low follower, PR, issue, or top-repo traction.`
    );
  }

  if (!redFlags.length) {
    redFlags.push("No major red flags detected from the available public signals.");
  }

  return redFlags.slice(0, 6);
}

function buildSuggestions(subscores, metrics, rankedRepos, pinnedRepos) {
  const suggestions = [];

  const missingReadmeRepos = rankedRepos
    .filter((repo) => repo.readmeKnown && !repo.hasReadme)
    .slice(0, 3)
    .map((repo) => repo.name);

  const staleRepos = rankedRepos
    .filter((repo) => daysSinceDate(repo.pushedAt) > 180)
    .slice(0, 3)
    .map((repo) => repo.name);

  const noHomepageRepos = rankedRepos
    .filter((repo) => !repo.homepage)
    .slice(0, 3)
    .map((repo) => repo.name);

  const emptyRepos = rankedRepos
    .filter((repo) => repo.isEmpty)
    .slice(0, 3)
    .map((repo) => repo.name);

  const missingDescriptionRepos = rankedRepos
    .filter((repo) => !repo.hasDescription)
    .slice(0, 3)
    .map((repo) => repo.name);

  if (missingReadmeRepos.length) {
    suggestions.push({
      priority: 120 - subscores.documentationQuality,
      text: `Add README files to ${joinRepoNames(missingReadmeRepos)} with problem statement, setup, usage, and outcomes.`
    });
  }

  if (staleRepos.length) {
    suggestions.push({
      priority: 120 - subscores.recentActivity,
      text: `Update or archive stale repositories (${joinRepoNames(staleRepos)}) so recruiters see a maintained portfolio.`
    });
  }

  if (noHomepageRepos.length) {
    suggestions.push({
      priority: 110 - subscores.repositoryCompleteness,
      text: `Add live demo or homepage links for ${joinRepoNames(noHomepageRepos)} to improve project completeness.`
    });
  }

  if (emptyRepos.length) {
    suggestions.push({
      priority: 108 - subscores.repositoryCompleteness,
      text: `Complete or archive near-empty repositories (${joinRepoNames(emptyRepos)}) to reduce noise in your public profile.`
    });
  }

  if (missingDescriptionRepos.length || metrics.descriptionlessRatio > 0.4) {
    const target = missingDescriptionRepos.length ? joinRepoNames(missingDescriptionRepos) : "your weakest repos";
    suggestions.push({
      priority: 109 - subscores.documentationQuality,
      text: `Improve project descriptions for ${target} with concise problem, stack, and outcomes so recruiters can scan faster.`
    });
  }

  if (subscores.codeActivityConsistency < 70) {
    suggestions.push({
      priority: 105 - subscores.codeActivityConsistency,
      text: "Improve commit consistency: target at least 1 meaningful commit per week for 8 weeks and aim for 4/6 active months."
    });
  }

  if (subscores.impactSignals < 70) {
    suggestions.push({
      priority: 105 - subscores.impactSignals,
      text: "Increase impact signals by targeting 2 authored PRs and 2 authored issues per month on relevant repositories."
    });
  }

  if (pinnedRepos.source === "fallback") {
    const suggestedPins = rankedRepos.slice(0, 3).map((repo) => repo.name);
    suggestions.push({
      priority: 102,
      text: `Pin your strongest repositories (${joinRepoNames(suggestedPins)}) so recruiters immediately see your best work.`
    });
  }

  if (metrics.topicsRatio < 0.5) {
    suggestions.push({
      priority: 95,
      text: "Add GitHub topics/tags to your key repositories to improve discovery and communicate stack relevance quickly."
    });
  }

  if (metrics.uniqueLanguages < 3) {
    suggestions.push({
      priority: 88,
      text: "Showcase at least one additional production-quality project in a different language or framework to broaden stack signals."
    });
  }

  const sorted = suggestions
    .sort((a, b) => b.priority - a.priority)
    .map((entry) => entry.text)
    .filter((text, index, arr) => arr.indexOf(text) === index);

  const defaults = [
    `Raise README coverage from ${(metrics.readmeCoverage * 100).toFixed(0)}% to at least 80% in your top repositories.`,
    "Set a monthly maintenance pass to close stale issues and refresh pinned projects with recent commits.",
    "Improve repository completeness by ensuring every flagship repo has README, topics, and a demo/homepage link.",
    "Create a monthly portfolio changelog in one pinned repository to highlight recent improvements and impact.",
    "Publish measurable project outcomes (users, performance, business value) in your top README files."
  ];

  while (sorted.length < 5 && defaults.length) {
    sorted.push(defaults.shift());
  }

  return sorted.slice(0, 7);
}

function buildHiddenRisks(subscores, metrics, rankedRepos) {
  const risks = [];

  if (metrics.dominantLanguageShare > 0.78 && metrics.uniqueLanguages >= 2) {
    risks.push(
      `Stack concentration risk: ${metrics.dominantLanguage} accounts for ${formatPercent(metrics.dominantLanguageShare)} of detected language volume.`
    );
  }

  const topWithoutHomepage = rankedRepos
    .slice(0, 5)
    .filter((repo) => !repo.homepage)
    .map((repo) => repo.name);

  if (topWithoutHomepage.length >= 3) {
    risks.push(
      `Conversion risk: ${topWithoutHomepage.length} of your top repositories lack demo/homepage links (${joinRepoNames(topWithoutHomepage.slice(0, 3))}).`
    );
  }

  const starConcentration = metrics.totalStars > 0 ? metrics.topRepoStars / metrics.totalStars : 0;
  if (starConcentration > 0.85 && metrics.totalStars >= 20 && rankedRepos.length >= 4) {
    risks.push(
      `Brand concentration risk: one repository drives ${formatPercent(starConcentration)} of total stars, so portfolio impact is overly dependent on a single project.`
    );
  }

  if (metrics.authoredPRCount < 5 && metrics.scorableRepoCount >= 10) {
    risks.push(
      `Collaboration signal risk: only ${metrics.authoredPRCount} authored PRs across a portfolio of ${metrics.scorableRepoCount} repositories.`
    );
  }

  if (metrics.reposUpdated90dRatio > 0.45 && metrics.reposUpdated30dRatio < 0.15) {
    risks.push(
      "Momentum decay risk: older recent activity exists, but updates in the last 30 days are sparse."
    );
  }

  if (subscores.repositoryCompleteness < 50 && metrics.topicsRatio < 0.35) {
    risks.push(
      "Discoverability risk: weak metadata coverage (topics and project links) can reduce recruiter confidence during quick profile scans."
    );
  }

  if (!risks.length) {
    risks.push("No hidden structural risks detected beyond the visible red flags.");
  }

  return risks.slice(0, 6);
}

function calculateHireabilityScore(subscores, overallScore, hiddenRisks) {
  const riskCount = hiddenRisks.filter((item) => !/^No hidden/i.test(item)).length;
  const penalty = Math.min(riskCount * 4, 16);

  const raw =
    overallScore * 0.45 +
    subscores.impactSignals * 0.2 +
    subscores.recentActivity * 0.15 +
    subscores.documentationQuality * 0.1 +
    subscores.repositoryCompleteness * 0.1;

  return clampToRange(Math.round(raw - penalty), 0, 100);
}

function classifyReadiness(hireabilityScore, overallScore) {
  const blended = clampToRange(Math.round((hireabilityScore + overallScore) / 2), 0, 100);

  if (blended >= 85) {
    return {
      label: "Recruiter-Ready",
      severity: "good",
      percent: blended,
      summary: "Portfolio can usually pass recruiter screens without major concerns."
    };
  }

  if (blended >= 70) {
    return {
      label: "Interview-Ready",
      severity: "good",
      percent: blended,
      summary: "Strong enough for interview pipelines with minor polish opportunities."
    };
  }

  if (blended >= 55) {
    return {
      label: "Emerging",
      severity: "warn",
      percent: blended,
      summary: "Promising portfolio that needs stronger consistency and presentation signals."
    };
  }

  return {
    label: "Foundation Stage",
    severity: "risk",
    percent: blended,
    summary: "Core work is visible, but recruiter confidence is currently limited."
  };
}

function buildRecruiterSimulation({
  overallScore,
  hireabilityScore,
  readiness,
  subscores,
  metrics,
  strengths,
  redFlags,
  hiddenRisks,
  rankedRepos
}) {
  let verdict = "Not Ready for Interview Loop";
  let level = "risk";

  if (hireabilityScore >= 82) {
    verdict = "Strong Consider";
    level = "good";
  } else if (hireabilityScore >= 68) {
    verdict = "Proceed to Technical Screen";
    level = "warn";
  } else if (hireabilityScore >= 52) {
    verdict = "Potential with Portfolio Polish";
    level = "warn";
  }

  const leadingRepo = rankedRepos[0];
  const summary = `${verdict}: overall ${overallScore}/100 and hireability ${hireabilityScore}/100. Current readiness is ${readiness.label}. ${
    leadingRepo ? `Top signal comes from ${leadingRepo.name} (${leadingRepo.importance}/100 importance).` : "No standout repository identified yet."
  }`;

  const signals = [];
  if (strengths[0]) {
    signals.push(`Positive signal: ${strengths[0]}`);
  }
  if (metrics.totalStars > 0) {
    signals.push(`Market traction: ${metrics.totalStars} total stars across ${metrics.scorableRepoCount} scored repositories.`);
  } else {
    signals.push("Market traction is minimal; add demos and visibility to increase external validation.");
  }
  const firstRedFlag = redFlags.find((item) => !/No major red flags/i.test(item));
  if (firstRedFlag) {
    signals.push(`Primary concern: ${firstRedFlag}`);
  }
  const firstHiddenRisk = hiddenRisks.find((item) => !/^No hidden/i.test(item));
  if (firstHiddenRisk) {
    signals.push(`Hidden concern: ${firstHiddenRisk}`);
  }
  if (subscores.impactSignals < 60) {
    signals.push("Interview risk: impact signals are below benchmark for competitive product roles.");
  }

  return {
    verdict,
    level,
    summary,
    signals: signals.slice(0, 6)
  };
}

function buildCareerPathRecommendation(metrics, rankedRepos, subscores) {
  const languages = (metrics.topLanguages || []).map((lang) => lang.toLowerCase());
  const hasAnyLanguage = (list) => list.some((lang) => languages.includes(lang));

  let title = "Generalist Software Engineer";
  let summary = "Your repositories indicate broad engineering capability across multiple project types.";
  let nextSkills = [
    "Create 2 case-study READMEs that highlight architecture decisions and measurable outcomes.",
    "Add live demos to your top projects to improve recruiter conversion.",
    "Contribute at least 2 PRs/month to repositories related to your target role."
  ];

  if (hasAnyLanguage(["javascript", "typescript"])) {
    title = "Full-Stack JavaScript Engineer";
    summary = "Your language mix and repository profile align best with product-focused full-stack roles.";
    nextSkills = [
      "Ship one end-to-end project with production deployment, auth, and monitoring.",
      "Document system architecture and tradeoffs for your top JavaScript/TypeScript repositories.",
      "Add test coverage and CI status badges to your top 3 repositories."
    ];
  } else if (hasAnyLanguage(["python"])) {
    title = "Data / AI Engineer";
    summary = "Python-heavy activity indicates strong alignment with data and AI engineering tracks.";
    nextSkills = [
      "Publish one reproducible ML/data project with dataset, metrics, and inference/demo endpoint.",
      "Add evaluation methodology and model limitations to README docs.",
      "Showcase pipeline automation and observability in at least one repository."
    ];
  } else if (hasAnyLanguage(["java", "kotlin", "scala"])) {
    title = "Backend Platform Engineer";
    summary = "JVM-oriented repositories and contribution signals fit backend and platform engineering roles.";
    nextSkills = [
      "Demonstrate API design quality with versioned contracts and load/performance notes.",
      "Add reliability signals: retries, circuit breakers, and structured logging.",
      "Publish a backend project with deployment and scalability benchmarks."
    ];
  } else if (hasAnyLanguage(["go", "rust", "c", "c++"])) {
    title = "Systems / Infrastructure Engineer";
    summary = "Your dominant languages suggest strongest fit for systems and infrastructure engineering paths.";
    nextSkills = [
      "Build one performance-focused project with clear latency/throughput benchmarks.",
      "Document low-level design choices and profiling evidence in README.",
      "Add automation scripts for build/test/release workflows."
    ];
  } else if (hasAnyLanguage(["swift", "objective-c", "dart"])) {
    title = "Mobile Application Engineer";
    summary = "Language signals indicate strongest fit for modern mobile development roles.";
    nextSkills = [
      "Publish a shipped-quality mobile app with store-ready documentation and screenshots.",
      "Add crash/error monitoring strategy and release notes cadence.",
      "Showcase offline support and performance considerations."
    ];
  }

  const confidence = clampToRange(
    Math.round(
      52 +
      metrics.dominantLanguageShare * 18 +
      Math.min(metrics.uniqueLanguages, 5) * 4 +
      (subscores.codeActivityConsistency >= 70 ? 6 : 0) +
      (subscores.impactSignals >= 60 ? 6 : 0)
    ),
    35,
    95
  );

  const weakestSubscore = Object.entries(subscores).sort((a, b) => a[1] - b[1])[0][0];
  const weakestAdviceMap = {
    documentationQuality: "Strengthen documentation quality to make your projects legible to non-engineers.",
    codeActivityConsistency: "Establish a visible weekly commit cadence to reduce perceived delivery risk.",
    projectPopularity: "Increase visibility through demos, developer posts, and open-source collaboration.",
    repositoryCompleteness: "Add project metadata (description, topics, demos) to boost portfolio clarity.",
    languageDiversity: "Add one adjacent-stack project to signal broader technical range.",
    recentActivity: "Prioritize recent updates in top repositories to maintain recruiter confidence.",
    impactSignals: "Increase authored PR and issue activity in relevant external repositories."
  };

  nextSkills.push(weakestAdviceMap[weakestSubscore]);

  if (rankedRepos[0] && rankedRepos[0].importance >= 80) {
    nextSkills.push(`Position \`${rankedRepos[0].name}\` as flagship project with a complete case-study README.`);
  }

  return {
    title,
    confidence,
    summary,
    nextSkills: dedupe(nextSkills).slice(0, 6)
  };
}

function buildImprovementRoadmap(subscores, metrics, rankedRepos, careerPath, hiddenRisks) {
  const roadmap = [];
  const missingReadmeRepos = rankedRepos
    .filter((repo) => repo.readmeKnown && !repo.hasReadme)
    .slice(0, 2)
    .map((repo) => repo.name);
  const noHomepageRepos = rankedRepos
    .filter((repo) => !repo.homepage)
    .slice(0, 2)
    .map((repo) => repo.name);
  const staleRepos = rankedRepos
    .filter((repo) => daysSinceDate(repo.pushedAt) > 180)
    .slice(0, 2)
    .map((repo) => repo.name);

  roadmap.push(
    "Week 1: Set portfolio baseline by updating profile bio, pinning top repositories, and documenting measurable outcomes."
  );

  const deficitOrder = Object.entries(subscores)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);

  deficitOrder.forEach((key) => {
    if (key === "documentationQuality" && missingReadmeRepos.length) {
      roadmap.push(
        `Week 1-2: Add structured README files to ${joinRepoNames(missingReadmeRepos)} with problem, architecture, setup, and results.`
      );
    } else if (key === "recentActivity" || key === "codeActivityConsistency") {
      roadmap.push(
        "Week 2-5: Maintain weekly commits (minimum 1 meaningful update/week) across at least 4 core repositories."
      );
    } else if (key === "repositoryCompleteness" && noHomepageRepos.length) {
      roadmap.push(
        `Week 2-3: Add demo/homepage links and GitHub topics for ${joinRepoNames(noHomepageRepos)}.`
      );
    } else if (key === "impactSignals") {
      roadmap.push(
        "Week 3-6: Target 8 authored PRs and 6 authored issues in repositories aligned to your target role."
      );
    } else if (key === "projectPopularity") {
      roadmap.push(
        "Week 4: Publish concise demo posts and architecture threads to improve repository discoverability and star velocity."
      );
    } else if (key === "languageDiversity" && metrics.uniqueLanguages < 4) {
      roadmap.push(
        "Week 5-7: Build one production-quality project in an adjacent stack to expand technical breadth signals."
      );
    }
  });

  if (staleRepos.length) {
    roadmap.push(`Week 3: Refresh or archive stale repositories (${joinRepoNames(staleRepos)}) to reduce portfolio noise.`);
  }

  const firstHiddenRisk = hiddenRisks.find((item) => !/^No hidden/i.test(item));
  if (firstHiddenRisk) {
    roadmap.push(`Week 4: Resolve hidden risk identified by analysis: ${firstHiddenRisk}`);
  }

  roadmap.push(
    `Week 8: Repackage top 3 projects for ${careerPath.title} positioning with recruiter-focused case studies and outcomes.`
  );

  const defaults = [
    "Set a monthly portfolio review reminder to keep all flagship repositories active and complete.",
    "Add short demo videos/GIFs to your top repositories for faster recruiter evaluation."
  ];

  const uniqueRoadmap = dedupe(roadmap);
  while (uniqueRoadmap.length < 5 && defaults.length) {
    uniqueRoadmap.push(defaults.shift());
  }

  return uniqueRoadmap.slice(0, 7);
}

function buildScoreSummary(overallScore, grade, subscores, metrics, hireabilityScore, readinessLabel) {
  const strongest = getNamedSubscore(Object.entries(subscores).sort((a, b) => b[1] - a[1])[0][0]);
  const weakest = getNamedSubscore(Object.entries(subscores).sort((a, b) => a[1] - b[1])[0][0]);

  let summary = `Score ${overallScore}/100 (${grade}), hireability ${hireabilityScore}/100 (${readinessLabel}). Strongest area: ${strongest}. Biggest gap: ${weakest}.`;

  if (metrics.partialLanguageFailures || metrics.partialReadmeFailures) {
    summary += ` Partial data warning: ${metrics.partialLanguageFailures + metrics.partialReadmeFailures} deep checks failed due to API limits or transient errors.`;
  }

  return summary;
}

function computeActivityInLastSixMonths(repos) {
  const now = new Date();
  const monthKeys = [];

  for (let i = 0; i < 6; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
  }

  const activeSet = new Set();

  repos.forEach((repo) => {
    if (!repo.pushed_at) {
      return;
    }

    const pushed = new Date(repo.pushed_at);
    const key = `${pushed.getUTCFullYear()}-${pushed.getUTCMonth() + 1}`;
    if (monthKeys.includes(key)) {
      activeSet.add(key);
    }
  });

  const activeMonths = activeSet.size;
  return {
    activeMonths,
    ratio: activeMonths / 6
  };
}

function getRecencyBucket(daysSinceLastPush) {
  if (daysSinceLastPush <= 7) {
    return 1;
  }
  if (daysSinceLastPush <= 30) {
    return 0.8;
  }
  if (daysSinceLastPush <= 90) {
    return 0.6;
  }
  if (daysSinceLastPush <= 180) {
    return 0.3;
  }
  return 0.1;
}

function scoreToGrade(score) {
  if (score >= 90) {
    return "A+";
  }
  if (score >= 80) {
    return "A";
  }
  if (score >= 70) {
    return "B";
  }
  if (score >= 60) {
    return "C";
  }
  if (score >= 45) {
    return "D";
  }
  return "E";
}
