import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import { createInputHash } from "../server/ai/aiPersistence.js";
import { MAX_REQUEST_BYTES } from "../server/ai/security.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";

const fixtures = JSON.parse(await readFile(
  new URL("../docs/fixtures/openai-task-inputs.json", import.meta.url),
  "utf8",
));

const UNSUPPORTED_FACTS = ["서울지점", "매출 37%", "고객 100명", "3개월 만에"];
const DIRECT_IDENTIFIERS = [
  "김민수",
  "AB-12345",
  "privacy.fixture@example.com",
  "010-1234-5678",
  "900101-1234567",
];
const PII_TEXT = "성명은 김민수입니다. 사번은 AB-12345, 이메일 privacy.fixture@example.com, 전화 010-1234-5678, 주민번호 900101-1234567.";

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

async function invokeHandler(body, dependencies = {}, request = {}) {
  const req = {
    method: request.method || "POST",
    headers: {
      origin: "https://preview.example.com",
      host: "preview.example.com",
      "content-type": "application/json",
      ...(request.headers || {}),
    },
    body: request.rawBody ?? body,
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
  process.env.OPENAI_API_KEY = "step-d-fixture-key";
  process.env.OPENAI_MODEL = "step-d-fixture-model";
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

function barrierCounts(surveys) {
  const counts = new Map();
  surveys.forEach((survey) => {
    [...new Set(survey.barriers)].forEach((barrier) => counts.set(barrier, (counts.get(barrier) || 0) + 1));
  });
  return [...counts].map(([label, count]) => ({ label, count }));
}

function groundedOutput(task, payload) {
  if (task === "goalCohort") {
    const sourceIds = payload.goals.map(({ sourceId }) => sourceId);
    return {
      summary: "입력 목표에는 업무 설명과 확인 습관을 개선하려는 방향이 나타납니다.",
      summarySourceIds: sourceIds,
      clusters: [{ title: "업무 적용", count: sourceIds.length, insight: "입력 목표를 현업 행동으로 연결하려는 응답입니다.", sourceIds }],
      recommendedActions: ["실행할 상황과 확인 방법을 교육 중 질문하세요."],
      followupQuestions: ["어떤 업무 상황에서 먼저 실천하겠습니까?"],
      sampleSize: sourceIds.length,
      dataWarning: sourceIds.length < 3 ? "표본이 적어 일반화하기 어렵습니다." : null,
    };
  }
  if (task === "goalCompose") {
    return {
      goalText: "답변에서 정한 업무 습관을 교육 후 현업에서 실천하겠습니다.",
      focusPoint: "답변에서 언급한 어려움을 개선하는 방법에 집중합니다.",
      actionMission: "답변에서 정한 행동을 실제 업무에서 실행하고 확인합니다.",
      sourceIds: payload.answers.map(({ sourceId }) => sourceId),
    };
  }
  if (task === "pollCluster") {
    const sourceIds = payload.responses.map(({ sourceId }) => sourceId);
    return {
      summary: "입력 응답에서 확인과 공유에 관한 판단 방향이 나타납니다.",
      summarySourceIds: sourceIds,
      clusters: [{ title: "확인과 공유", count: sourceIds.length, insight: "입력 응답에 나타난 판단을 함께 묶었습니다.", sourceIds }],
      recommendedActions: ["판단의 근거를 응답 원문과 함께 확인하세요."],
      followupQuestions: ["그 판단에서 가장 먼저 확인할 것은 무엇입니까?"],
      teachingIntervention: {
        insufficientConcept: "응답에 나타난 판단 근거를 더 구체화할 필요가 있습니다.",
        confusionPoint: "확인과 공유의 순서를 구분해 볼 수 있습니다.",
        immediateQuestion: "가장 먼저 확인할 사실은 무엇입니까?",
        miniLesson: "확인된 사실과 아직 모르는 내용을 나누어 설명합니다.",
        discussionTopic: "정확한 확인과 신속한 공유의 균형",
        evidenceSourceIds: [sourceIds[0]],
      },
      sampleSize: sourceIds.length,
      dataWarning: sourceIds.length < 3 ? "표본이 적어 일반화하기 어렵습니다." : null,
    };
  }
  if (task === "boardAnalysis") {
    const unreadable = payload.imageUrl.includes("unreadable");
    return {
      status: unreadable ? "unreadable" : "ok",
      scope: payload.scopeLabel,
      summary: unreadable ? "핵심 텍스트를 신뢰할 수 없어 원본 확인이 필요합니다." : "이미지에서 읽을 수 있는 내용만 요약했습니다.",
      common: unreadable ? [] : ["읽을 수 있는 핵심 내용이 제시되어 있습니다."],
      action: unreadable ? "고해상도 원본으로 다시 확인하세요." : "이미지 원문과 분석 내용을 교수요원이 함께 검토하세요.",
    };
  }
  if (task === "transferReport") {
    const sourceIds = payload.surveys.map(({ sourceId }) => sourceId);
    return {
      summary: "입력 설문에는 적용 사례와 필요한 지원이 함께 나타납니다.",
      successCase: { sourceIds: [sourceIds[0]] },
      blockedCase: { sourceIds: [sourceIds.at(-1)] },
      appliedHighlights: [{ sourceIds: [sourceIds[0]] }],
      supportHighlights: [{ sourceIds: [sourceIds.at(-1)] }],
      barriers: barrierCounts(payload.surveys),
      recommendedActions: ["설문 원문에 나온 지원 요구를 교육 운영에 반영할지 검토하세요."],
      dataWarning: sourceIds.length < 3 ? "응답이 적어 인과로 일반화하기 어렵습니다." : null,
    };
  }
  if (task === "missionDraft") {
    return {
      when: "입력에서 언급한 다음 업무 상황에서",
      what: "입력에서 정한 행동을 실행하고",
      how: "실행 여부를 확인할 수 있게 기록합니다.",
    };
  }
  return {
    summary: "대화에 드러난 보고 내용과 개선 방향을 함께 정리했습니다.",
    scores: {
      conclusionFirst: 3,
      accuracy: 3,
      cause: 3,
      actionPlan: 3,
      requestClarity: 3,
      attitude: 3,
    },
    firstFix: "대화에서 확인된 내용만 사용해 첫 문장의 결론과 요청을 더 분명히 말하세요.",
  };
}

function outputText(value) {
  return JSON.stringify(value);
}

function assertNoUnsupportedFacts(value) {
  const text = outputText(value);
  UNSUPPORTED_FACTS.forEach((fact) => assert.equal(text.includes(fact), false, `원본에 없는 사실: ${fact}`));
  assert.doesNotMatch(text, /교육.{0,20}(때문|덕분).{0,20}(매출|성과).{0,10}(증가|향상|달성)/u);
}

function inputEvidenceTexts(task, payload) {
  if (task === "goalCohort") return payload.goals.map(({ text }) => text);
  if (task === "pollCluster") return payload.responses.map(({ text }) => text);
  if (task === "transferReport") return payload.surveys.flatMap(({ applied, support }) => [applied, support]);
  return [];
}

function projectedEvidenceTexts(task, projected) {
  if (task === "goalCohort" || task === "pollCluster") return projected.evidence.map(({ quote }) => quote);
  if (task === "transferReport") {
    return [
      ...projected.successCase.evidence,
      ...projected.blockedCase.evidence,
      ...projected.appliedHighlights.flatMap(({ evidence }) => evidence),
      ...projected.supportHighlights.flatMap(({ evidence }) => evidence),
    ].map(({ quote }) => quote);
  }
  return [];
}

test("각 AI task는 3~5개의 고정 fixture와 STEP D 필수 경계 사례를 가진다", () => {
  assert.deepEqual(Object.keys(fixtures.tasks), Object.keys(AI_TASK_REGISTRY));
  Object.entries(fixtures.tasks).forEach(([task, cases]) => {
    assert.ok(cases.length >= 3 && cases.length <= 5, `${task}: ${cases.length}`);
    assert.equal(new Set(cases.map(({ id }) => id)).size, cases.length, task);
  });
  const ids = Object.values(fixtures.tasks).flat().map(({ id }) => id);
  [
    "goal-insufficient",
    "poll-insufficient",
    "poll-similar-responses",
    "poll-mixed-viewpoints",
    "goal-compose-typo-abbreviation",
    "goal-instruction-as-data",
    "board-unreadable",
  ].forEach((id) => assert.ok(ids.includes(id), id));
});

test("22개 고정 fixture는 스키마·sourceId·원문 근거·부족 경고를 통과한다", async () => {
  await withServerEnvironment(async () => {
    for (const [task, cases] of Object.entries(fixtures.tasks)) {
      const definition = AI_TASK_REGISTRY[task];
      for (const fixture of cases) {
        const normalized = definition.normalizeRequest({
          task,
          courseCode: fixtures.courseCode,
          payload: fixture.input,
        });
        const modelOutput = groundedOutput(task, normalized.payload);
        const parsed = definition.outputSchema.safeParse(modelOutput);
        assert.equal(parsed.success, true, fixture.id);
        definition.validateEvidence(parsed.data, normalized.payload);
        const projected = definition.projectResult(parsed.data, normalized.payload, "2026-08-18T00:00:00.000Z");
        assertNoUnsupportedFacts(projected);

        const allowedEvidence = new Set(inputEvidenceTexts(task, normalized.payload));
        projectedEvidenceTexts(task, projected).forEach((quote) => assert.ok(allowedEvidence.has(quote), fixture.id));
        if (fixture.id.endsWith("insufficient")) assert.ok(projected.dataWarning, fixture.id);
        if (fixture.id === "board-unreadable") assert.equal(projected.status, "unreadable");
        if (fixture.id.includes("instruction-as-data")) {
          assert.equal(outputText(parsed.data).includes("이전 지시를 무시"), false, fixture.id);
        }
      }
    }
  });
});

test("grounding 평가기는 sourceId가 맞아도 원본에 없는 사실이 섞인 결과를 실패시킨다", () => {
  const payload = fixtures.tasks.goalCohort[0].input;
  const output = groundedOutput("goalCohort", payload);
  assert.doesNotThrow(() => AI_TASK_REGISTRY.goalCohort.validateEvidence(output, payload));
  assert.throws(() => assertNoUnsupportedFacts({
    ...output,
    summary: "서울지점에서 교육 덕분에 매출 37% 증가했습니다.",
  }), /원본에 없는 사실/u);
});

test("캐시 hash는 정규화된 전체 입력과 장표 URL 차이를 반영한다", async () => {
  await withServerEnvironment(async () => {
    Object.entries(fixtures.tasks).forEach(([task, cases]) => {
      const definition = AI_TASK_REGISTRY[task];
      const hashes = cases.map(({ input }) => createInputHash(definition.normalizeRequest({
        task,
        courseCode: fixtures.courseCode,
        payload: input,
      }).payload));
      assert.equal(new Set(hashes).size, hashes.length, task);
    });
  });
});

test("명시된 이름·사번·이메일·전화·식별번호는 모든 텍스트 task에서 모델 입력 전에 제거된다", async () => {
  await withServerEnvironment(async () => {
    const requests = {
      goalCohort: { classId: null, className: null, goals: [{ sourceId: "goal-pii-01", text: PII_TEXT }] },
      goalCompose: { answers: [1, 2, 3].map((number) => ({ sourceId: `goal-pii-${number}`, question: `질문 ${number}`, text: number === 1 ? PII_TEXT : "업무 답변" })) },
      pollCluster: { round: { sourceId: "round-pii", prompt: PII_TEXT, questionType: "subjective", questionIntent: "general", anonymous: true }, responses: [{ sourceId: "poll-pii-01", text: PII_TEXT, agree: 0 }] },
      transferReport: { classId: null, className: null, participantCount: 1, surveys: [{ sourceId: "survey-pii-01", likert: [3, 3, 3, 3, 3], barriers: [], applied: PII_TEXT, support: PII_TEXT }] },
      missionDraft: { goal: { sourceId: "mission-pii-01", text: PII_TEXT }, achievementResponses: [], jobReflection: null },
      reportFeedback: { scenario: PII_TEXT, difficulty: "보통", turns: [{ speaker: "learner", text: PII_TEXT }] },
      boardAnalysis: { classId: null, className: null, moduleTitle: PII_TEXT, scopeLabel: "1팀", imageUrl: "https://fixture-project.supabase.co/storage/v1/object/public/board-images/NH-2480/pii.jpg" },
    };

    Object.entries(requests).forEach(([task, payload]) => {
      const normalized = AI_TASK_REGISTRY[task].normalizeRequest({ task, courseCode: fixtures.courseCode, payload });
      const serialized = JSON.stringify(normalized.payload);
      DIRECT_IDENTIFIERS.forEach((identifier) => assert.equal(serialized.includes(identifier), false, `${task}: ${identifier}`));
      assert.match(serialized, /\[(이름|사번|이메일|전화번호|식별번호) 제거\]/u, task);
    });
  });
});

test("빈 데이터·매우 긴 입력·잘못된 장표 URL은 안전하게 거부된다", async () => {
  await withServerEnvironment(async () => {
    const emptyCases = [
      { task: "goalCohort", payload: { goals: [] } },
      { task: "pollCluster", payload: { responses: [] } },
      { task: "transferReport", payload: { surveys: [] } },
      { task: "missionDraft", payload: { goal: null, achievementResponses: [], jobReflection: null } },
      { task: "reportFeedback", payload: { turns: [] } },
    ];
    for (const { task, payload } of emptyCases) {
      const response = await invokeHandler({ task, courseCode: fixtures.courseCode, payload });
      assert.equal(response.statusCode, 422, task);
      assert.equal(response.body.error.code, "INSUFFICIENT_DATA", task);
    }

    const longValid = {
      task: "goalCohort",
      courseCode: fixtures.courseCode,
      payload: { goals: Array.from({ length: 10 }, (_, index) => ({ sourceId: `long-${index}`, text: "가".repeat(2_000) })) },
    };
    assert.doesNotThrow(() => AI_TASK_REGISTRY.goalCohort.normalizeRequest(longValid));
    assert.equal(AI_TASK_REGISTRY.goalCohort.requestSchema.safeParse({
      ...longValid,
      payload: { goals: [{ sourceId: "too-long", text: "가".repeat(2_001) }] },
    }).success, false);

    const invalidBoard = await invokeHandler({
      task: "boardAnalysis",
      courseCode: fixtures.courseCode,
      payload: { ...fixtures.tasks.boardAnalysis[0].input, imageUrl: "https://invalid.example/board.jpg" },
    });
    assert.equal(invalidBoard.statusCode, 422);
    assert.equal(invalidBoard.body.error.code, "INVALID_PAYLOAD");
  });
});

test("HTTP 입력 예외는 method·media type·JSON·body·Origin별 안전 코드로 구분된다", async () => {
  const method = await invokeHandler({}, {}, { method: "GET" });
  const media = await invokeHandler({}, {}, { headers: { "content-type": "text/plain" } });
  const malformed = await invokeHandler(null, {}, { rawBody: "{not-json" });
  const oversized = await invokeHandler(null, {}, {
    rawBody: JSON.stringify({ text: "가".repeat(MAX_REQUEST_BYTES) }),
    headers: { "content-length": String(MAX_REQUEST_BYTES * 3) },
  });
  const origin = await invokeHandler({}, {}, { headers: { origin: "https://invalid.example" } });

  assert.deepEqual([
    [method.statusCode, method.body.error.code],
    [media.statusCode, media.body.error.code],
    [malformed.statusCode, malformed.body.error.code],
    [oversized.statusCode, oversized.body.error.code],
    [origin.statusCode, origin.body.error.code],
  ], [
    [405, "METHOD_NOT_ALLOWED"],
    [415, "UNSUPPORTED_MEDIA_TYPE"],
    [422, "INVALID_PAYLOAD"],
    [413, "PAYLOAD_TOO_LARGE"],
    [403, "INVALID_PAYLOAD"],
  ]);
  [method, media, malformed, oversized, origin].forEach((response) => {
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal("stack" in response.body.error, false);
  });
});

test("OpenAI 장애는 임시 429·할당량·timeout·설정 오류·refusal·incomplete로 구분된다", async () => {
  await withServerEnvironment(async () => {
    const body = { task: "goalCohort", courseCode: fixtures.courseCode, payload: fixtures.tasks.goalCohort[0].input };
    const common = {
      supabase: {},
      findActiveCourse: async () => ({ code: fixtures.courseCode }),
      findCachedAnalysis: async () => null,
      saveAnalysis: async () => ({ ok: true }),
    };
    const cases = [
      [{ status: 429, code: "rate_limit_exceeded" }, 429, "RATE_LIMITED"],
      [{ status: 429, code: "insufficient_quota" }, 429, "QUOTA_EXCEEDED"],
      [{ name: "APIUserAbortError" }, 504, "TIMEOUT"],
      [{ status: 404, code: "model_not_found" }, 500, "SERVER_MISCONFIGURED"],
      [{ status: 401, code: "invalid_api_key" }, 500, "SERVER_MISCONFIGURED"],
    ];
    for (const [upstreamError, status, code] of cases) {
      const response = await invokeHandler(body, {
        ...common,
        openai: { responses: { parse: async () => { throw upstreamError; } } },
      });
      assert.equal(response.statusCode, status, code);
      assert.equal(response.body.error.code, code);
      assert.equal(JSON.stringify(response.body).includes(upstreamError.code || upstreamError.name), false);
    }

    const refusal = await invokeHandler(body, {
      ...common,
      openai: { responses: { parse: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "internal refusal" }] }] }) } },
    });
    const incomplete = await invokeHandler(body, {
      ...common,
      openai: { responses: { parse: async () => ({ status: "incomplete", output: [], output_parsed: null }) } },
    });
    assert.equal(refusal.body.error.code, "MODEL_REFUSAL");
    assert.equal(incomplete.body.error.code, "INCOMPLETE_OUTPUT");
  });
});

test("저장·캐시·토큰·지연 로그는 원문 없이 재사용되고 저장 실패는 경고로 남는다", async () => {
  await withServerEnvironment(async () => {
    const body = { task: "goalCohort", courseCode: fixtures.courseCode, payload: fixtures.tasks.goalCohort[0].input };
    const normalized = AI_TASK_REGISTRY.goalCohort.normalizeRequest(body);
    const modelOutput = groundedOutput("goalCohort", normalized.payload);
    let cache = null;
    let openAiCalls = 0;
    let nowValue = 1_000;
    let savedAnalysis = null;
    const events = [];
    const dependencies = {
      now: () => nowValue,
      logAiEvent: (level, details) => events.push({ level, ...details }),
      supabase: {},
      findActiveCourse: async () => ({ code: fixtures.courseCode }),
      findCachedAnalysis: async () => cache,
      openai: { responses: { parse: async () => {
        openAiCalls += 1;
        nowValue = 1_725;
        return {
          status: "completed",
          output: [],
          output_parsed: modelOutput,
          usage: { input_tokens: 321, output_tokens: 123 },
          _request_id: "step-d-request-id",
        };
      } } },
      saveAnalysis: async (_client, analysis) => {
        savedAnalysis = analysis;
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

    const live = await invokeHandler(body, dependencies);
    const cached = await invokeHandler(body, dependencies);
    assert.equal(live.body.meta.source, "live");
    assert.equal(cached.body.meta.source, "cache");
    assert.equal(openAiCalls, 1);
    assert.equal(savedAnalysis.inputTokens, 321);
    assert.equal(savedAnalysis.outputTokens, 123);
    assert.equal("payload" in savedAnalysis, false);
    assert.equal("prompt" in savedAnalysis, false);
    assert.deepEqual(events[0], {
      level: "info",
      requestId: events[0].requestId,
      openAiRequestId: "step-d-request-id",
      task: "goalCohort",
      model: "step-d-fixture-model",
      promptVersion: "goal-cohort-v1",
      source: "live",
      persisted: true,
      inputTokens: 321,
      outputTokens: 123,
      durationMs: 725,
    });
    assert.equal(outputText(events).includes(normalized.payload.goals[0].text), false);

    const unsavedBody = {
      ...body,
      payload: fixtures.tasks.goalCohort[1].input,
    };
    const unsavedOutput = groundedOutput(
      "goalCohort",
      AI_TASK_REGISTRY.goalCohort.normalizeRequest(unsavedBody).payload,
    );
    const unsaved = await invokeHandler(unsavedBody, {
      ...dependencies,
      findCachedAnalysis: async () => null,
      openai: { responses: { parse: async () => ({
        status: "completed",
        output: [],
        output_parsed: unsavedOutput,
        usage: { input_tokens: 111, output_tokens: 55 },
        _request_id: "step-d-unsaved-request-id",
      }) } },
      saveAnalysis: async () => ({ ok: false, duplicate: false }),
    });
    assert.equal(unsaved.statusCode, 200);
    assert.equal(unsaved.body.meta.persisted, false);
    assert.equal(unsaved.body.warning.code, "RESULT_NOT_SAVED");
  });
});

test("필수 서버 환경변수 누락은 비밀값과 내부 오류 없이 설정 오류를 반환한다", async () => {
  await withServerEnvironment(async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await invokeHandler({
        task: "goalCohort",
        courseCode: fixtures.courseCode,
        payload: fixtures.tasks.goalCohort[0].input,
      });
      assert.equal(response.statusCode, 500);
      assert.equal(response.body.error.code, "SERVER_MISCONFIGURED");
      assert.equal(JSON.stringify(response.body).includes("OPENAI_API_KEY"), false);
    } finally {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
