import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import {
  buildGoalComposeRequest,
} from "../src/services/aiService.js";
import {
  normalizeGoalComposeRequest,
  validateGoalComposeSources,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";

const questions = [
  "이번 교육에 참여하게 된 가장 큰 계기나 기대는 무엇인가요?",
  "현재 현업에서 가장 어렵거나 아쉽다고 느끼는 점은 무엇인가요?",
  "교육이 끝났을 때, 어떤 모습이 되어 있으면 ‘성공’이라고 느낄까요?",
];

const answers = [
  "조합원에게 처리 순서를 더 명확히 설명하고 싶습니다.",
  "민원이 생기면 핵심 사실과 요청을 짧게 정리하기 어렵습니다.",
  "결론과 다음 조치를 먼저 말할 수 있으면 성공이라고 생각합니다.",
];

const modelResult = {
  goalText: "이번 교육에서 민원 상황의 핵심 사실과 요청을 정리하고, 결론과 다음 조치를 먼저 설명하는 역량을 기르겠습니다.",
  focusPoint: "민원 상황에서 사실·영향·요청을 구분해 설명하는 순서에 집중하기",
  actionMission: "교육 후 첫 민원 상담에서 결론과 처리 순서를 먼저 안내하고 상담 기록에 남기기",
  sourceIds: ["goal-answer-01", "goal-answer-02", "goal-answer-03"],
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

async function withServerEnvironment(callback) {
  const names = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_REASONING_EFFORT"];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.OPENAI_API_KEY = "goal-compose-test-key";
  process.env.OPENAI_MODEL = "goal-compose-test-model";
  process.env.OPENAI_REASONING_EFFORT = "medium";
  try {
    return await callback();
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
}

test("목표 정리 요청은 3개 질문·답변만 보내고 참여자 식별자를 포함하지 않는다", () => {
  const request = buildGoalComposeRequest({
    code: "NH-2480",
    participantId: "person-private",
    name: "실명",
  }, questions, answers);
  assert.equal(request.task, "goalCompose");
  assert.equal(request.payload.answers.length, 3);
  assert.deepEqual(request.payload.answers.map(({ sourceId }) => sourceId), [
    "goal-answer-01",
    "goal-answer-02",
    "goal-answer-03",
  ]);
  assert.equal(JSON.stringify(request).includes("person-private"), false);
  assert.equal(JSON.stringify(request).includes("실명"), false);
});

test("목표 정리 정규화는 개인정보를 제거하고 추가 필드를 거부한다", () => {
  const body = buildGoalComposeRequest({ code: "nh-2480" }, questions, [
    "연락처 010-1234-5678로 안내받고 싶습니다.",
    answers[1],
    answers[2],
  ]);
  const normalized = normalizeGoalComposeRequest(body);
  assert.equal(normalized.courseCode, "NH-2480");
  assert.equal(normalized.payload.answers[0].text.includes("010-1234-5678"), false);
  assert.throws(() => normalizeGoalComposeRequest({
    ...body,
    payload: {
      answers: body.payload.answers.map((answer, index) => index === 0
        ? { ...answer, participantId: "private-id" }
        : answer),
    },
  }));
});

test("목표 정리 결과는 세 답변의 검증된 sourceIds를 모두 요구한다", () => {
  const payload = buildGoalComposeRequest({ code: "NH-2480" }, questions, answers).payload;
  assert.doesNotThrow(() => validateGoalComposeSources(modelResult, payload));
  assert.throws(() => validateGoalComposeSources({
    ...modelResult,
    sourceIds: ["goal-answer-01", "goal-answer-02", "goal-unknown"],
  }, payload), /UNGROUNDED_SOURCE_ID/u);
  assert.throws(() => validateGoalComposeSources({
    ...modelResult,
    sourceIds: ["goal-answer-01", "goal-answer-01", "goal-answer-02"],
  }, payload), /INCOMPLETE_SOURCE_COVERAGE/u);
});

test("goalCompose는 Responses Structured Output·store:false와 독립 promptVersion을 사용한다", () => {
  const definition = AI_TASK_REGISTRY.goalCompose;
  const payload = buildGoalComposeRequest({ code: "NH-2480" }, questions, answers).payload;
  const request = definition.buildOpenAiRequest({
    model: "goal-compose-test-model",
    reasoningEffort: "medium",
    courseCode: "NH-2480",
    payload,
  });
  assert.equal(definition.promptVersion, "goal-compose-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "goal_compose");
  assert.equal("tools" in request, false);
});

test("공통 API는 goalCompose live 결과를 저장하고 같은 입력은 cache로 재사용한다", async () => {
  await withServerEnvironment(async () => {
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
              usage: { input_tokens: 120, output_tokens: 60 },
              _request_id: "goal-compose-openai-request",
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
    const body = buildGoalComposeRequest({ code: "NH-2480" }, questions, answers);
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.data.goalText, modelResult.goalText);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});
