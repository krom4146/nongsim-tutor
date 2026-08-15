import assert from "node:assert/strict";
import test from "node:test";
import { createInputHash } from "../server/ai/aiPersistence.js";
import { buildGoalCohortOpenAiRequest } from "../server/ai/prompts.js";
import {
  goalCohortRequestSchema,
  normalizeGoalCohortRequest,
  projectGoalCohortResult,
  validateGoalCohortSources,
} from "../server/ai/schemas.js";
import { isAllowedOrigin, MAX_REQUEST_BYTES, readJsonBody } from "../server/ai/security.js";
import { buildGoalCohortRequest } from "../src/services/aiService.js";
import { handleAiRequest } from "../api/ai.js";

const goals = [
  { sourceId: "goal-01", text: "신속하게 보고하겠습니다." },
  { sourceId: "goal-02", text: "조합원 질문을 기록하겠습니다." },
];

const modelResult = {
  summary: "보고와 기록이 공통 목표입니다.",
  summarySourceIds: ["goal-01", "goal-02"],
  clusters: [{
    title: "보고와 기록",
    count: 2,
    insight: "업무 내용을 정확히 공유하려는 경향입니다.",
    sourceIds: ["goal-01", "goal-02"],
  }],
  recommendedActions: ["구체적인 실행 시점을 확인하세요."],
  followupQuestions: ["현장에서 언제 실행하겠습니까?"],
  sampleSize: 2,
  dataWarning: "표본이 적어 일반화하기 어렵습니다.",
};

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

async function invokeHandler(body, dependencies = {}) {
  const req = {
    method: "POST",
    headers: {
      origin: "https://preview.example.com",
      host: "preview.example.com",
      "content-type": "application/json",
    },
    body,
  };
  const res = createResponseRecorder();
  await handleAiRequest(req, res, dependencies);
  return res;
}

test("goalCohort 요청은 허용 필드만 받고 개인정보 필드를 거부한다", () => {
  const valid = { task: "goalCohort", courseCode: "NH-2480", payload: { classId: "class-1", className: "1반", goals } };
  assert.equal(goalCohortRequestSchema.safeParse(valid).success, true);
  assert.equal(goalCohortRequestSchema.safeParse({
    ...valid,
    payload: { ...valid.payload, goals: [{ ...goals[0], participantId: "private-id" }] },
  }).success, false);
  assert.equal(goalCohortRequestSchema.safeParse({ ...valid, task: "pollCluster" }).success, false);
});

test("서버 정규화는 연락처를 제거하고 sourceId 중복을 거부한다", () => {
  const normalized = normalizeGoalCohortRequest({
    task: "goalCohort",
    courseCode: "nh-2480",
    payload: { goals: [{ sourceId: "goal-01", text: "연락처 010-1234-5678 test@example.com" }] },
  });
  assert.equal(normalized.courseCode, "NH-2480");
  assert.equal(normalized.payload.goals[0].text.includes("010-1234-5678"), false);
  assert.equal(normalized.payload.goals[0].text.includes("test@example.com"), false);
  assert.throws(() => normalizeGoalCohortRequest({
    task: "goalCohort",
    courseCode: "NH-2480",
    payload: { goals: [goals[0], { ...goals[1], sourceId: "goal-01" }] },
  }));
});

test("모델이 존재하지 않는 sourceId나 틀린 표본 수를 반환하면 차단한다", () => {
  assert.doesNotThrow(() => validateGoalCohortSources(modelResult, goals));
  assert.throws(() => validateGoalCohortSources({
    ...modelResult,
    summarySourceIds: ["goal-99"],
  }, goals), /UNGROUNDED_SOURCE_ID/u);
  assert.throws(() => validateGoalCohortSources({ ...modelResult, sampleSize: 3 }, goals), /INVALID_SAMPLE_SIZE/u);
});

test("서버가 검증된 원문과 응답자 N 라벨을 투영한다", () => {
  const projected = projectGoalCohortResult(modelResult, goals, "2026-08-15T00:00:00.000Z");
  assert.deepEqual(projected.evidence.map(({ by, quote }) => ({ by, quote })), [
    { by: "응답자 1", quote: goals[0].text },
    { by: "응답자 2", quote: goals[1].text },
  ]);
  assert.equal(projected.generatedAt, "2026-08-15T00:00:00.000Z");
});

test("입력 hash는 객체 키 순서와 무관하다", () => {
  assert.equal(createInputHash({ a: 1, b: { c: 2 } }), createInputHash({ b: { c: 2 }, a: 1 }));
});

test("OpenAI 요청은 Responses Structured Output과 store:false를 사용한다", () => {
  const request = buildGoalCohortOpenAiRequest({
    model: "test-model",
    reasoningEffort: "medium",
    courseCode: "NH-2480",
    payload: { classId: null, className: null, goals },
  });
  assert.equal(request.model, "test-model");
  assert.equal(request.store, false);
  assert.equal(request.reasoning.effort, "medium");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal("tools" in request, false);
});

test("Origin은 동일 호스트 또는 명시된 허용 목록만 통과한다", () => {
  const sameHost = { headers: { origin: "https://preview.example.com", host: "preview.example.com" } };
  const configured = { headers: { origin: "https://app.example.com", host: "other.example.com" } };
  const denied = { headers: { origin: "https://evil.example", host: "preview.example.com" } };
  assert.equal(isAllowedOrigin(sameHost, ""), true);
  assert.equal(isAllowedOrigin(configured, "https://app.example.com"), true);
  assert.equal(isAllowedOrigin(denied, ""), false);
});

test("요청 body 크기 제한은 파싱 전에 적용된다", async () => {
  const request = {
    headers: { "content-length": String(MAX_REQUEST_BYTES + 1) },
    body: { task: "goalCohort" },
  };
  await assert.rejects(() => readJsonBody(request), (error) => error.code === "PAYLOAD_TOO_LARGE");
});

test("클라이언트는 이름과 참여자 식별자를 제외하고 순차 sourceId를 만든다", () => {
  const request = buildGoalCohortRequest({
    code: "NH-2480",
    goals: [{ id: "db-id", participantId: "person-id", name: "실명", text: "현장 목표" }],
  }, { id: "class-1", name: "1반" });
  assert.deepEqual(request.payload.goals, [{ sourceId: "goal-01", text: "현장 목표" }]);
  assert.equal(JSON.stringify(request).includes("실명"), false);
  assert.equal(JSON.stringify(request).includes("person-id"), false);
});

test("공통 API는 live 결과를 저장하고 같은 입력의 두 번째 호출은 cache를 반환한다", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalEffort = process.env.OPENAI_REASONING_EFFORT;
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  process.env.OPENAI_MODEL = "test-model";
  process.env.OPENAI_REASONING_EFFORT = "medium";

  let cache = null;
  let openAiCalls = 0;
  const dependencies = {
    supabase: {},
    findActiveCourse: async () => ({ code: "NH-2480" }),
    findCachedAnalysis: async () => cache,
    openai: {
      responses: {
        parse: async () => {
          openAiCalls += 1;
          return {
            status: "completed",
            output: [],
            output_parsed: modelResult,
            usage: { input_tokens: 100, output_tokens: 50 },
            _request_id: "safe-openai-request-id",
          };
        },
      },
    },
    saveAnalysis: async (_client, analysis) => {
      cache = {
        result: analysis.result,
        input_tokens: analysis.inputTokens,
        output_tokens: analysis.outputTokens,
        openai_request_id: analysis.openAiRequestId,
        created_at: "2026-08-15T00:00:00.000Z",
      };
      return { ok: true, createdAt: cache.created_at };
    },
  };
  const body = { task: "goalCohort", courseCode: "NH-2480", payload: { classId: "class-1", className: "1반", goals } };

  try {
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.meta.persisted, true);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  } finally {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    if (originalEffort === undefined) delete process.env.OPENAI_REASONING_EFFORT;
    else process.env.OPENAI_REASONING_EFFORT = originalEffort;
  }
});

test("공통 API는 다른 task와 비어 있는 목표를 안전한 코드로 거부한다", async () => {
  const wrongTask = await invokeHandler({ task: "pollCluster", courseCode: "NH-2480", payload: {} });
  const emptyGoals = await invokeHandler({ task: "goalCohort", courseCode: "NH-2480", payload: { goals: [] } });
  assert.equal(wrongTask.statusCode, 400);
  assert.equal(wrongTask.body.error.code, "INVALID_TASK");
  assert.equal(emptyGoals.statusCode, 422);
  assert.equal(emptyGoals.body.error.code, "INSUFFICIENT_DATA");
  assert.equal("stack" in wrongTask.body.error, false);
});

test("필수 OPENAI_MODEL 누락은 내부 정보 없이 설정 오류로 반환한다", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  delete process.env.OPENAI_MODEL;
  try {
    const response = await invokeHandler({
      task: "goalCohort",
      courseCode: "NH-2480",
      payload: { goals: [goals[0]] },
    }, { supabase: {} });
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.error.code, "SERVER_MISCONFIGURED");
    assert.equal("stack" in response.body.error, false);
  } finally {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});
