import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import {
  normalizeReportFeedbackRequest,
  projectReportFeedbackResult,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import { buildReportFeedbackRequest } from "../src/services/aiService.js";

const course = {
  code: "NH-2480",
  participantId: "private-participant",
  name: "실명",
};

const config = {
  scenario: "시재 차이 보고",
  difficulty: "보통",
  opening: "마감 시재 차이가 발생했습니다. 현재 상황을 보고해 보세요.",
};

const reportText = "현재 마감 시재가 장부보다 10만 원 부족합니다. 거래 내역을 다시 확인하고 있습니다.";
const followupQuestions = [
  "고객이나 다른 계정에 미친 영향은 어디까지입니까?",
  "지금 필요한 결정이나 지원은 무엇입니까?",
];
const followupAnswer = "현재 확인된 고객 영향은 없으며, 거래 원장 조회 승인을 요청드립니다.";

const modelResult = {
  summary: "결론과 현재 사실을 먼저 제시한 점은 좋지만, 원인 확인 시점과 후속 조치를 더 구체화할 필요가 있습니다.",
  scores: {
    conclusionFirst: 5,
    accuracy: 4,
    cause: 3,
    actionPlan: 4,
    requestClarity: 5,
    attitude: 5,
  },
  firstFix: "원인 확인 완료 시점과 다음 보고 시점을 한 문장으로 덧붙이세요.",
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
  process.env.OPENAI_API_KEY = "report-feedback-test-key";
  process.env.OPENAI_MODEL = "report-feedback-test-model";
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

test("보고 피드백 요청은 manager·learner 대화 순서를 보존하고 참여자 식별자를 제외한다", () => {
  const request = buildReportFeedbackRequest(
    course,
    config,
    reportText,
    followupQuestions,
    followupAnswer,
  );
  assert.equal(request.task, "reportFeedback");
  assert.deepEqual(request.payload.turns.map(({ speaker }) => speaker), [
    "manager",
    "learner",
    "manager",
    "manager",
    "learner",
  ]);
  assert.deepEqual(request.payload.turns.map(({ text }) => text), [
    config.opening,
    reportText,
    ...followupQuestions,
    followupAnswer,
  ]);
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("private-participant"), false);
  assert.equal(serialized.includes("실명"), false);
});

test("보고 피드백 정규화는 개인정보를 제거하고 서버 투영 시 생성 시각을 보존한다", () => {
  const request = buildReportFeedbackRequest(course, config, "연락처 010-1234-5678로 보고드립니다.", followupQuestions, followupAnswer);
  const normalized = normalizeReportFeedbackRequest(request);
  assert.equal(normalized.courseCode, "NH-2480");
  assert.equal(normalized.payload.turns[1].text.includes("010-1234-5678"), false);
  const projected = projectReportFeedbackResult(modelResult, normalized.payload, "2026-08-18T00:00:00.000Z");
  assert.equal(projected.generatedAt, "2026-08-18T00:00:00.000Z");
  assert.deepEqual(projected.scores, modelResult.scores);
});

test("reportFeedback는 독립 Structured Output 계약과 store:false를 사용한다", () => {
  const definition = AI_TASK_REGISTRY.reportFeedback;
  const payload = buildReportFeedbackRequest(course, config, reportText, followupQuestions, followupAnswer).payload;
  const request = definition.buildOpenAiRequest({
    model: "report-feedback-test-model",
    reasoningEffort: "medium",
    courseCode: course.code,
    payload,
  });
  assert.equal(definition.promptVersion, "report-feedback-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "report_feedback");
  assert.equal("tools" in request, false);
});

test("공통 API는 reportFeedback live 결과를 저장하고 같은 대화는 cache로 재사용한다", async () => {
  await withServerEnvironment(async () => {
    let cache = null;
    let openAiCalls = 0;
    const dependencies = {
      supabase: {},
      findActiveCourse: async () => ({ code: course.code }),
      findCachedAnalysis: async () => cache,
      openai: {
        responses: {
          parse: async () => {
            openAiCalls += 1;
            return {
              status: "completed",
              output: [],
              output_parsed: modelResult,
              usage: { input_tokens: 240, output_tokens: 100 },
              _request_id: "report-feedback-openai-request",
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
          created_at: "2026-08-18T00:00:00.000Z",
        };
        return { ok: true, createdAt: cache.created_at };
      },
    };
    const body = buildReportFeedbackRequest(course, config, reportText, followupQuestions, followupAnswer);
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.data.firstFix, modelResult.firstFix);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});
