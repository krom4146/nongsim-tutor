import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import { buildPollClusterRequest } from "../src/services/aiService.js";
import {
  normalizePollClusterRequest,
  projectPollClusterResult,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";

const course = { code: "NH-2480" };
const round = {
  id: "private-round-row-1",
  kind: "poll",
  prompt: "업무 오류를 발견했을 때 가장 먼저 할 행동은 무엇인가요?",
  questionType: "subjective",
  questionIntent: "application",
  anonymous: true,
  classId: "class-1",
  className: "1반",
  items: [
    {
      id: "private-response-row-1",
      participantId: "private-participant-1",
      by: "실명 1",
      text: "영향 범위를 먼저 확인하고 팀장에게 즉시 공유합니다.",
      reactions: { agree: 5 },
    },
    {
      id: "private-response-row-2",
      participantId: "private-participant-2",
      by: "실명 2",
      text: "확인된 사실과 아직 모르는 내용을 구분해 보고합니다.",
      reactions: { agree: 3 },
    },
    {
      id: "private-response-row-3",
      participantId: "private-participant-3",
      by: "실명 3",
      text: "혼자 해결될 때까지 기다리지 않고 관련자에게 알립니다.",
      reactions: { agree: 4 },
    },
  ],
};

const modelResult = {
  summary: "오류의 영향 범위를 확인한 뒤 관계자에게 신속히 공유하려는 방향이 확인됩니다.",
  summarySourceIds: ["poll-01", "poll-02", "poll-03"],
  clusters: [{
    title: "확인 후 신속 공유",
    count: 3,
    insight: "사실과 영향 범위를 확인하고 혼자 해결하기 전에 공유하려는 응답입니다.",
    sourceIds: ["poll-01", "poll-02", "poll-03"],
  }],
  recommendedActions: ["확인과 보고의 순서를 30초 문장으로 말하게 하세요."],
  followupQuestions: ["가장 먼저 확인해야 할 영향 범위는 무엇입니까?"],
  teachingIntervention: {
    insufficientConcept: "확인한 사실과 추정을 구분하는 기준을 더 구체화해야 합니다.",
    confusionPoint: "확인을 마칠 때까지 보고를 늦춰도 되는지 혼동할 수 있습니다.",
    immediateQuestion: "지금 즉시 공유할 사실 한 가지는 무엇입니까?",
    miniLesson: "사실, 영향, 현재 조치, 요청 순서로 3분간 다시 설명합니다.",
    discussionTopic: "정확한 확인과 신속한 공유의 균형",
    evidenceSourceIds: ["poll-02"],
  },
  sampleSize: 3,
  dataWarning: null,
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
  process.env.OPENAI_API_KEY = "poll-cluster-test-key";
  process.env.OPENAI_MODEL = "poll-cluster-test-model";
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

test("실시간 답변 묶기 요청은 한 질문의 비식별 응답과 agree 수만 전송한다", () => {
  const request = buildPollClusterRequest(course, round);
  assert.equal(request.task, "pollCluster");
  assert.equal(request.courseCode, "NH-2480");
  assert.equal(request.payload.round.prompt, round.prompt);
  assert.deepEqual(request.payload.responses.map(({ sourceId, agree }) => ({ sourceId, agree })), [
    { sourceId: "poll-01", agree: 5 },
    { sourceId: "poll-02", agree: 3 },
    { sourceId: "poll-03", agree: 4 },
  ]);
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("private-participant"), false);
  assert.equal(serialized.includes("private-response-row"), false);
  assert.equal(serialized.includes("private-round-row"), false);
  assert.equal(serialized.includes("실명"), false);
});

test("pollCluster 정규화와 투영은 개인정보를 제거하고 검증된 원문만 반환한다", () => {
  const request = buildPollClusterRequest(course, {
    ...round,
    anonymous: false,
    items: [{
      ...round.items[0],
      text: "연락처 010-1234-5678로 알리기 전에 영향 범위를 확인합니다.",
    }, ...round.items.slice(1)],
  });
  const normalized = normalizePollClusterRequest(request);
  assert.equal(normalized.payload.responses[0].text.includes("010-1234-5678"), false);

  const projected = projectPollClusterResult(modelResult, normalized.payload, "2026-08-16T00:00:00.000Z");
  assert.equal(projected.evidence[0].by, "응답자 1");
  assert.equal(projected.evidence[0].quote, normalized.payload.responses[0].text);
  assert.equal(projected.teachingIntervention.evidence, normalized.payload.responses[1].text);
  assert.equal(projected.followupQuestions[0], modelResult.followupQuestions[0]);
});

test("pollCluster는 독립 Structured Output 계약과 store:false를 유지한다", () => {
  const definition = AI_TASK_REGISTRY.pollCluster;
  const payload = buildPollClusterRequest(course, round).payload;
  const request = definition.buildOpenAiRequest({
    model: "poll-cluster-test-model",
    reasoningEffort: "medium",
    courseCode: course.code,
    payload,
  });
  assert.equal(definition.promptVersion, "poll-cluster-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "poll_cluster_analysis");
});

test("공통 API는 pollCluster live 결과를 저장하고 같은 질문·응답은 cache로 재사용한다", async () => {
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
              usage: { input_tokens: 140, output_tokens: 70 },
              _request_id: "poll-cluster-openai-request",
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
          created_at: "2026-08-16T00:00:00.000Z",
        };
        return { ok: true, createdAt: cache.created_at };
      },
    };
    const body = buildPollClusterRequest(course, round);
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.data.evidence[0].by, "익명");
    assert.equal(live.body.data.followupQuestions[0], modelResult.followupQuestions[0]);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});
