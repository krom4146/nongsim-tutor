import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleJobReflectionRequest } from "../api/job-reflections.js";
import {
  achievementFromRow,
  achievementToRow,
  jobReflectionToApiInput,
  latestMissionsByParticipant,
} from "../src/services/dataStore.js";
import {
  createParticipantKey,
  jobReflectionFromRow,
  jobReflectionToRow,
} from "../server/jobReflections.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function createJobReflectionSupabaseFixture(course) {
  let savedRow = null;
  return {
    getSavedRow: () => savedRow,
    client: {
      from(table) {
        let operation = "select";
        const chain = {
          select() { operation = "select"; return chain; },
          eq() { return chain; },
          is() {
            return operation === "update" ? Promise.resolve({ error: null }) : chain;
          },
          maybeSingle() {
            return Promise.resolve({ data: table === "courses" ? course : null, error: null });
          },
          upsert(row) { operation = "upsert"; savedRow = row; return chain; },
          single() { return Promise.resolve({ data: savedRow, error: null }); },
          update() { operation = "update"; return chain; },
        };
        return chain;
      },
    },
  };
}

test("수료 성찰 행 변환은 참여자·반·답변을 보존한다", () => {
  const achievement = {
    id: "achievement:NH-3001:participant-1",
    participantId: "participant-1",
    name: "교육생",
    classId: "class-2",
    className: "2반",
    text: "수료 성찰 요약",
    answers: ["변화", "보완점", "실천 계획"],
    createdAt: "2026-08-18T01:02:03.000Z",
  };

  const row = achievementToRow("NH-3001", achievement);
  assert.deepEqual(row, {
    id: achievement.id,
    course_code: "NH-3001",
    participant_id: "participant-1",
    name: "교육생",
    class_id: "class-2",
    class_name: "2반",
    text: "수료 성찰 요약",
    answers: ["변화", "보완점", "실천 계획"],
    created_at: "2026-08-18T01:02:03.000Z",
  });
  assert.deepEqual(achievementFromRow(row), {
    ...achievement,
    courseId: "NH-3001",
  });
});

test("같은 참여자의 중복 미션은 가장 최근 행 한 건만 사용한다", () => {
  const missions = latestMissionsByParticipant([
    { id: "old", participantId: "participant-1", createdAt: "2026-08-18T01:00:00.000Z" },
    { id: "other", participantId: "participant-2", createdAt: "2026-08-18T01:30:00.000Z" },
    { id: "latest", participantId: "participant-1", createdAt: "2026-08-18T02:00:00.000Z" },
  ]);

  assert.deepEqual(missions.map((mission) => mission.id), ["other", "latest"]);
});

test("직무강의 회고 행은 원본 참여자 식별자·실명 없이 5개 응답을 보존한다", () => {
  const reflection = {
    id: "job-reflection:NH-4001:participant-1:2026-08-19",
    participantId: "participant-1",
    studentName: "교육생",
    classId: "class-1",
    className: "1반",
    date: "2026-08-19",
    bestSessionId: "session-1",
    bestReason: "현업 적용 가능",
    bestReasonEtc: null,
    improvementSessionId: "session-2",
    improvementReason: "사례 보완 필요",
    improvementReasonEtc: null,
    workApplicationPoint: "계약서 확인 순서를 업무에 적용하겠다.",
    createdAt: "2026-08-19T01:02:03.000Z",
  };

  const participant = { id: "participant-1", name: "교육생", classId: "class-1", className: "1반" };
  const participantKey = createParticipantKey("server-secret", "NH-4001", participant.id);
  const row = jobReflectionToRow({
    secret: "server-secret",
    courseCode: "NH-4001",
    participant,
    reflection,
  });
  assert.deepEqual(row, {
    id: createParticipantKey("server-secret", "NH-4001", `${participant.id}:2026-08-19`),
    course_code: "NH-4001",
    participant_key: participantKey,
    class_id: "class-1",
    class_name: "1반",
    reflection_date: "2026-08-19",
    best_session_id: "session-1",
    best_reason: "현업 적용 가능",
    best_reason_etc: null,
    improvement_session_id: "session-2",
    improvement_reason: "사례 보완 필요",
    improvement_reason_etc: null,
    work_application_point: "계약서 확인 순서를 업무에 적용하겠다.",
    created_at: "2026-08-19T01:02:03.000Z",
  });
  assert.equal(JSON.stringify(row).includes("participant-1"), false);
  assert.equal(JSON.stringify(row).includes("교육생"), false);
  assert.deepEqual(jobReflectionFromRow(row, { respondentIndex: 2 }), {
    id: row.id,
    courseId: "NH-4001",
    participantId: null,
    studentName: "응답자 2",
    classId: "class-1",
    className: "1반",
    date: "2026-08-19",
    bestSessionId: "session-1",
    bestReason: "현업 적용 가능",
    bestReasonEtc: null,
    improvementSessionId: "session-2",
    improvementReason: "사례 보완 필요",
    improvementReasonEtc: null,
    workApplicationPoint: "계약서 확인 순서를 업무에 적용하겠다.",
    createdAt: "2026-08-19T01:02:03.000Z",
  });
});

test("회고 서버 저장은 과정 참여자와 강의를 검증하고 DB 행에서 직접 식별자를 제거한다", async () => {
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  const course = {
    code: "NH-4001",
    participants: [{ id: "participant-1", name: "교육생", classId: "class-1", className: "1반" }],
    data: {
      jobSessions: [
        { id: "session-1", classId: "class-1", date: "2026-08-19" },
        { id: "session-2", classId: "class-1", date: "2026-08-19" },
      ],
    },
  };
  const fixture = createJobReflectionSupabaseFixture(course);
  const uiReflection = {
    id: "job-reflection:NH-4001:participant-1:2026-08-19",
    courseId: "NH-4001",
    participantId: "participant-1",
    studentName: "교육생",
    classId: "class-1",
    className: "1반",
    date: "2026-08-19",
    bestSessionId: "session-1",
    bestReason: "현업 절차와 바로 연결돼서",
    bestReasonEtc: null,
    improvementSessionId: "session-2",
    improvementReason: "사례가 부족했다",
    improvementReasonEtc: null,
    workApplicationPoint: "계약서 확인 순서를 업무에 적용하겠다.",
    createdAt: "2026-08-19T01:02:03.000Z",
  };
  const apiInput = jobReflectionToApiInput(uiReflection);
  assert.deepEqual(Object.keys(apiInput), [
    "participantId",
    "date",
    "bestSessionId",
    "bestReason",
    "bestReasonEtc",
    "improvementSessionId",
    "improvementReason",
    "improvementReasonEtc",
    "workApplicationPoint",
    "createdAt",
  ]);
  assert.equal(JSON.stringify(apiInput).includes("studentName"), false);
  assert.equal(JSON.stringify(apiInput).includes("className"), false);
  assert.equal(JSON.stringify(apiInput).includes("job-reflection:"), false);
  const req = {
    method: "POST",
    headers: {
      origin: "https://nongsim-tutor.vercel.app",
      host: "nongsim-tutor.vercel.app",
      "content-type": "application/json",
    },
    body: {
      action: "save",
      courseCode: "NH-4001",
      reflection: apiInput,
    },
  };
  const res = createResponse();

  try {
    await handleJobReflectionRequest(req, res, { supabase: fixture.client });
  } finally {
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.reflection.participantId, "participant-1");
  assert.equal(fixture.getSavedRow().participant_id, undefined);
  assert.equal(fixture.getSavedRow().student_name, undefined);
  assert.equal(JSON.stringify(fixture.getSavedRow()).includes("participant-1"), false);
  assert.equal(JSON.stringify(fixture.getSavedRow()).includes("교육생"), false);
});

test("스키마는 직무강의 회고 전용 행·유일성·RLS·서버 전용 권한을 선언한다", async () => {
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  assert.match(schema, /create table if not exists job_reflections/i);
  assert.match(schema, /unique\s*\(course_code,\s*participant_key,\s*reflection_date\)/i);
  assert.match(schema, /idx_job_reflections_course_date_class/i);
  assert.match(schema, /alter table job_reflections enable row level security/i);
  assert.match(schema, /revoke all on table public\.job_reflections from anon, authenticated/i);
  assert.match(schema, /grant select, insert, update on table public\.job_reflections to service_role/i);
  assert.doesNotMatch(schema, /create policy [^\n]*job_reflections/i);
  assert.doesNotMatch(schema, /alter publication supabase_realtime add table public\.job_reflections/i);
});

test("직무강의 회고 화면은 실제 AI·캐시 상태와 세 대상별 AI 요약을 구분해 표시한다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /AI 직무강의 회고 분석/);
  assert.match(source, /본부 과정 담당자용 AI 개선 요약/);
  assert.match(source, /교육원 운영 담당자용 AI 요약/);
  assert.match(source, /AI 분석 · 캐시/);
  assert.match(source, /실제 AI 분석/);
  assert.doesNotMatch(source, /<span>자동 집계 요약<\/span>/);
  assert.doesNotMatch(source, /AI 시연용 분석 요약/);
});

test("스키마는 수료 성찰 단일 행·RLS·Data API 권한을 선언한다", async () => {
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  assert.match(schema, /create table if not exists achievements/i);
  assert.match(schema, /unique\s*\(course_code,\s*participant_id\)/i);
  assert.match(schema, /alter table achievements enable row level security/i);
  assert.match(schema, /demo_select_achievements/i);
  assert.match(schema, /demo_insert_achievements/i);
  assert.match(schema, /demo_update_achievements/i);
  assert.match(schema, /public\.achievements,[\s\S]*public\.missions[\s\S]*to anon, authenticated/i);
});

test("교수요원 수료 성찰 카드는 전용 상세 탭으로 이동한다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /\["achievements",\s*"수료 성찰"\]/);
  assert.match(source, /tab === "achievements"/);
  assert.match(source, /requestCompletionReflectionAnalysis/);
  assert.match(source, /수료 성찰 AI 분석/);
  assert.match(source, /실제 수료 성찰 AI 분석/);
  assert.match(source, /수료 성찰 AI 분석 · 캐시/);
  assert.match(source, /\["수료 성찰",[^\n]*"achievements",\s*"등록 인원 기준"\]/);
  assert.doesNotMatch(source, /\["수료 성찰",[^\n]*"goals",\s*"등록 인원 기준"\]/);
  assert.doesNotMatch(source, /\["ai",\s*"AI 분석"\]/);
  assert.doesNotMatch(source, /openAnalysis\("all"\)/);
});
