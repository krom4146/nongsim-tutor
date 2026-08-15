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
    .replace(/(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/gu, "[전화번호 제거]");
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
