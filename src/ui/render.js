import { SUBSCORE_ID_MAP, SCORING_EXPLAIN_ID_MAP } from "../config/constants.js";
import {
  clearChildren,
  appendEmptyState,
  formatCompactNumber,
  formatDate,
  formatPercent,
  getSeverity,
  severityToChipClass,
  severityColor
} from "../utils/core.js";

export function renderInitialState(ui) {
  renderPinnedRepos({ source: "fallback", items: [] }, ui);

  renderInsightList(ui.strengthsList, ["No profile analyzed yet."], "neutral");
  renderInsightList(ui.redFlagsList, ["No profile analyzed yet."], "neutral");
  renderInsightList(ui.suggestionsList, ["No profile analyzed yet."], "neutral");
  renderInsightList(ui.hiddenRisksList, ["No hidden risk analysis yet."], "neutral");
  renderInsightList(ui.aiRecruiterSignals, ["Run an analysis to simulate recruiter feedback."], "neutral");

  renderRoadmap(["Roadmap will appear after analysis."], ui);
  renderCareerPath(
    {
      title: "Run an analysis to generate role fit",
      confidence: 0,
      summary: "Career path recommendations are generated from your public GitHub portfolio signals.",
      nextSkills: ["Add repositories and analyze profile to unlock recommendations."]
    },
    ui
  );

  ui.aiRecruiterVerdict.textContent = "Pending";
  ui.aiRecruiterVerdict.className = "chip chip-neutral";
  ui.aiRecruiterSummary.textContent = "Run an analysis to get recruiter-style interview feedback simulation.";

  ui.hireabilityScore.textContent = "--";
  ui.hireabilityHint.textContent = "Weighted recruiter-fit index";
  ui.readinessLevel.textContent = "--";
  ui.readinessHint.textContent = "Analyze a profile to classify readiness";
  ui.readinessBar.style.width = "0%";
}

export function renderAnalysis(result, ui) {
  renderProfile(result, ui);
  renderScore(result, ui);
  renderSubscores(result.subscores);
  renderScoringTransparency(result);
  renderPinnedRepos(result.pinnedRepos, ui);
  renderRecruiterSimulation(result.recruiterSimulation, ui);
  renderInsightList(ui.strengthsList, result.strengths, "good");
  renderInsightList(ui.redFlagsList, result.redFlags, "risk");
  renderInsightList(ui.suggestionsList, result.suggestions, "warn");
  renderInsightList(ui.hiddenRisksList, result.hiddenRisks, "risk");
  renderCareerPath(result.careerPath, ui);
  renderRoadmap(result.improvementRoadmap, ui);
  renderRepoRanking(result.rankedRepos, ui);
}

export function renderHistory(history, ui, onSelect) {
  clearChildren(ui.historyList);

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No recent searches yet.";
    ui.historyList.appendChild(empty);
    return;
  }

  history.forEach((username) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-chip";
    button.textContent = username;
    button.addEventListener("click", () => onSelect(username));

    ui.historyList.appendChild(button);
  });
}

function renderProfile(result, ui) {
  const profile = result.profile;
  const metrics = result.metrics;

  ui.avatarImg.src = profile.avatarUrl || "Images/logo.png";
  ui.avatarImg.alt = `${profile.login} avatar`;

  ui.profileName.textContent = profile.name;
  ui.profileHandle.textContent = `@${profile.login}`;

  ui.profileLink.href = profile.htmlUrl;
  ui.profileLink.textContent = profile.htmlUrl;

  ui.profileBio.textContent = profile.bio || "No bio provided.";

  ui.statRepos.textContent = String(profile.publicRepos);
  ui.statFollowers.textContent = formatCompactNumber(profile.followers);
  ui.statFollowing.textContent = formatCompactNumber(profile.following);
  ui.statLastPush.textContent = metrics.lastPushDate ? formatDate(metrics.lastPushDate) : "No push data";
  ui.statPrCount.textContent = formatCompactNumber(metrics.authoredPRCount);
  ui.statIssueCount.textContent = formatCompactNumber(metrics.authoredIssueCount);
  ui.statReviewCount.textContent = formatCompactNumber(metrics.authoredReviewCount);
}

function renderScore(result, ui) {
  const severity = getSeverity(result.overallScore);

  ui.overallScore.textContent = String(result.overallScore);
  ui.overallScoreRing.style.setProperty("--score-value", String(result.overallScore));
  ui.overallScoreRing.setAttribute("data-level", severity);
  ui.scoreGrade.textContent = `Grade ${result.grade}`;
  ui.scoreSummary.textContent = result.scoreSummary;

  const hireabilitySeverity = getSeverity(result.hireabilityScore);
  ui.hireabilityScore.textContent = `${result.hireabilityScore}/100`;
  ui.hireabilityScore.style.color = severityColor(hireabilitySeverity);
  ui.hireabilityHint.textContent = "Calibrated from score, impact, recency, and hidden-risk penalties.";

  ui.readinessLevel.textContent = result.readiness.label;
  ui.readinessLevel.style.color = severityColor(result.readiness.severity);
  ui.readinessHint.textContent = result.readiness.summary;
  ui.readinessBar.style.width = `${result.readiness.percent}%`;
}

function renderSubscores(subscores) {
  Object.entries(SUBSCORE_ID_MAP).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    const value = subscores[key];
    const severity = getSeverity(value);

    element.textContent = `${value}/100`;
    element.className = `chip ${severityToChipClass(severity)}`;
  });
}

function renderScoringTransparency(result) {
  const { subscores, metrics } = result;
  const details = {
    documentationQuality: `README ${formatPercent(metrics.readmeCoverage)}, Desc ${formatPercent(metrics.descriptionCoverage)}`,
    codeActivityConsistency: `${metrics.activeMonthsLast6}/6 months, ${formatPercent(metrics.reposUpdated90dRatio)} updated`,
    projectPopularity: `Stars ${metrics.starsPerRepo.toFixed(1)}/repo, Forks ${metrics.forksPerRepo.toFixed(1)}/repo`,
    repositoryCompleteness: `Non-empty ${formatPercent(metrics.nonEmptyRepoRatio)}, Topics ${formatPercent(metrics.topicsRatio)}`,
    languageDiversity: `${metrics.uniqueLanguages} langs, Entropy ${metrics.normalizedShannonEntropy.toFixed(2)}`,
    recentActivity: `${metrics.daysSinceLastPush}d last push, ${formatPercent(metrics.reposUpdated30dRatio)} updated`,
    impactSignals: `Top repo ⭐ ${metrics.topRepoStars}, PRs ${metrics.authoredPRCount}, Issues ${metrics.authoredIssueCount}, Reviews ${metrics.authoredReviewCount}`
  };

  Object.entries(SCORING_EXPLAIN_ID_MAP).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }

    const score = subscores[key];
    const severity = getSeverity(score);
    element.textContent = `${score}/100 • ${details[key]}`;
    element.className = `chip ${severityToChipClass(severity)}`;
  });
}

function renderRecruiterSimulation(simulation, ui) {
  if (!simulation) {
    ui.aiRecruiterVerdict.textContent = "Pending";
    ui.aiRecruiterVerdict.className = "chip chip-neutral";
    ui.aiRecruiterSummary.textContent = "Run an analysis to get recruiter-style interview feedback simulation.";
    renderInsightList(ui.aiRecruiterSignals, ["No recruiter simulation available."], "neutral");
    return;
  }

  ui.aiRecruiterVerdict.textContent = simulation.verdict;
  ui.aiRecruiterVerdict.className = `chip ${severityToChipClass(simulation.level || "warn")}`;
  ui.aiRecruiterSummary.textContent = simulation.summary;
  renderInsightList(ui.aiRecruiterSignals, simulation.signals, simulation.level || "warn");
}

function renderCareerPath(careerPath, ui) {
  if (!careerPath) {
    ui.careerPathTitle.textContent = "No career path recommendation";
    ui.careerPathSummary.textContent = "Run an analysis to unlock role fit recommendations.";
    ui.careerConfidence.textContent = "--";
    ui.careerConfidence.className = "chip chip-neutral";
    renderInsightList(ui.careerSkillsList, ["No recommendations yet."], "neutral");
    return;
  }

  ui.careerPathTitle.textContent = careerPath.title;
  ui.careerPathSummary.textContent = careerPath.summary;
  ui.careerConfidence.textContent = `${careerPath.confidence}% confidence`;
  ui.careerConfidence.className = `chip ${severityToChipClass(getSeverity(careerPath.confidence))}`;
  renderInsightList(ui.careerSkillsList, careerPath.nextSkills, "warn");
}

function renderRoadmap(roadmapItems, ui) {
  clearChildren(ui.roadmapList);

  if (!Array.isArray(roadmapItems) || !roadmapItems.length) {
    const li = document.createElement("li");
    li.textContent = "No roadmap available.";
    ui.roadmapList.appendChild(li);
    return;
  }

  roadmapItems.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ui.roadmapList.appendChild(li);
  });
}

function renderPinnedRepos(pinnedRepos, ui) {
  clearChildren(ui.pinnedReposList);

  ui.pinnedSourceBadge.textContent = pinnedRepos.source;
  ui.pinnedSourceBadge.className = `chip ${pinnedRepos.source === "graphql" ? "chip-good" : "chip-warn"}`;

  if (!pinnedRepos.items.length) {
    appendEmptyState(ui.pinnedReposList, "No pinned repositories available.");
    return;
  }

  pinnedRepos.items.forEach((repo) => {
    const li = document.createElement("li");
    li.className = "repo-item";

    const left = document.createElement("div");
    const link = document.createElement("a");
    link.href = repo.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repo.name;
    link.className = "repo-link";

    left.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "repo-item-meta";
    meta.textContent = `Stars: ${formatCompactNumber(repo.stars)}`;

    li.appendChild(left);
    li.appendChild(meta);

    ui.pinnedReposList.appendChild(li);
  });
}

export function renderInsightList(container, items, tone) {
  clearChildren(container);

  if (!items || !items.length) {
    appendEmptyState(container, "No insights available.");
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;

    if (tone === "good") {
      li.classList.add("chip-good");
    } else if (tone === "warn") {
      li.classList.add("chip-warn");
    } else if (tone === "risk") {
      li.classList.add("chip-risk");
    }

    container.appendChild(li);
  });
}

function renderRepoRanking(rankedRepos, ui) {
  clearChildren(ui.repoRankingTable);

  if (!rankedRepos.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No repositories available for ranking.";
    cell.className = "empty-state";
    row.appendChild(cell);
    ui.repoRankingTable.appendChild(row);
    return;
  }

  rankedRepos.slice(0, 15).forEach((repo) => {
    const row = document.createElement("tr");

    const repoCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = repo.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repo.name;
    link.className = "repo-link";

    const langMeta = document.createElement("div");
    langMeta.className = "repo-item-meta";
    langMeta.textContent = repo.language;

    repoCell.appendChild(link);
    repoCell.appendChild(langMeta);

    const importanceCell = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "importance-wrap";

    const meter = document.createElement("div");
    meter.className = "importance-meter";
    const fill = document.createElement("span");
    fill.style.width = `${repo.importance}%`;
    meter.appendChild(fill);

    const importanceText = document.createElement("span");
    importanceText.textContent = String(repo.importance);

    wrap.appendChild(meter);
    wrap.appendChild(importanceText);
    importanceCell.appendChild(wrap);

    const statsCell = document.createElement("td");
    statsCell.textContent = `${repo.stars} / ${repo.forks} / ${repo.watchers}`;

    const pushedCell = document.createElement("td");
    pushedCell.textContent = repo.pushedAt ? formatDate(repo.pushedAt) : "Unknown";

    const readmeCell = document.createElement("td");
    const readmeChip = document.createElement("span");

    if (repo.readmeKnown && repo.hasReadme) {
      readmeChip.textContent = "Yes";
      readmeChip.className = "chip chip-good";
    } else if (repo.readmeKnown && !repo.hasReadme) {
      readmeChip.textContent = "No";
      readmeChip.className = "chip chip-risk";
    } else {
      readmeChip.textContent = "Unknown";
      readmeChip.className = "chip chip-neutral";
    }

    readmeCell.appendChild(readmeChip);

    row.appendChild(repoCell);
    row.appendChild(importanceCell);
    row.appendChild(statsCell);
    row.appendChild(pushedCell);
    row.appendChild(readmeCell);

    ui.repoRankingTable.appendChild(row);
  });
}
