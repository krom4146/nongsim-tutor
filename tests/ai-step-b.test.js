import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleAiRequest } from "../api/ai.js";
import { AI_TASK_REGISTRY } from "../server/ai/taskRegistry.js";
import { normalizeBoardAnalysisRequest } from "../server/ai/schemas.js";

const fixtures = JSON.parse(await readFile(
  new URL("../docs/fixtures/openai-task-inputs.json", import.meta.url),
  "utf8",
));

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

function makeGoalOutput(payload) {
  const sourceIds = payload.goals.map((goal) => goal.sourceId);
  return {
    summary: "목표 응답의 공통 실행 방향입니다.",
    summarySourceIds: sourceIds,
    clusters: [{
      title: "실행 목표",
      count: sourceIds.length,
      insight: "업무에 적용할 행동을 구체화하려는 경향입니다.",
      sourceIds,
    }],
    recommendedActions: ["실행 시점과 확인 방법을 질문하세요."],
    followupQuestions: ["언제 가장 먼저 실행하겠습니까?"],
    sampleSize: sourceIds.length,
    dataWarning: sourceIds.length < 3 ? "표본이 적어 일반화하기 어렵습니다." : null,
  };
}

function makeGoalComposeOutput(payload) {
  return {
    goalText: "보고 첫 문장에 결론과 요청을 먼저 말하는 습관을 만들겠습니다.",
    focusPoint: "상대가 바로 판단할 수 있도록 핵심을 먼저 정리합니다.",
    actionMission: "다음 보고에서 결론과 요청사항을 첫 문장에 함께 말하고 확인합니다.",
    sourceIds: payload.answers.map((answer) => answer.sourceId),
  };
}

function makePollOutput(payload) {
  const sourceIds = payload.responses.map((response) => response.sourceId);
  return {
    summary: "응답에서 확인된 공통 판단 방향입니다.",
    summarySourceIds: sourceIds,
    clusters: [{
      title: "확인 후 공유",
      count: sourceIds.length,
      insight: "확인한 사실을 관계자에게 공유하려는 답변입니다.",
      sourceIds,
    }],
    recommendedActions: ["판단 기준을 한 문장으로 설명하게 하세요."],
    followupQuestions: ["반대 상황에서도 같은 기준을 적용하겠습니까?"],
    teachingIntervention: {
      insufficientConcept: "판단 근거를 더 구체화할 필요가 있습니다.",
      confusionPoint: "확인과 보고의 순서가 섞일 수 있습니다.",
      immediateQuestion: "가장 먼저 확인할 사실은 무엇입니까?",
      miniLesson: "사실, 영향 범위, 요청 순서로 짧게 정리합니다.",
      discussionTopic: "신속한 공유와 정확한 확인의 균형",
      evidenceSourceIds: [sourceIds[0]],
    },
    sampleSize: sourceIds.length,
    dataWarning: sourceIds.length < 3 ? "표본이 적어 일반화하기 어렵습니다." : null,
  };
}

function makeBoardOutput(payload) {
  const unreadable = payload.imageUrl.includes("unreadable");
  return {
    status: unreadable ? "unreadable" : "ok",
    scope: `${payload.moduleTitle} · ${payload.scopeLabel}`,
    summary: unreadable ? "작은 글자를 신뢰할 수 없어 원본 확인이 필요합니다." : "장표의 핵심 흐름이 확인됩니다.",
    common: unreadable ? [] : ["핵심 메시지가 앞에 제시됨"],
    action: unreadable ? "고해상도 원본으로 다시 확인하세요." : "다음 행동과 담당자를 보완하세요.",
  };
}

function makeTransferOutput(payload) {
  const sourceIds = payload.surveys.map((survey) => survey.sourceId);
  const barrierCounts = new Map();
  payload.surveys.forEach((survey) => {
    [...new Set(survey.barriers)].forEach((barrier) => {
      barrierCounts.set(barrier, (barrierCounts.get(barrier) || 0) + 1);
    });
  });
  return {
    summary: "실제 적용 사례와 필요한 지원이 함께 확인됩니다.",
    successCase: { sourceIds: [sourceIds[0]] },
    blockedCase: { sourceIds: [sourceIds[sourceIds.length - 1]] },
    appliedHighlights: [{ sourceIds: [sourceIds[0]] }],
    supportHighlights: [{ sourceIds: [sourceIds[sourceIds.length - 1]] }],
    barriers: [...barrierCounts].map(([label, count]) => ({ label, count })),
    recommendedActions: ["관리자와 짧은 적용 점검 시간을 운영하세요."],
    dataWarning: sourceIds.length < 3 ? "응답이 적어 인과로 일반화하기 어렵습니다." : null,
  };
}

function makeJobReflectionOutput(payload) {
  const sourceIds = payload.reflections.map((reflection) => reflection.sourceId);
  return {
    analysis: "입력 회고에서 강의 내용과 현업 행동을 연결한 실천 방향이 확인됩니다.",
    analysisSourceIds: sourceIds,
    headquartersSummary: "입력에서 반복된 보완 이유를 다음 기수의 사례와 실습 구성에서 검토할 수 있습니다.",
    headquartersSourceIds: sourceIds,
    operationsSummary: "제출된 회고 범위에서 수집 현황과 후속 확인이 필요한 지점을 검토할 수 있습니다.",
    operationsSourceIds: sourceIds,
    recommendedActions: [{
      audience: "headquarters",
      action: "입력 회고에 나온 사례·실습 보완 요구를 교안 검토 항목에 포함하세요.",
      sourceIds,
    }],
    sampleSize: sourceIds.length,
    dataWarning: sourceIds.length < 3 ? "응답 수가 적어 공통 경향으로 일반화하기 어렵습니다." : null,
  };
}

function makeMissionOutput() {
  return {
    when: "다음 팀 회의가 끝난 직후",
    what: "결정사항 한 가지를 한 문장으로 정리하고",
    how: "팀 공유 채널에 올린 뒤 확인 여부를 기록합니다.",
  };
}

function makeReportOutput() {
  return {
    summary: "현재 상황을 설명했으며 영향 범위와 요청을 더 분명히 할 수 있습니다.",
    scores: {
      conclusionFirst: 4,
      accuracy: 4,
      cause: 3,
      actionPlan: 4,
      requestClarity: 3,
      attitude: 4,
    },
    firstFix: "첫 문장에 현재 영향 범위와 필요한 결정을 함께 말하세요.",
  };
}

function makeModelOutput(task, payload) {
  return ({
    goalCohort: makeGoalOutput,
    goalCompose: makeGoalComposeOutput,
    pollCluster: makePollOutput,
    boardAnalysis: makeBoardOutput,
    transferReport: makeTransferOutput,
    jobReflectionAnalysis: makeJobReflectionOutput,
    missionDraft: makeMissionOutput,
    reportFeedback: makeReportOutput,
  })[task](payload);
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
  process.env.OPENAI_API_KEY = "fixture-test-key";
  process.env.OPENAI_MODEL = "fixture-test-model";
  process.env.OPENAI_REASONING_EFFORT = "medium";
  process.env.SUPABASE_URL = "https://fixture-project.supabase.co";
  process.env.OPENAI_IMAGE_DETAIL = "high";
  try {
    return await callback();
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
}

test("등록된 task는 서로 다른 요청·출력 스키마와 promptVersion을 둔다", () => {
  const definitions = Object.values(AI_TASK_REGISTRY);
  assert.deepEqual(Object.keys(AI_TASK_REGISTRY), [
    "goalCohort",
    "goalCompose",
    "pollCluster",
    "boardAnalysis",
    "transferReport",
    "jobReflectionAnalysis",
    "missionDraft",
    "reportFeedback",
  ]);
  assert.equal(new Set(definitions.map(({ requestSchema }) => requestSchema)).size, 8);
  assert.equal(new Set(definitions.map(({ outputSchema }) => outputSchema)).size, 8);
  assert.equal(new Set(definitions.map(({ promptVersion }) => promptVersion)).size, 8);
  assert.equal(new Set(definitions.map(({ outputFormatName }) => outputFormatName)).size, 8);
  definitions.forEach((definition) => {
    assert.ok(definition.purpose.length > 0);
    assert.match(definition.systemPrompt, /[가-힣]/u);
    assert.ok(definition.maxOutputTokens > 0);
  });
});

test("25개 비식별 fixture가 task 레지스트리와 공통 API를 직접 통과한다", async () => {
  await withServerEnvironment(async () => {
    for (const [task, taskFixtures] of Object.entries(fixtures.tasks)) {
      const definition = AI_TASK_REGISTRY[task];
      for (const fixture of taskFixtures) {
        const body = { task, courseCode: fixtures.courseCode, payload: fixture.input };
        const normalized = definition.normalizeRequest(body);
        const request = definition.buildOpenAiRequest({
          model: "fixture-test-model",
          reasoningEffort: "medium",
          imageDetail: null,
          courseCode: normalized.courseCode,
          payload: normalized.payload,
        });
        assert.equal(request.store, false, fixture.id);
        assert.equal(request.text.format.type, "json_schema", fixture.id);
        assert.equal(request.max_output_tokens, definition.maxOutputTokens, fixture.id);

        const response = await invokeHandler(body, {
          supabase: {},
          findActiveCourse: async () => ({ code: fixtures.courseCode }),
          findCachedAnalysis: async () => null,
          openai: {
            responses: {
              parse: async () => ({
                status: "completed",
                output: [],
                output_parsed: makeModelOutput(task, normalized.payload),
                usage: { input_tokens: 10, output_tokens: 5 },
                _request_id: `fixture-${fixture.id}`,
              }),
            },
          },
          saveAnalysis: async () => ({ ok: true, createdAt: "2026-08-15T00:00:00.000Z" }),
        });
        assert.equal(response.statusCode, 200, `${fixture.id}: ${JSON.stringify(response.body)}`);
        assert.equal(response.body.ok, true, fixture.id);
        assert.equal(response.body.meta.promptVersion, definition.promptVersion, fixture.id);
      }
    }
  });
});

test("근거형 task는 존재하지 않는 sourceIds와 잘못된 집계를 거부한다", () => {
  const pollPayload = fixtures.tasks.pollCluster[0].input;
  const pollOutput = makePollOutput(pollPayload);
  assert.doesNotThrow(() => AI_TASK_REGISTRY.pollCluster.validateEvidence(pollOutput, pollPayload));
  assert.throws(() => AI_TASK_REGISTRY.pollCluster.validateEvidence({
    ...pollOutput,
    summarySourceIds: ["poll-unknown"],
  }, pollPayload), /UNGROUNDED_SOURCE_ID/u);

  const transferPayload = fixtures.tasks.transferReport[0].input;
  const transferOutput = makeTransferOutput(transferPayload);
  assert.doesNotThrow(() => AI_TASK_REGISTRY.transferReport.validateEvidence(transferOutput, transferPayload));
  assert.throws(() => AI_TASK_REGISTRY.transferReport.validateEvidence({
    ...transferOutput,
    successCase: { sourceIds: ["survey-unknown"] },
  }, transferPayload), /UNGROUNDED_SOURCE_ID/u);
  assert.throws(() => AI_TASK_REGISTRY.transferReport.validateEvidence({
    ...transferOutput,
    barriers: [{ label: "새로 만든 장애요인", count: 1 }],
  }, transferPayload), /INVALID_BARRIER_COUNT/u);

  const jobPayload = fixtures.tasks.jobReflectionAnalysis[0].input;
  const jobOutput = makeJobReflectionOutput(jobPayload);
  assert.doesNotThrow(() => AI_TASK_REGISTRY.jobReflectionAnalysis.validateEvidence(jobOutput, jobPayload));
  assert.throws(() => AI_TASK_REGISTRY.jobReflectionAnalysis.validateEvidence({
    ...jobOutput,
    operationsSourceIds: ["job-reflection-unknown"],
  }, jobPayload), /UNGROUNDED_SOURCE_ID/u);
  assert.throws(() => AI_TASK_REGISTRY.jobReflectionAnalysis.validateEvidence({
    ...jobOutput,
    sampleSize: jobPayload.reflections.length + 1,
  }, jobPayload), /INVALID_SAMPLE_SIZE/u);
});

test("boardAnalysis는 현재 Supabase 공개 board-images URL 한 장만 허용한다", async () => {
  await withServerEnvironment(async () => {
    const validBody = {
      task: "boardAnalysis",
      courseCode: fixtures.courseCode,
      payload: fixtures.tasks.boardAnalysis[0].input,
    };
    assert.doesNotThrow(() => normalizeBoardAnalysisRequest(validBody));
    assert.throws(() => normalizeBoardAnalysisRequest({
      ...validBody,
      payload: { ...validBody.payload, imageUrl: "https://evil.example/board-images/a.jpg" },
    }), /INVALID_BOARD_IMAGE_URL/u);
    assert.throws(() => normalizeBoardAnalysisRequest({
      ...validBody,
      payload: {
        ...validBody.payload,
        imageUrl: "https://fixture-project.supabase.co/storage/v1/object/public/other-bucket/a.jpg",
      },
    }), /INVALID_BOARD_IMAGE_URL/u);

    const normalized = normalizeBoardAnalysisRequest(validBody);
    const request = AI_TASK_REGISTRY.boardAnalysis.buildOpenAiRequest({
      model: "gpt-5.4-mini",
      reasoningEffort: "medium",
      imageDetail: "high",
      courseCode: normalized.courseCode,
      payload: normalized.payload,
    });
    const imagePart = request.input[1].content.find((part) => part.type === "input_image");
    assert.equal(imagePart.image_url, validBody.payload.imageUrl);
    assert.equal(imagePart.detail, "high");
  });
});

test("refusal과 incomplete는 추가 task에도 공통 안전 오류 규약을 적용한다", async () => {
  await withServerEnvironment(async () => {
    const baseDependencies = {
      supabase: {},
      findActiveCourse: async () => ({ code: fixtures.courseCode }),
      findCachedAnalysis: async () => null,
      saveAnalysis: async () => ({ ok: true }),
    };
    const poll = fixtures.tasks.pollCluster[0];
    const refusal = await invokeHandler({
      task: "pollCluster",
      courseCode: fixtures.courseCode,
      payload: poll.input,
    }, {
      ...baseDependencies,
      openai: {
        responses: {
          parse: async () => ({
            status: "completed",
            output: [{ type: "message", content: [{ type: "refusal", refusal: "blocked" }] }],
          }),
        },
      },
    });
    assert.equal(refusal.statusCode, 422);
    assert.equal(refusal.body.error.code, "MODEL_REFUSAL");
    assert.equal(JSON.stringify(refusal.body).includes("blocked"), false);

    const report = fixtures.tasks.reportFeedback[0];
    const incomplete = await invokeHandler({
      task: "reportFeedback",
      courseCode: fixtures.courseCode,
      payload: report.input,
    }, {
      ...baseDependencies,
      openai: {
        responses: {
          parse: async () => ({ status: "incomplete", output: [], output_parsed: null }),
        },
      },
    });
    assert.equal(incomplete.statusCode, 502);
    assert.equal(incomplete.body.error.code, "INCOMPLETE_OUTPUT");
  });
});
