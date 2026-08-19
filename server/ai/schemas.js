import { z } from "zod";

// Server-only request and Structured Output contracts.

export const MAX_GOAL_COUNT = 200;
export const MAX_GOAL_TEXT_LENGTH = 2_000;
export const MAX_TOTAL_GOAL_TEXT_LENGTH = 20_000;

const optionalScopeText = z.string().trim().min(1).max(100).nullable().optional();

const goalSourceSchema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),
  text: z.string().trim().min(1).max(MAX_GOAL_TEXT_LENGTH),
}).strict();

export const goalCohortPayloadSchema = z.object({
  classId: optionalScopeText,
  className: optionalScopeText,
  goals: z.array(goalSourceSchema).min(1).max(MAX_GOAL_COUNT),
}).strict().superRefine((payload, context) => {
  const sourceIds = new Set();
  let totalLength = 0;

  payload.goals.forEach((goal, index) => {
    if (sourceIds.has(goal.sourceId)) {
      context.addIssue({
        code: "custom",
        message: "sourceId must be unique.",
        path: ["goals", index, "sourceId"],
      });
    }
    sourceIds.add(goal.sourceId);
    totalLength += goal.text.length;
  });

  if (totalLength > MAX_TOTAL_GOAL_TEXT_LENGTH) {
    context.addIssue({
      code: "custom",
      message: "Total goal text is too long.",
      path: ["goals"],
    });
  }
});

export const goalCohortRequestSchema = z.object({
  task: z.literal("goalCohort"),
  courseCode: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/),
  payload: goalCohortPayloadSchema,
}).strict();

const sourceIdsSchema = z.array(z.string()).min(1).max(MAX_GOAL_COUNT);

export const goalCohortOutputSchema = z.object({
  summary: z.string().min(1).max(2_000),
  summarySourceIds: sourceIdsSchema,
  clusters: z.array(z.object({
    title: z.string().min(1).max(120),
    count: z.number().int().nonnegative(),
    insight: z.string().min(1).max(1_000),
    sourceIds: sourceIdsSchema,
  }).strict()).min(1).max(5),
  recommendedActions: z.array(z.string().min(1).max(500)).min(1).max(5),
  followupQuestions: z.array(z.string().min(1).max(500)).min(1).max(4),
  sampleSize: z.number().int().nonnegative(),
  dataWarning: z.string().max(500).nullable(),
}).strict();

const EVIDENCE_LIMIT = 12;

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function redactPersonalData(value) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[이메일 제거]")
    .replace(/\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b/gu, "[식별번호 제거]")
    .replace(/(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/gu, "[전화번호 제거]")
    .replace(/(?:성명|이름|실명)\s*(?:[:：]|은|는|이|가)?\s*(?:[가-힣]{2,4}|[A-Z][A-Z .'-]{1,49})(?=\s*(?:입니다|이다|님|씨)?(?:[,.;!?]|$))/giu, "[이름 제거]")
    .replace(/(?:사번|직원\s*번호|임직원\s*번호)\s*(?:[:：]|은|는|이|가)?\s*[A-Z0-9-]{3,30}/giu, "[사번 제거]");
}

export function normalizeGoalCohortRequest(value) {
  const parsed = goalCohortRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      classId: parsed.payload.classId ? normalizeWhitespace(parsed.payload.classId) : null,
      className: parsed.payload.className ? normalizeWhitespace(parsed.payload.className) : null,
      goals: parsed.payload.goals.map((goal) => ({
        sourceId: goal.sourceId,
        text: redactPersonalData(normalizeWhitespace(goal.text)),
      })),
    },
  };
}

export function validateGoalCohortSources(result, goals) {
  const allowedSourceIds = new Set(goals.map((goal) => goal.sourceId));
  const referencedSourceIds = [
    ...result.summarySourceIds,
    ...result.clusters.flatMap((cluster) => cluster.sourceIds),
  ];

  if (referencedSourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
    throw new Error("UNGROUNDED_SOURCE_ID");
  }
  if (result.sampleSize !== goals.length) {
    throw new Error("INVALID_SAMPLE_SIZE");
  }
  if (result.clusters.some((cluster) => cluster.count !== new Set(cluster.sourceIds).size)) {
    throw new Error("INVALID_CLUSTER_COUNT");
  }
}

export function projectGoalCohortResult(result, goals, generatedAt = new Date().toISOString()) {
  validateGoalCohortSources(result, goals);
  const sourceById = new Map(goals.map((goal, index) => [goal.sourceId, {
    source: "goal",
    by: `응답자 ${index + 1}`,
    quote: goal.text,
  }]));
  const evidenceSourceIds = [...new Set([
    ...result.summarySourceIds,
    ...result.clusters.flatMap((cluster) => cluster.sourceIds),
  ])].slice(0, EVIDENCE_LIMIT);
  const dataWarning = goals.length < 3 && !result.dataWarning
    ? "표본이 적어 공통 경향으로 일반화하기 어렵습니다."
    : result.dataWarning;

  return {
    ...result,
    dataWarning,
    evidence: evidenceSourceIds.map((sourceId) => sourceById.get(sourceId)),
    evidenceCount: evidenceSourceIds.length,
    generatedAt,
  };
}

const MAX_SOURCE_COUNT = 200;
const MAX_SOURCE_TEXT_LENGTH = 2_000;
const MAX_TOTAL_TEXT_LENGTH = 20_000;
const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_REPORT_TURNS = 20;

const courseCodeSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/);
const taskSourceIdSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
const taskSourceSchema = z.object({
  sourceId: taskSourceIdSchema,
  text: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
}).strict();
const taskSourceIdsSchema = z.array(taskSourceIdSchema).min(1).max(MAX_SOURCE_COUNT);

function addUniqueSourceIssues(items, context, pathPrefix) {
  const sourceIds = new Set();
  items.forEach((item, index) => {
    if (sourceIds.has(item.sourceId)) {
      context.addIssue({
        code: "custom",
        message: "sourceId must be unique.",
        path: [pathPrefix, index, "sourceId"],
      });
    }
    sourceIds.add(item.sourceId);
  });
}

function addTotalTextIssue(items, context, path) {
  const totalLength = items.reduce((sum, item) => sum + item.text.length, 0);
  if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
    context.addIssue({ code: "custom", message: "Total text is too long.", path: [path] });
  }
}

function normalizeSource(source) {
  return {
    sourceId: source.sourceId,
    text: redactPersonalData(normalizeWhitespace(source.text)),
  };
}

function assertKnownSourceIds(sourceIds, allowedSourceIds) {
  if (sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
    throw new Error("UNGROUNDED_SOURCE_ID");
  }
}

function uniqueSourceIds(values) {
  return [...new Set(values)];
}

function withGeneratedAt(result, generatedAt = new Date().toISOString()) {
  return { ...result, generatedAt };
}

const goalComposeAnswerSchema = taskSourceSchema.extend({
  question: z.string().trim().min(1).max(500),
}).strict();

export const goalComposePayloadSchema = z.object({
  answers: z.array(goalComposeAnswerSchema).length(3),
}).strict().superRefine((payload, context) => {
  addUniqueSourceIssues(payload.answers, context, "answers");
  addTotalTextIssue(payload.answers.map((answer) => ({
    text: `${answer.question} ${answer.text}`,
  })), context, "answers");
});

export const goalComposeRequestSchema = z.object({
  task: z.literal("goalCompose"),
  courseCode: courseCodeSchema,
  payload: goalComposePayloadSchema,
}).strict();

export const goalComposeOutputSchema = z.object({
  goalText: z.string().min(8).max(1_000),
  focusPoint: z.string().min(1).max(700),
  actionMission: z.string().min(1).max(700),
  sourceIds: z.array(taskSourceIdSchema).length(3),
}).strict();

export function normalizeGoalComposeRequest(value) {
  const parsed = goalComposeRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      answers: parsed.payload.answers.map((answer) => ({
        sourceId: answer.sourceId,
        question: redactPersonalData(normalizeWhitespace(answer.question)),
        text: redactPersonalData(normalizeWhitespace(answer.text)),
      })),
    },
  };
}

export function validateGoalComposeSources(result, payload) {
  const allowedSourceIds = new Set(payload.answers.map((answer) => answer.sourceId));
  assertKnownSourceIds(result.sourceIds, allowedSourceIds);
  if (new Set(result.sourceIds).size !== allowedSourceIds.size
    || result.sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId))) {
    throw new Error("INCOMPLETE_SOURCE_COVERAGE");
  }
}

export function projectGoalComposeResult(result, payload, generatedAt = new Date().toISOString()) {
  validateGoalComposeSources(result, payload);
  return withGeneratedAt(result, generatedAt);
}

const pollRoundSchema = z.object({
  sourceId: taskSourceIdSchema,
  prompt: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
  questionType: z.enum(["subjective", "objective"]),
  questionIntent: z.enum(["general", "understanding", "misconception", "application", "dilemma", "emotion"]),
  anonymous: z.boolean(),
}).strict();

const pollResponseSchema = taskSourceSchema.extend({
  agree: z.number().int().min(0).max(1_000_000),
}).strict();

export const pollClusterPayloadSchema = z.object({
  round: pollRoundSchema,
  responses: z.array(pollResponseSchema).min(1).max(MAX_SOURCE_COUNT),
}).strict().superRefine((payload, context) => {
  addUniqueSourceIssues([payload.round, ...payload.responses], context, "responses");
  addTotalTextIssue([
    { text: payload.round.prompt },
    ...payload.responses,
  ], context, "responses");
});

export const pollClusterRequestSchema = z.object({
  task: z.literal("pollCluster"),
  courseCode: courseCodeSchema,
  payload: pollClusterPayloadSchema,
}).strict();

const clusterOutputSchema = z.object({
  title: z.string().min(1).max(120),
  count: z.number().int().nonnegative(),
  insight: z.string().min(1).max(1_000),
  sourceIds: taskSourceIdsSchema,
}).strict();

export const pollClusterOutputSchema = z.object({
  summary: z.string().min(1).max(2_000),
  summarySourceIds: taskSourceIdsSchema,
  clusters: z.array(clusterOutputSchema).min(1).max(6),
  recommendedActions: z.array(z.string().min(1).max(500)).min(1).max(5),
  followupQuestions: z.array(z.string().min(1).max(500)).min(1).max(4),
  teachingIntervention: z.object({
    insufficientConcept: z.string().min(1).max(500),
    confusionPoint: z.string().min(1).max(500),
    immediateQuestion: z.string().min(1).max(500),
    miniLesson: z.string().min(1).max(1_000),
    discussionTopic: z.string().min(1).max(500),
    evidenceSourceIds: taskSourceIdsSchema,
  }).strict(),
  sampleSize: z.number().int().nonnegative(),
  dataWarning: z.string().max(500).nullable(),
}).strict();

export function normalizePollClusterRequest(value) {
  const parsed = pollClusterRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      round: {
        ...parsed.payload.round,
        prompt: redactPersonalData(normalizeWhitespace(parsed.payload.round.prompt)),
      },
      responses: parsed.payload.responses.map((response) => ({
        ...normalizeSource(response),
        agree: response.agree,
      })),
    },
  };
}

export function validatePollClusterSources(result, payload) {
  const allowedSourceIds = new Set(payload.responses.map((response) => response.sourceId));
  const referencedSourceIds = [
    ...result.summarySourceIds,
    ...result.clusters.flatMap((cluster) => cluster.sourceIds),
    ...result.teachingIntervention.evidenceSourceIds,
  ];
  assertKnownSourceIds(referencedSourceIds, allowedSourceIds);
  if (result.sampleSize !== payload.responses.length) throw new Error("INVALID_SAMPLE_SIZE");
  if (result.clusters.some((cluster) => cluster.count !== new Set(cluster.sourceIds).size)) {
    throw new Error("INVALID_CLUSTER_COUNT");
  }
}

export function projectPollClusterResult(result, payload, generatedAt = new Date().toISOString()) {
  validatePollClusterSources(result, payload);
  const sourceById = new Map(payload.responses.map((response, index) => [response.sourceId, {
    source: "poll",
    by: payload.round.anonymous ? "익명" : `응답자 ${index + 1}`,
    quote: response.text,
  }]));
  const evidenceSourceIds = uniqueSourceIds([
    ...result.summarySourceIds,
    ...result.clusters.flatMap((cluster) => cluster.sourceIds),
    ...result.teachingIntervention.evidenceSourceIds,
  ]).slice(0, EVIDENCE_LIMIT);
  const interventionEvidence = uniqueSourceIds(result.teachingIntervention.evidenceSourceIds)
    .map((sourceId) => sourceById.get(sourceId)?.quote)
    .filter(Boolean)
    .join(" / ");
  const dataWarning = payload.responses.length < 3 && !result.dataWarning
    ? "표본이 적어 공통 경향으로 일반화하기 어렵습니다."
    : result.dataWarning;

  return {
    ...result,
    dataWarning,
    teachingIntervention: {
      ...result.teachingIntervention,
      evidence: interventionEvidence,
    },
    evidence: evidenceSourceIds.map((sourceId) => sourceById.get(sourceId)),
    evidenceCount: evidenceSourceIds.length,
    generatedAt,
  };
}

export const boardAnalysisPayloadSchema = z.object({
  classId: optionalScopeText,
  className: optionalScopeText,
  moduleTitle: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  scopeLabel: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  imageUrl: z.string().trim().url().max(2_048),
}).strict();

export const boardAnalysisRequestSchema = z.object({
  task: z.literal("boardAnalysis"),
  courseCode: courseCodeSchema,
  payload: boardAnalysisPayloadSchema,
}).strict();

export const boardAnalysisOutputSchema = z.object({
  status: z.enum(["ok", "unreadable"]),
  scope: z.string().min(1).max(300),
  summary: z.string().min(1).max(2_000),
  common: z.array(z.string().min(1).max(300)).max(6),
  action: z.string().min(1).max(1_000),
}).strict();

export function assertAllowedBoardImageUrl(value, configuredSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) {
  let supabaseUrl;
  try {
    supabaseUrl = new URL(configuredSupabaseUrl);
  } catch {
    throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  }
  let imageUrl;
  try {
    imageUrl = new URL(value);
  } catch {
    throw new Error("INVALID_BOARD_IMAGE_URL");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(imageUrl.pathname);
  } catch {
    throw new Error("INVALID_BOARD_IMAGE_URL");
  }
  const allowedPrefix = "/storage/v1/object/public/board-images/";
  if (imageUrl.protocol !== "https:"
    || imageUrl.origin !== supabaseUrl.origin
    || imageUrl.username
    || imageUrl.password
    || imageUrl.search
    || imageUrl.hash
    || !decodedPath.startsWith(allowedPrefix)
    || decodedPath.length <= allowedPrefix.length
    || decodedPath.includes("..")) {
    throw new Error("INVALID_BOARD_IMAGE_URL");
  }
  return imageUrl.toString();
}

export function normalizeBoardAnalysisRequest(value) {
  const parsed = boardAnalysisRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      classId: parsed.payload.classId ? normalizeWhitespace(parsed.payload.classId) : null,
      className: parsed.payload.className ? normalizeWhitespace(parsed.payload.className) : null,
      moduleTitle: redactPersonalData(normalizeWhitespace(parsed.payload.moduleTitle)),
      scopeLabel: redactPersonalData(normalizeWhitespace(parsed.payload.scopeLabel)),
      imageUrl: assertAllowedBoardImageUrl(parsed.payload.imageUrl),
    },
  };
}

export function projectBoardAnalysisResult(result, payload, generatedAt) {
  return withGeneratedAt({
    ...result,
    scope: payload.scopeLabel,
  }, generatedAt);
}

const surveySchema = z.object({
  sourceId: taskSourceIdSchema,
  likert: z.array(z.number().int().min(1).max(5)).length(5),
  barriers: z.array(z.string().trim().min(1).max(100)).max(10),
  applied: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
  support: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
}).strict();

export const transferReportPayloadSchema = z.object({
  classId: optionalScopeText,
  className: optionalScopeText,
  participantCount: z.number().int().nonnegative().max(100_000),
  surveys: z.array(surveySchema).min(1).max(MAX_SOURCE_COUNT),
}).strict().superRefine((payload, context) => {
  addUniqueSourceIssues(payload.surveys, context, "surveys");
  addTotalTextIssue(payload.surveys.map((survey) => ({
    text: `${survey.applied} ${survey.support} ${survey.barriers.join(" ")}`,
  })), context, "surveys");
  if (payload.participantCount < payload.surveys.length) {
    context.addIssue({
      code: "custom",
      message: "participantCount cannot be smaller than survey count.",
      path: ["participantCount"],
    });
  }
});

export const transferReportRequestSchema = z.object({
  task: z.literal("transferReport"),
  courseCode: courseCodeSchema,
  payload: transferReportPayloadSchema,
}).strict();

const surveyCaseSchema = z.object({
  sourceIds: z.array(taskSourceIdSchema).min(1).max(MAX_SOURCE_COUNT),
}).strict();

export const transferReportOutputSchema = z.object({
  summary: z.string().min(1).max(2_000),
  successCase: surveyCaseSchema,
  blockedCase: surveyCaseSchema,
  appliedHighlights: z.array(surveyCaseSchema).max(5),
  supportHighlights: z.array(surveyCaseSchema).max(5),
  barriers: z.array(z.object({
    label: z.string().min(1).max(100),
    count: z.number().int().nonnegative(),
  }).strict()).max(10),
  recommendedActions: z.array(z.string().min(1).max(500)).min(1).max(5),
  dataWarning: z.string().max(500).nullable(),
}).strict();

export function normalizeTransferReportRequest(value) {
  const parsed = transferReportRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      classId: parsed.payload.classId ? normalizeWhitespace(parsed.payload.classId) : null,
      className: parsed.payload.className ? normalizeWhitespace(parsed.payload.className) : null,
      participantCount: parsed.payload.participantCount,
      surveys: parsed.payload.surveys.map((survey) => ({
        sourceId: survey.sourceId,
        likert: [...survey.likert],
        barriers: survey.barriers.map((barrier) => redactPersonalData(normalizeWhitespace(barrier))),
        applied: redactPersonalData(normalizeWhitespace(survey.applied)),
        support: redactPersonalData(normalizeWhitespace(survey.support)),
      })),
    },
  };
}

export function validateTransferReportSources(result, payload) {
  const allowedSourceIds = new Set(payload.surveys.map((survey) => survey.sourceId));
  const referencedSourceIds = [
    ...result.successCase.sourceIds,
    ...result.blockedCase.sourceIds,
    ...result.appliedHighlights.flatMap((highlight) => highlight.sourceIds),
    ...result.supportHighlights.flatMap((highlight) => highlight.sourceIds),
  ];
  assertKnownSourceIds(referencedSourceIds, allowedSourceIds);

  const actualBarrierCounts = payload.surveys.reduce((counts, survey) => {
    uniqueSourceIds(survey.barriers).forEach((barrier) => counts.set(barrier, (counts.get(barrier) || 0) + 1));
    return counts;
  }, new Map());
  const returnedLabels = new Set();
  result.barriers.forEach(({ label, count }) => {
    if (returnedLabels.has(label) || actualBarrierCounts.get(label) !== count) {
      throw new Error("INVALID_BARRIER_COUNT");
    }
    returnedLabels.add(label);
  });
  if (returnedLabels.size !== actualBarrierCounts.size) {
    throw new Error("INVALID_BARRIER_COUNT");
  }
}

function surveyEvidence(sourceIds, surveyById, field) {
  return uniqueSourceIds(sourceIds).map((sourceId) => {
    const survey = surveyById.get(sourceId);
    const quote = field === "applied"
      ? survey.applied
      : survey.support || survey.barriers.join(", ");
    return { by: survey.by, quote };
  });
}

export function projectTransferReportResult(result, payload, generatedAt = new Date().toISOString()) {
  validateTransferReportSources(result, payload);
  const surveyById = new Map(payload.surveys.map((survey, index) => [survey.sourceId, {
    ...survey,
    by: `응답자 ${index + 1}`,
  }]));
  const dataWarning = payload.surveys.length < 3 && !result.dataWarning
    ? "응답 수가 적어 교육 전이의 공통 경향이나 인과로 일반화하기 어렵습니다."
    : result.dataWarning;
  return {
    ...result,
    dataWarning,
    successCase: {
      ...result.successCase,
      evidence: surveyEvidence(result.successCase.sourceIds, surveyById, "applied"),
    },
    blockedCase: {
      ...result.blockedCase,
      evidence: surveyEvidence(result.blockedCase.sourceIds, surveyById, "support"),
    },
    appliedHighlights: result.appliedHighlights.map((highlight) => ({
      ...highlight,
      evidence: surveyEvidence(highlight.sourceIds, surveyById, "applied"),
    })),
    supportHighlights: result.supportHighlights.map((highlight) => ({
      ...highlight,
      evidence: surveyEvidence(highlight.sourceIds, surveyById, "support"),
    })),
    generatedAt,
  };
}

const jobReflectionSessionSchema = z.object({
  sessionId: taskSourceIdSchema,
  title: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
}).strict();

const jobReflectionSourceSchema = z.object({
  sourceId: taskSourceIdSchema,
  bestSessionId: taskSourceIdSchema,
  bestReason: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  bestReasonEtc: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH).nullable(),
  improvementSessionId: taskSourceIdSchema.nullable(),
  improvementReason: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH).nullable(),
  improvementReasonEtc: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH).nullable(),
  workApplicationPoint: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
}).strict();

export const jobReflectionAnalysisPayloadSchema = z.object({
  classId: optionalScopeText,
  className: optionalScopeText,
  reflectionDate: z.iso.date(),
  participantCount: z.number().int().nonnegative().max(100_000),
  sessions: z.array(jobReflectionSessionSchema).min(1).max(100),
  reflections: z.array(jobReflectionSourceSchema).min(1).max(MAX_SOURCE_COUNT),
}).strict().superRefine((payload, context) => {
  addUniqueSourceIssues(payload.reflections, context, "reflections");
  const sessionIds = new Set();
  payload.sessions.forEach((session, index) => {
    if (sessionIds.has(session.sessionId)) {
      context.addIssue({
        code: "custom",
        message: "sessionId must be unique.",
        path: ["sessions", index, "sessionId"],
      });
    }
    sessionIds.add(session.sessionId);
  });
  payload.reflections.forEach((reflection, index) => {
    if (!sessionIds.has(reflection.bestSessionId)) {
      context.addIssue({
        code: "custom",
        message: "bestSessionId must reference a supplied session.",
        path: ["reflections", index, "bestSessionId"],
      });
    }
    if (reflection.improvementSessionId
      && reflection.improvementSessionId !== "none"
      && !sessionIds.has(reflection.improvementSessionId)) {
      context.addIssue({
        code: "custom",
        message: "improvementSessionId must reference a supplied session or none.",
        path: ["reflections", index, "improvementSessionId"],
      });
    }
  });
  addTotalTextIssue(payload.reflections.map((reflection) => ({
    text: [
      reflection.bestReason,
      reflection.bestReasonEtc,
      reflection.improvementReason,
      reflection.improvementReasonEtc,
      reflection.workApplicationPoint,
    ].filter(Boolean).join(" "),
  })), context, "reflections");
  if (payload.participantCount < payload.reflections.length) {
    context.addIssue({
      code: "custom",
      message: "participantCount cannot be smaller than reflection count.",
      path: ["participantCount"],
    });
  }
});

export const jobReflectionAnalysisRequestSchema = z.object({
  task: z.literal("jobReflectionAnalysis"),
  courseCode: courseCodeSchema,
  payload: jobReflectionAnalysisPayloadSchema,
}).strict();

const jobReflectionEvidenceIdsSchema = z.array(taskSourceIdSchema).min(1).max(MAX_SOURCE_COUNT);

export const jobReflectionAnalysisOutputSchema = z.object({
  analysis: z.string().min(1).max(2_000),
  analysisSourceIds: jobReflectionEvidenceIdsSchema,
  headquartersSummary: z.string().min(1).max(2_000),
  headquartersSourceIds: jobReflectionEvidenceIdsSchema,
  operationsSummary: z.string().min(1).max(2_000),
  operationsSourceIds: jobReflectionEvidenceIdsSchema,
  recommendedActions: z.array(z.object({
    audience: z.enum(["headquarters", "operations"]),
    action: z.string().min(1).max(500),
    sourceIds: jobReflectionEvidenceIdsSchema,
  }).strict()).min(1).max(6),
  sampleSize: z.number().int().nonnegative(),
  dataWarning: z.string().max(500).nullable(),
}).strict();

export function normalizeJobReflectionAnalysisRequest(value) {
  const parsed = jobReflectionAnalysisRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      classId: parsed.payload.classId ? normalizeWhitespace(parsed.payload.classId) : null,
      className: parsed.payload.className ? normalizeWhitespace(parsed.payload.className) : null,
      reflectionDate: parsed.payload.reflectionDate,
      participantCount: parsed.payload.participantCount,
      sessions: parsed.payload.sessions.map((session) => ({
        sessionId: session.sessionId,
        title: redactPersonalData(normalizeWhitespace(session.title)),
      })),
      reflections: parsed.payload.reflections.map((reflection) => ({
        sourceId: reflection.sourceId,
        bestSessionId: reflection.bestSessionId,
        bestReason: redactPersonalData(normalizeWhitespace(reflection.bestReason)),
        bestReasonEtc: reflection.bestReasonEtc
          ? redactPersonalData(normalizeWhitespace(reflection.bestReasonEtc))
          : null,
        improvementSessionId: reflection.improvementSessionId,
        improvementReason: reflection.improvementReason
          ? redactPersonalData(normalizeWhitespace(reflection.improvementReason))
          : null,
        improvementReasonEtc: reflection.improvementReasonEtc
          ? redactPersonalData(normalizeWhitespace(reflection.improvementReasonEtc))
          : null,
        workApplicationPoint: redactPersonalData(normalizeWhitespace(reflection.workApplicationPoint)),
      })),
    },
  };
}

export function validateJobReflectionAnalysisSources(result, payload) {
  const allowedSourceIds = new Set(payload.reflections.map((reflection) => reflection.sourceId));
  const referencedSourceIds = [
    ...result.analysisSourceIds,
    ...result.headquartersSourceIds,
    ...result.operationsSourceIds,
    ...result.recommendedActions.flatMap((action) => action.sourceIds),
  ];
  assertKnownSourceIds(referencedSourceIds, allowedSourceIds);
  if (result.sampleSize !== payload.reflections.length) {
    throw new Error("INVALID_SAMPLE_SIZE");
  }
}

export function projectJobReflectionAnalysisResult(result, payload, generatedAt = new Date().toISOString()) {
  validateJobReflectionAnalysisSources(result, payload);
  const reflectionById = new Map(payload.reflections.map((reflection, index) => [reflection.sourceId, {
    source: "jobReflection",
    by: `응답자 ${index + 1}`,
    quote: reflection.workApplicationPoint,
  }]));
  const evidenceSourceIds = uniqueSourceIds([
    ...result.analysisSourceIds,
    ...result.headquartersSourceIds,
    ...result.operationsSourceIds,
    ...result.recommendedActions.flatMap((action) => action.sourceIds),
  ]).slice(0, EVIDENCE_LIMIT);
  const dataWarning = payload.reflections.length < 3 && !result.dataWarning
    ? "응답 수가 적어 강의 효과나 개선 요구를 공통 경향으로 일반화하기 어렵습니다."
    : result.dataWarning;
  return {
    ...result,
    dataWarning,
    evidence: evidenceSourceIds.map((sourceId) => reflectionById.get(sourceId)),
    evidenceCount: evidenceSourceIds.length,
    generatedAt,
  };
}

export const missionDraftPayloadSchema = z.object({
  goal: taskSourceSchema.nullable().optional(),
  achievementResponses: z.array(taskSourceSchema).max(20),
  jobReflection: taskSourceSchema.nullable().optional(),
}).strict().superRefine((payload, context) => {
  const sources = [
    ...(payload.goal ? [payload.goal] : []),
    ...payload.achievementResponses,
    ...(payload.jobReflection ? [payload.jobReflection] : []),
  ];
  if (!sources.length) {
    context.addIssue({ code: "custom", message: "At least one mission source is required.", path: [] });
  }
  addUniqueSourceIssues(sources, context, "achievementResponses");
  addTotalTextIssue(sources, context, "achievementResponses");
});

export const missionDraftRequestSchema = z.object({
  task: z.literal("missionDraft"),
  courseCode: courseCodeSchema,
  payload: missionDraftPayloadSchema,
}).strict();

export const missionDraftOutputSchema = z.object({
  when: z.string().min(1).max(500),
  what: z.string().min(1).max(500),
  how: z.string().min(1).max(500),
}).strict();

export function normalizeMissionDraftRequest(value) {
  const parsed = missionDraftRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      goal: parsed.payload.goal ? normalizeSource(parsed.payload.goal) : null,
      achievementResponses: parsed.payload.achievementResponses.map(normalizeSource),
      jobReflection: parsed.payload.jobReflection ? normalizeSource(parsed.payload.jobReflection) : null,
    },
  };
}

export function projectMissionDraftResult(result, _payload, generatedAt = new Date().toISOString()) {
  return {
    missionText: `[언제] ${result.when} [무엇을] ${result.what} [어떻게] ${result.how}`,
    elements: { ...result },
    ...result,
    generatedAt,
  };
}

const reportTurnSchema = z.object({
  speaker: z.enum(["learner", "manager"]),
  text: z.string().trim().min(1).max(MAX_SOURCE_TEXT_LENGTH),
}).strict();

export const reportFeedbackPayloadSchema = z.object({
  scenario: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  difficulty: z.string().trim().min(1).max(50),
  turns: z.array(reportTurnSchema).min(1).max(MAX_REPORT_TURNS),
}).strict().superRefine((payload, context) => {
  addTotalTextIssue(payload.turns, context, "turns");
});

export const reportFeedbackRequestSchema = z.object({
  task: z.literal("reportFeedback"),
  courseCode: courseCodeSchema,
  payload: reportFeedbackPayloadSchema,
}).strict();

const reportScoreSchema = z.number().int().min(1).max(5);

export const reportFeedbackOutputSchema = z.object({
  summary: z.string().min(1).max(2_000),
  scores: z.object({
    conclusionFirst: reportScoreSchema,
    accuracy: reportScoreSchema,
    cause: reportScoreSchema,
    actionPlan: reportScoreSchema,
    requestClarity: reportScoreSchema,
    attitude: reportScoreSchema,
  }).strict(),
  firstFix: z.string().min(1).max(1_000),
}).strict();

export function normalizeReportFeedbackRequest(value) {
  const parsed = reportFeedbackRequestSchema.parse(value);
  return {
    task: parsed.task,
    courseCode: parsed.courseCode.toUpperCase(),
    payload: {
      scenario: redactPersonalData(normalizeWhitespace(parsed.payload.scenario)),
      difficulty: normalizeWhitespace(parsed.payload.difficulty),
      turns: parsed.payload.turns.map((turn) => ({
        speaker: turn.speaker,
        text: redactPersonalData(normalizeWhitespace(turn.text)),
      })),
    },
  };
}

export function projectReportFeedbackResult(result, _payload, generatedAt) {
  return withGeneratedAt(result, generatedAt);
}
