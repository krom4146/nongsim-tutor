import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import { buildCompletionReflectionAnalysisRequest } from "../src/services/aiService.js";

const currentClassCourse = {
  code: "NH-5001",
  goals: [
    { participantId: "participant-1", name: "교육생 실명", goalText: "보고 첫 문장에 결론을 말하겠습니다." },
    { participantId: "participant-2", name: "다른 교육생", goalText: "상담 처리 순서를 먼저 설명하겠습니다." },
  ],
  achievements: [
    {
      participantId: "participant-1",
      name: "교육생 실명",
      answers: ["결론을 먼저 말하는 방법을 배웠습니다.", "반복 연습이 필요합니다."],
      text: "업무 보고에서 결론과 요청을 먼저 말해야 함을 배웠습니다.",
    },
    {
      participantId: "participant-2",
      name: "다른 교육생",
      answers: ["처리 순서를 짧게 정리하는 방법을 배웠습니다."],
      text: "상담 시작에 처리 순서와 예상 시간을 먼저 안내해야 함을 배웠습니다.",
    },
  ],
  missions: [
    { participantId: "participant-1", missionText: "이전 다짐", createdAt: "2026-08-19T09:00:00.000Z" },
    { participantId: "participant-1", missionText: "다음 보고 첫 문장에 결론과 요청을 말하겠습니다.", createdAt: "2026-08-19T10:00:00.000Z" },
    { participantId: "participant-2", missionText: "다음 상담에서 처리 순서를 먼저 안내하겠습니다.", createdAt: "2026-08-19T10:00:00.000Z" },
  ],
};

function modelOutput(payload) {
  const sourceIds = payload.reflections.map(({ sourceId }) => sourceId);
  return {
    summary: "수료 성찰에서 배운 내용을 실제 업무 행동으로 옮기려는 방향이 나타납니다.",
    summarySourceIds: sourceIds,
    goalAlignment: "입교 전 목표보다 실행할 상황과 행동이 더 구체적으로 표현되었습니다.",
    goalAlignmentSourceIds: sourceIds,
    themes: [{
      title: "첫 행동 구체화",
      count: sourceIds.length,
      insight: "응답자는 보고와 상담의 첫 행동을 구체적으로 적었습니다.",
      sourceIds,
    }],
    practiceCommitments: [{
      commitment: "다음 보고나 상담에서 정한 첫 행동을 실행합니다.",
      sourceIds,
    }],
    recommendedActions: [{
      action: "2개월 후 조사에서 해당 행동의 실행 여부를 확인하세요.",
      sourceIds,
    }],
    sampleSize: sourceIds.length,
    dataWarning: "응답 수가 적어 전체 교육생의 경향으로 일반화하기 어렵습니다.",
  };
}

test("수료 성찰 요청은 목표·성찰·최신 미션만 응답자 순번으로 비식별 연결한다", () => {
  const request = buildCompletionReflectionAnalysisRequest(
    currentClassCourse,
    10,
    { id: "class-1", name: "1반" },
  );

  assert.equal(request.task, "completionReflectionAnalysis");
  assert.equal(request.payload.classId, "class-1");
  assert.equal(request.payload.participantCount, 10);
  assert.deepEqual(request.payload.reflections.map(({ sourceId }) => sourceId), [
    "completion-reflection-01",
    "completion-reflection-02",
  ]);
  assert.equal(request.payload.reflections[0].goal, "보고 첫 문장에 결론을 말하겠습니다.");
  assert.equal(request.payload.reflections[0].mission, "다음 보고 첫 문장에 결론과 요청을 말하겠습니다.");
  assert.equal(request.payload.reflections[0].answers.length, 2);
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("participant-1"), false);
  assert.equal(serialized.includes("교육생 실명"), false);
  assert.equal(serialized.includes("이전 다짐"), false);
});

test("수료 성찰 task는 독립 Structured Output·sourceId 검증·store:false를 사용한다", () => {
  const request = buildCompletionReflectionAnalysisRequest(
    currentClassCourse,
    10,
    { id: "class-1", name: "1반" },
  );
  const definition = AI_TASK_REGISTRY.completionReflectionAnalysis;
  const normalized = definition.normalizeRequest(request);
  const output = modelOutput(normalized.payload);

  assert.doesNotThrow(() => definition.validateEvidence(output, normalized.payload));
  assert.throws(() => definition.validateEvidence({
    ...output,
    summarySourceIds: ["unknown-completion-reflection"],
  }, normalized.payload), /UNGROUNDED_SOURCE_ID/u);
  assert.throws(() => definition.validateEvidence({
    ...output,
    sampleSize: 3,
  }, normalized.payload), /INVALID_SAMPLE_SIZE/u);
  const projected = definition.projectResult(output, normalized.payload, "2026-08-20T00:00:00.000Z");
  assert.deepEqual(projected.evidence.map(({ by }) => by), ["응답자 1", "응답자 2"]);
  assert.equal(JSON.stringify(projected).includes("participant-1"), false);

  const openAiRequest = definition.buildOpenAiRequest({
    model: "fixture-model",
    reasoningEffort: "medium",
    courseCode: normalized.courseCode,
    payload: normalized.payload,
  });
  assert.equal(openAiRequest.store, false);
  assert.equal(openAiRequest.text.format.type, "json_schema");
  assert.equal(definition.promptVersion, "completion-reflection-analysis-v1");
});

test("교수 화면은 일반 AI 탭 없이 수료 성찰 화면에서 live·캐시·오류 상태를 표시한다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /requestCompletionReflectionAnalysis/);
  assert.match(source, /수료 성찰 AI 분석/);
  assert.match(source, /실제 수료 성찰 AI 분석/);
  assert.match(source, /수료 성찰 AI 분석 · 캐시/);
  assert.match(source, /다시 시도/);
  assert.doesNotMatch(source, /\["ai",\s*"AI 분석"\]/);
  assert.doesNotMatch(source, /openAnalysis\("all"\)/);
});
