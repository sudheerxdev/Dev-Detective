export function getUiElements() {
  return {
    profileInput: document.getElementById("profileInput"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    downloadReportBtn: document.getElementById("downloadReportBtn"),

    loadingState: document.getElementById("loadingState"),
    loadingText: document.getElementById("loadingText"),
    errorBanner: document.getElementById("errorBanner"),
    rateLimitBanner: document.getElementById("rateLimitBanner"),

    avatarImg: document.getElementById("avatarImg"),
    profileName: document.getElementById("profileName"),
    profileHandle: document.getElementById("profileHandle"),
    profileLink: document.getElementById("profileLink"),
    profileBio: document.getElementById("profileBio"),

    statRepos: document.getElementById("statRepos"),
    statFollowers: document.getElementById("statFollowers"),
    statFollowing: document.getElementById("statFollowing"),
    statLastPush: document.getElementById("statLastPush"),
    statPrCount: document.getElementById("statPrCount"),
    statIssueCount: document.getElementById("statIssueCount"),
    statReviewCount: document.getElementById("statReviewCount"),

    pinnedSourceBadge: document.getElementById("pinnedSourceBadge"),
    pinnedReposList: document.getElementById("pinnedReposList"),
    historyList: document.getElementById("historyList"),

    overallScoreRing: document.getElementById("overallScoreRing"),
    overallScore: document.getElementById("overallScore"),
    scoreGrade: document.getElementById("scoreGrade"),
    scoreSummary: document.getElementById("scoreSummary"),
    hireabilityScore: document.getElementById("hireabilityScore"),
    hireabilityHint: document.getElementById("hireabilityHint"),
    readinessLevel: document.getElementById("readinessLevel"),
    readinessHint: document.getElementById("readinessHint"),
    readinessBar: document.getElementById("readinessBar"),

    strengthsList: document.getElementById("strengthsList"),
    redFlagsList: document.getElementById("redFlagsList"),
    suggestionsList: document.getElementById("suggestionsList"),
    hiddenRisksList: document.getElementById("hiddenRisksList"),

    aiRecruiterVerdict: document.getElementById("aiRecruiterVerdict"),
    aiRecruiterSummary: document.getElementById("aiRecruiterSummary"),
    aiRecruiterSignals: document.getElementById("aiRecruiterSignals"),

    careerPathTitle: document.getElementById("careerPathTitle"),
    careerPathSummary: document.getElementById("careerPathSummary"),
    careerConfidence: document.getElementById("careerConfidence"),
    careerSkillsList: document.getElementById("careerSkillsList"),
    roadmapList: document.getElementById("roadmapList"),

    repoRankingTable: document.getElementById("repoRankingTable"),

    languageChart: document.getElementById("languageChart"),
    importanceChart: document.getElementById("importanceChart"),
    subscoreRadarChart: document.getElementById("subscoreRadarChart"),
    activityChart: document.getElementById("activityChart")
  };
}
