import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import {
  normalizeMissionDraftRequest,
  projectMissionDraftResult,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import { buildMissionDraftRequest } from "../src/services/aiService.js";

const course = {
  code: "NH-2480",
  participantId: "private-course-participant",
  name: "과정 실명",
};

const goal = {
  id: "private-goal-id",
  participantId: "private-participant-id",
  name: "비공개 실명",
  goalText: "회의 결정사항을 명확하게 공유하고 싶습니다.",
};

const achievementAnswers = [
  "결론을 먼저 말하는 습관이 생겼습니다.",
  "요청사항을 구체적으로 말하는 연습이 더 필요합니다.",
  "다음 팀 회의에서 결정사항을 한 줄로 공유하겠습니다.",
];

const jobReflection = {
  id: "private-reflection-id",
  participantId: "private-participant-id",
  name: "비공개 실명",
  workApplicationPoint: "회의가 끝난 뒤 결정사항과 담당자를 바로 기록하겠습니다.",
};

const modelResult = {
  when: "다음 팀 회의가 끝난 직후",
  what: "결정사항과 담당자를 한 줄로 정리하고",
  how: "팀 공유 채널에 올린 뒤 게시 여부를 확인한다",
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
  process.env.OPENAI_API_KEY = "mission-draft-test-key";
  process.env.OPENAI_MODEL = "mission-draft-test-model";
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

test("현업 미션 요청은 목표·성찰·직무 회고만 보내고 참여자 식별자를 제외한다", () => {
  const request = buildMissionDraftRequest(course, goal, achievementAnswers, jobReflection);
  assert.equal(request.task, "missionDraft");
  assert.equal(request.courseCode, course.code);
  assert.deepEqual(request.payload.goal, {
    sourceId: "mission-goal-01",
    text: goal.goalText,
  });
  assert.deepEqual(request.payload.achievementResponses.map(({ sourceId }) => sourceId), [
    "mission-ach-01",
    "mission-ach-02",
    "mission-ach-03",
  ]);
  assert.deepEqual(request.payload.jobReflection, {
    sourceId: "mission-reflection-01",
    text: jobReflection.workApplicationPoint,
  });
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("private-participant-id"), false);
  assert.equal(serialized.includes("private-goal-id"), false);
  assert.equal(serialized.includes("private-reflection-id"), false);
  assert.equal(serialized.includes("비공개 실명"), false);
});

test("현업 미션 정규화는 개인정보를 제거하고 3요소를 편집 가능한 문장으로 투영한다", () => {
  const request = buildMissionDraftRequest(course, {
    ...goal,
    goalText: "연락처 010-1234-5678로 안내받고 싶습니다.",
  }, achievementAnswers, jobReflection);
  const normalized = normalizeMissionDraftRequest(request);
  assert.equal(normalized.courseCode, "NH-2480");
  assert.equal(normalized.payload.goal.text.includes("010-1234-5678"), false);

  const projected = projectMissionDraftResult(modelResult, normalized.payload, "2026-08-18T00:00:00.000Z");
  assert.equal(projected.missionText, `[언제] ${modelResult.when} [무엇을] ${modelResult.what} [어떻게] ${modelResult.how}`);
  assert.deepEqual(projected.elements, modelResult);
  assert.equal(projected.generatedAt, "2026-08-18T00:00:00.000Z");
});

test("missionDraft는 독립 Structured Output 계약과 store:false를 사용한다", () => {
  const definition = AI_TASK_REGISTRY.missionDraft;
  const payload = buildMissionDraftRequest(course, goal, achievementAnswers, jobReflection).payload;
  const request = definition.buildOpenAiRequest({
    model: "mission-draft-test-model",
    reasoningEffort: "medium",
    courseCode: course.code,
    payload,
  });
  assert.equal(definition.promptVersion, "mission-draft-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "mission_draft");
  assert.equal("tools" in request, false);
});

test("공통 API는 missionDraft live 결과를 저장하고 같은 입력은 cache로 재사용한다", async () => {
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
              usage: { input_tokens: 180, output_tokens: 70 },
              _request_id: "mission-draft-openai-request",
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
    const body = buildMissionDraftRequest(course, goal, achievementAnswers, jobReflection);
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.deepEqual(live.body.data.elements, modelResult);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});
