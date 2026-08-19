import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import { buildJobReflectionAnalysisRequest } from "../src/services/aiService.js";

const course = {
  code: "NH-4001",
  jobSessions: [
    { id: "session-1", classId: "class-1", date: "2026-08-19", title: "계약실무" },
    { id: "session-2", classId: "class-1", date: "2026-08-19", title: "사고예방 사례" },
    { id: "session-other", classId: "class-2", date: "2026-08-19", title: "다른 반 강의" },
  ],
  jobReflections: [
    {
      id: "reflection-1",
      participantId: "participant-1",
      studentName: "교육생 실명",
      classId: "class-1",
      date: "2026-08-19",
      bestSessionId: "session-1",
      bestReason: "현업 적용 가능",
      bestReasonEtc: null,
      improvementSessionId: "session-2",
      improvementReason: "사례 보완 필요",
      improvementReasonEtc: null,
      workApplicationPoint: "계약서 확인 순서를 업무에 적용하겠습니다.",
    },
    {
      id: "reflection-other",
      participantId: "participant-2",
      studentName: "다른 반 교육생",
      classId: "class-2",
      date: "2026-08-19",
      bestSessionId: "session-other",
      bestReason: "도움 됨",
      improvementSessionId: "none",
      workApplicationPoint: "다른 반 응답입니다.",
    },
  ],
};

function modelOutput(payload) {
  const sourceIds = payload.reflections.map(({ sourceId }) => sourceId);
  return {
    analysis: "계약 서류의 확인 순서를 현업 행동으로 연결한 응답입니다.",
    analysisSourceIds: sourceIds,
    headquartersSummary: "사고예방 사례의 보완 요구를 다음 교안 검토에 반영할 수 있습니다.",
    headquartersSourceIds: sourceIds,
    operationsSummary: "현재 제출 범위에서 후속 회고 수집 여부를 확인할 수 있습니다.",
    operationsSourceIds: sourceIds,
    recommendedActions: [{
      audience: "headquarters",
      action: "입력 회고에 나온 사례 보완 요구를 교안 검토 항목에 포함하세요.",
      sourceIds,
    }],
    sampleSize: sourceIds.length,
    dataWarning: "응답 수가 적어 공통 경향으로 일반화하기 어렵습니다.",
  };
}

test("현재 반·일자의 회고만 비식별 AI 요청으로 만든다", () => {
  const request = buildJobReflectionAnalysisRequest(
    course,
    10,
    { id: "class-1", name: "1반" },
    "2026-08-19",
  );

  assert.equal(request.task, "jobReflectionAnalysis");
  assert.deepEqual(request.payload.sessions.map(({ sessionId }) => sessionId), ["session-1", "session-2"]);
  assert.equal(request.payload.reflections.length, 1);
  assert.equal(request.payload.reflections[0].sourceId, "job-reflection-01");
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("participant-1"), false);
  assert.equal(serialized.includes("교육생 실명"), false);
  assert.equal(serialized.includes("다른 반 응답"), false);
});

test("회고 AI task는 독립 Structured Output·sourceId 검증·store:false를 사용한다", () => {
  const request = buildJobReflectionAnalysisRequest(
    course,
    10,
    { id: "class-1", name: "1반" },
    "2026-08-19",
  );
  const definition = AI_TASK_REGISTRY.jobReflectionAnalysis;
  const normalized = definition.normalizeRequest(request);
  const output = modelOutput(normalized.payload);

  assert.doesNotThrow(() => definition.validateEvidence(output, normalized.payload));
  assert.throws(() => definition.validateEvidence({
    ...output,
    analysisSourceIds: ["unknown-reflection"],
  }, normalized.payload), /UNGROUNDED_SOURCE_ID/u);
  const openAiRequest = definition.buildOpenAiRequest({
    model: "fixture-model",
    reasoningEffort: "medium",
    courseCode: normalized.courseCode,
    payload: normalized.payload,
  });
  assert.equal(openAiRequest.store, false);
  assert.equal(openAiRequest.text.format.type, "json_schema");
  assert.equal(definition.promptVersion, "job-reflection-analysis-v1");
});

test("교수 화면은 live 오류에서 자동 집계 결과를 AI로 위장하지 않는다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /requestJobReflectionAnalysis/);
  assert.match(source, /AI 직무강의 회고 분석/);
  assert.match(source, /실제 AI 분석/);
  assert.match(source, /AI 분석 · 캐시/);
  assert.match(source, /다시 시도/);
  assert.doesNotMatch(source, /<span>자동 집계 요약<\/span>/);
});
