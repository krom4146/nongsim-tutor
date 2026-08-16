import assert from "node:assert/strict";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import { createInputHash } from "../server/ai/aiPersistence.js";
import {
  normalizeBoardAnalysisRequest,
  projectBoardAnalysisResult,
} from "../server/ai/schemas.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import {
  buildBoardAnalysisRequest,
} from "../src/services/aiService.js";

const course = {
  code: "NH-2480",
  participantId: "private-participant",
  name: "실명",
};

const round = {
  id: "private-board-round",
  kind: "board",
  prompt: "조합원 민원 대응 장표",
  classId: "class-1",
  className: "1반",
};

const item = {
  id: "private-board-row",
  participantId: "private-participant",
  by: "1팀",
  classId: "class-1",
  className: "1반",
  url: "https://fixture-project.supabase.co/storage/v1/object/public/board-images/NH-2480/board-01.jpg",
};

const modelResult = {
  status: "ok",
  scope: "모델이 만든 범위 문구",
  summary: "장표는 민원 상황에서 사실 확인과 신속한 공유 순서를 제시합니다.",
  common: ["행동 순서가 명확함", "현장 적용 질문이 포함됨"],
  action: "발표 후 첫 보고 문장을 직접 말하게 하세요.",
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
  const names = [
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_REASONING_EFFORT",
    "OPENAI_IMAGE_DETAIL",
    "SUPABASE_URL",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.OPENAI_API_KEY = "board-analysis-test-key";
  process.env.OPENAI_MODEL = "gpt-5.4-mini";
  process.env.OPENAI_REASONING_EFFORT = "medium";
  process.env.OPENAI_IMAGE_DETAIL = "high";
  process.env.SUPABASE_URL = "https://fixture-project.supabase.co";
  try {
    return await callback();
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
}

test("장표 분석 요청은 선택한 Supabase 이미지 한 장과 화면 범위만 전송한다", () => {
  const request = buildBoardAnalysisRequest(course, round, item);
  assert.equal(request.task, "boardAnalysis");
  assert.equal(request.courseCode, "NH-2480");
  assert.equal(request.payload.scopeLabel, "1팀 장표");
  assert.equal(request.payload.imageUrl, item.url);
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("private-participant"), false);
  assert.equal(serialized.includes("private-board-row"), false);
  assert.equal(serialized.includes("private-board-round"), false);
  assert.equal(serialized.includes("실명"), false);
});

test("장표 URL 정규화는 현재 Supabase 공개 board-images 경로만 허용한다", async () => {
  await withServerEnvironment(async () => {
    const request = buildBoardAnalysisRequest(course, round, item);
    const normalized = normalizeBoardAnalysisRequest(request);
    assert.equal(normalized.payload.imageUrl, item.url);
    assert.throws(() => normalizeBoardAnalysisRequest({
      ...request,
      payload: { ...request.payload, imageUrl: "https://evil.example/board.jpg" },
    }), /INVALID_BOARD_IMAGE_URL/u);
    assert.throws(() => normalizeBoardAnalysisRequest({
      ...request,
      payload: {
        ...request.payload,
        imageUrl: "https://fixture-project.supabase.co/storage/v1/object/public/other-bucket/board.jpg",
      },
    }), /INVALID_BOARD_IMAGE_URL/u);
  });
});

test("장표 결과 범위는 모델 문구 대신 검증된 scopeLabel로 서버가 확정한다", () => {
  const payload = buildBoardAnalysisRequest(course, round, item).payload;
  const projected = projectBoardAnalysisResult(modelResult, payload, "2026-08-16T00:00:00.000Z");
  assert.equal(projected.scope, "1팀 장표");
  assert.equal(projected.generatedAt, "2026-08-16T00:00:00.000Z");
});

test("boardAnalysis는 Responses 이미지 입력에 detail high와 store:false를 명시한다", () => {
  const definition = AI_TASK_REGISTRY.boardAnalysis;
  const payload = buildBoardAnalysisRequest(course, round, item).payload;
  const request = definition.buildOpenAiRequest({
    model: "gpt-5.4-mini",
    reasoningEffort: "medium",
    imageDetail: "high",
    courseCode: course.code,
    payload,
  });
  const imageParts = request.input
    .flatMap((entry) => Array.isArray(entry.content) ? entry.content : [])
    .filter((part) => part.type === "input_image");
  assert.equal(definition.promptVersion, "board-analysis-v1");
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "board_analysis");
  assert.equal(imageParts.length, 1);
  assert.equal(imageParts[0].image_url, item.url);
  assert.equal(imageParts[0].detail, "high");
});

test("장표 이미지 URL이 바뀌면 캐시 입력 hash도 바뀐다", async () => {
  await withServerEnvironment(async () => {
    const first = normalizeBoardAnalysisRequest(buildBoardAnalysisRequest(course, round, item));
    const second = normalizeBoardAnalysisRequest(buildBoardAnalysisRequest(course, round, {
      ...item,
      url: "https://fixture-project.supabase.co/storage/v1/object/public/board-images/NH-2480/board-02.jpg",
    }));
    assert.notEqual(createInputHash(first.payload), createInputHash(second.payload));
  });
});

test("boardAnalysis live 결과를 저장하고 같은 장표는 cache로 재사용한다", async () => {
  await withServerEnvironment(async () => {
    let cache = null;
    let openAiCalls = 0;
    let openAiRequest = null;
    const dependencies = {
      supabase: {},
      findActiveCourse: async () => ({ code: course.code }),
      findCachedAnalysis: async () => cache,
      openai: {
        responses: {
          parse: async (request) => {
            openAiCalls += 1;
            openAiRequest = request;
            return {
              status: "completed",
              output: [],
              output_parsed: modelResult,
              usage: { input_tokens: 420, output_tokens: 80 },
              _request_id: "board-analysis-openai-request",
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
    const body = buildBoardAnalysisRequest(course, round, item);
    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    const imagePart = openAiRequest.input[1].content.find((part) => part.type === "input_image");
    assert.equal(live.statusCode, 200);
    assert.equal(live.body.meta.source, "live");
    assert.equal(live.body.data.scope, "1팀 장표");
    assert.equal(imagePart.detail, "high");
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
  });
});

test("OPENAI_IMAGE_DETAIL이 없으면 boardAnalysis만 안전한 설정 오류를 반환한다", async () => {
  await withServerEnvironment(async () => {
    delete process.env.OPENAI_IMAGE_DETAIL;
    let openAiCalls = 0;
    const result = await invokeHandler(buildBoardAnalysisRequest(course, round, item), {
      supabase: {},
      findActiveCourse: async () => ({ code: course.code }),
      findCachedAnalysis: async () => null,
      openai: { responses: { parse: async () => { openAiCalls += 1; } } },
    });
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.error.code, "SERVER_MISCONFIGURED");
    assert.equal(openAiCalls, 0);
  });
});
