import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import {
  buildTransferReportRequest,
} from "../src/services/aiService.js";
import {
  normalizeTransferReportRequest,
  projectTransferReportResult,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";

const course = {
  code: "NH-2480",
  surveys: [
    {
      id: "private-survey-row-1",
      participantId: "private-participant-1",
      name: "실명 1",
      classId: "class-1",
      className: "1반",
      likert: [5, 4, 4, 5, 4],
      barriers: ["업무량·시간 부족"],
      applied: "민원 접수 직후 처리 예상 시간을 먼저 안내했습니다.",
      support: "상황별 보고 문장 예시가 더 필요합니다.",
    },
    {
      id: "private-survey-row-2",
      participantId: "private-participant-2",
      name: "실명 2",
      classId: "class-1",
      className: "1반",
      likert: [3, 3, 3, 4, 3],
      barriers: ["상사·동료의 지원 부족", "업무량·시간 부족"],
      applied: "회의 후 결정사항을 한 줄로 정리해 공유했습니다.",
      support: "팀장이 함께 확인하는 짧은 피드백 시간이 필요합니다.",
    },
  ],
};

const modelResult = {
  summary: "현업 적용 사례와 필요한 지원이 함께 확인됩니다.",
  successCase: { sourceIds: ["survey-01"] },
  blockedCase: { sourceIds: ["survey-02"] },
  appliedHighlights: [{ sourceIds: ["survey-01"] }],
  supportHighlights: [{ sourceIds: ["survey-02"] }],
  barriers: [
    { label: "업무량·시간 부족", count: 2 },
    { label: "상사·동료의 지원 부족", count: 1 },
  ],
  recommendedActions: ["관리자와 짧은 적용 점검 시간을 운영하세요."],
  dataWarning: "응답이 적어 공통 경향으로 일반화하기 어렵습니다.",
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
  process.env.OPENAI_API_KEY = "transfer-report-test-key";
  process.env.OPENAI_MODEL = "transfer-report-test-model";
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

test("전이 리포트 요청은 현재 반의 익명 설문 내용만 전송한다", () => {
  const request = buildTransferReportRequest(course, 12, { id: "class-1", name: "1반" });
  assert.equal(request.task, "transferReport");
  assert.equal(request.courseCode, "NH-2480");
  assert.equal(request.payload.participantCount, 12);
  assert.deepEqual(request.payload.surveys.map(({ sourceId }) => sourceId), ["survey-01", "survey-02"]);
  assert.deepEqual(request.payload.surveys[0].likert, [5, 4, 4, 5, 4]);
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("private-participant"), false);
  assert.equal(serialized.includes("private-survey-row"), false);
  assert.equal(serialized.includes("실명"), false);
});

test("전이 리포트 정규화와 투영은 개인정보를 제거하고 검증된 원문만 응답자 N으로 반환한다", () => {
  const request = buildTransferReportRequest({
    ...course,
    surveys: [{
      ...course.surveys[0],
      applied: "연락처 010-1234-5678로 상담 결과를 안내했습니다.",
    }, course.surveys[1]],
  }, 12, { id: "class-1", name: "1반" });
  const normalized = normalizeTransferReportRequest(request);
  assert.equal(normalized.payload.surveys[0].applied.includes("010-1234-5678"), false);

  const projected = projectTransferReportResult(modelResult, normalized.payload, "2026-08-15T00:00:00.000Z");
  assert.deepEqual(projected.successCase.evidence, [{
    by: "응답자 1",
    quote: normalized.payload.surveys[0].applied,
  }]);
  assert.deepEqual(projected.blockedCase.evidence, [{
    by: "응답자 2",
    quote: course.surveys[1].support,
  }]);
});

test("transferReport는 독립 Structured Output 계약과 store:false를 유지한다", () => {
  const definition = AI_TASK_REGISTRY.transferReport;
  const payload = buildTransferReportRequest(course, 12, { id: "class-1", name: "1반" }).payload;
  const request = definition.buildOpenAiRequest({
    model: "transfer-report-test-model",
    reasoningEffort: "medium",
    courseCode: course.code,
    payload,
  });
  assert.equal(definition.promptVersion, "transfer-report-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "transfer_report");
});

test("공통 API는 transferReport live 결과를 저장하고 같은 설문은 cache로 재사용한다", async () => {
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
              usage: { input_tokens: 150, output_tokens: 80 },
              _request_id: "transfer-report-openai-request",
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
    const body = buildTransferReportRequest(course, 12, { id: "class-1", name: "1반" });
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.data.successCase.evidence[0].by, "응답자 1");
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});
