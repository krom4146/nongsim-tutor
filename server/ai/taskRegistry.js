import { AI_TASK_PROMPTS, buildAiTaskOpenAiRequest } from "./prompts.js";
import {
  boardAnalysisRequestSchema,
  completionReflectionAnalysisRequestSchema,
  goalComposeRequestSchema,
  jobReflectionAnalysisRequestSchema,
  missionDraftRequestSchema,
  normalizeBoardAnalysisRequest,
  normalizeCompletionReflectionAnalysisRequest,
  normalizeGoalCohortRequest,
  normalizeGoalComposeRequest,
  normalizeJobReflectionAnalysisRequest,
  normalizeMissionDraftRequest,
  normalizePollClusterRequest,
  normalizeReportFeedbackRequest,
  normalizeTransferReportRequest,
  pollClusterRequestSchema,
  projectBoardAnalysisResult,
  projectCompletionReflectionAnalysisResult,
  projectGoalCohortResult,
  projectGoalComposeResult,
  projectJobReflectionAnalysisResult,
  projectMissionDraftResult,
  projectPollClusterResult,
  projectReportFeedbackResult,
  projectTransferReportResult,
  reportFeedbackRequestSchema,
  transferReportRequestSchema,
  goalCohortRequestSchema,
  validateGoalCohortSources,
  validateCompletionReflectionAnalysisSources,
  validateGoalComposeSources,
  validateJobReflectionAnalysisSources,
  validatePollClusterSources,
  validateTransferReportSources,
} from "./schemas.js";

function alwaysSufficient() {
  return true;
}

function createTaskDefinition(task, contract) {
  const prompt = AI_TASK_PROMPTS[task];
  const definition = {
    task,
    purpose: prompt.purpose,
    promptVersion: prompt.promptVersion,
    systemPrompt: prompt.systemPrompt,
    requestSchema: contract.requestSchema,
    outputSchema: prompt.outputSchema,
    outputFormatName: prompt.outputFormatName,
    maxOutputTokens: prompt.maxOutputTokens,
    normalizeRequest: contract.normalizeRequest,
    validateEvidence: contract.validateEvidence || (() => {}),
    projectResult: contract.projectResult,
    hasSufficientData: contract.hasSufficientData || alwaysSufficient,
    isExplicitlyEmpty: contract.isExplicitlyEmpty || (() => false),
    buildUserInput: prompt.buildUserInput,
  };
  definition.buildOpenAiRequest = (args) => buildAiTaskOpenAiRequest({ definition, ...args });
  return Object.freeze(definition);
}

export const AI_TASK_REGISTRY = Object.freeze({
  goalCohort: createTaskDefinition("goalCohort", {
    requestSchema: goalCohortRequestSchema,
    normalizeRequest: normalizeGoalCohortRequest,
    validateEvidence: (result, payload) => validateGoalCohortSources(result, payload.goals),
    projectResult: (result, payload, generatedAt) => projectGoalCohortResult(result, payload.goals, generatedAt),
    hasSufficientData: (payload) => payload.goals.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.goals) && payload.goals.length === 0,
  }),
  goalCompose: createTaskDefinition("goalCompose", {
    requestSchema: goalComposeRequestSchema,
    normalizeRequest: normalizeGoalComposeRequest,
    validateEvidence: validateGoalComposeSources,
    projectResult: projectGoalComposeResult,
    hasSufficientData: (payload) => payload.answers.length === 3,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.answers) && payload.answers.length === 0,
  }),
  pollCluster: createTaskDefinition("pollCluster", {
    requestSchema: pollClusterRequestSchema,
    normalizeRequest: normalizePollClusterRequest,
    validateEvidence: validatePollClusterSources,
    projectResult: projectPollClusterResult,
    hasSufficientData: (payload) => payload.responses.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.responses) && payload.responses.length === 0,
  }),
  boardAnalysis: createTaskDefinition("boardAnalysis", {
    requestSchema: boardAnalysisRequestSchema,
    normalizeRequest: normalizeBoardAnalysisRequest,
    projectResult: projectBoardAnalysisResult,
  }),
  transferReport: createTaskDefinition("transferReport", {
    requestSchema: transferReportRequestSchema,
    normalizeRequest: normalizeTransferReportRequest,
    validateEvidence: validateTransferReportSources,
    projectResult: projectTransferReportResult,
    hasSufficientData: (payload) => payload.surveys.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.surveys) && payload.surveys.length === 0,
  }),
  jobReflectionAnalysis: createTaskDefinition("jobReflectionAnalysis", {
    requestSchema: jobReflectionAnalysisRequestSchema,
    normalizeRequest: normalizeJobReflectionAnalysisRequest,
    validateEvidence: validateJobReflectionAnalysisSources,
    projectResult: projectJobReflectionAnalysisResult,
    hasSufficientData: (payload) => payload.sessions.length > 0 && payload.reflections.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.reflections) && payload.reflections.length === 0,
  }),
  completionReflectionAnalysis: createTaskDefinition("completionReflectionAnalysis", {
    requestSchema: completionReflectionAnalysisRequestSchema,
    normalizeRequest: normalizeCompletionReflectionAnalysisRequest,
    validateEvidence: validateCompletionReflectionAnalysisSources,
    projectResult: projectCompletionReflectionAnalysisResult,
    hasSufficientData: (payload) => payload.reflections.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.reflections) && payload.reflections.length === 0,
  }),
  missionDraft: createTaskDefinition("missionDraft", {
    requestSchema: missionDraftRequestSchema,
    normalizeRequest: normalizeMissionDraftRequest,
    projectResult: projectMissionDraftResult,
    hasSufficientData: (payload) => Boolean(
      payload.goal || payload.jobReflection || payload.achievementResponses.length,
    ),
    isExplicitlyEmpty: (payload) => payload?.goal == null
      && payload?.jobReflection == null
      && Array.isArray(payload?.achievementResponses)
      && payload.achievementResponses.length === 0,
  }),
  reportFeedback: createTaskDefinition("reportFeedback", {
    requestSchema: reportFeedbackRequestSchema,
    normalizeRequest: normalizeReportFeedbackRequest,
    projectResult: projectReportFeedbackResult,
    hasSufficientData: (payload) => payload.turns.length > 0,
    isExplicitlyEmpty: (payload) => Array.isArray(payload?.turns) && payload.turns.length === 0,
  }),
});

export function getAiTaskDefinition(task) {
  return typeof task === "string" ? AI_TASK_REGISTRY[task] || null : null;
}
