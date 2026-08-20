import assert from "node:assert/strict";
import test from "node:test";
import { handleStampRequest } from "../api/stamps.js";
import {
  createProfessorSession,
  verifyProfessorPassword,
  verifyProfessorSession,
} from "../server/ideologyStamps.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function createRequest(body) {
  return {
    method: "POST",
    headers: {
      origin: "https://example.test",
      host: "example.test",
      "content-type": "application/json",
    },
    body,
  };
}

function createSupabaseFixture() {
  const course = {
    code: "NH-1001",
    participants: [{
      id: "participant-1",
      participantId: "participant-1",
      name: "교육생",
      classId: "class-1",
      className: "1반",
      reentryToken: "REENTRY-1234",
    }],
  };
  const rows = [];
  return {
    getRows: () => rows,
    client: {
      from(table) {
        let operation = "select";
        let savedRow = null;
        let filters = {};
        const chain = {
          select() { return chain; },
          eq(column, value) { filters[column] = value; return chain; },
          is() { return chain; },
          in() {
            if (table === "courses" && operation === "update") return Promise.resolve({ error: null });
            return chain;
          },
          order() {
            if (table === "ideology_stamps") {
              return Promise.resolve({
                data: rows.filter((row) => (!filters.course_code || row.course_code === filters.course_code)
                  && (!filters.participant_id || row.participant_id === filters.participant_id)),
                error: null,
              });
            }
            return chain;
          },
          maybeSingle() {
            if (table === "courses") return Promise.resolve({ data: filters.code === course.code ? course : null, error: null });
            return Promise.resolve({ data: savedRow, error: null });
          },
          upsert(row) {
            operation = "upsert";
            savedRow = row;
            const index = rows.findIndex((item) => item.id === row.id);
            if (index >= 0) rows[index] = row;
            else rows.push(row);
            return chain;
          },
          update() { operation = "update"; return chain; },
          single() { return Promise.resolve({ data: savedRow, error: null }); },
        };
        return chain;
      },
    },
  };
}

async function withServerEnvironment(run) {
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const previousPassword = process.env.PROFESSOR_PASSWORD;
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  process.env.PROFESSOR_PASSWORD = "strong-professor-password";
  try {
    return await run();
  } finally {
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
    if (previousPassword === undefined) delete process.env.PROFESSOR_PASSWORD;
    else process.env.PROFESSOR_PASSWORD = previousPassword;
  }
}

test("교수요원 비밀번호 비교와 서명 세션은 변조·만료를 차단한다", () => {
  assert.equal(verifyProfessorPassword("correct", "correct"), true);
  assert.equal(verifyProfessorPassword("wrong", "correct"), false);
  const token = createProfessorSession("server-secret", 1_000);
  assert.equal(verifyProfessorSession(token, "server-secret", 2_000), true);
  assert.equal(verifyProfessorSession(`${token}x`, "server-secret", 2_000), false);
  assert.equal(verifyProfessorSession(token, "server-secret", 8 * 60 * 60 * 1000 + 1_001), false);
});

test("교수요원 로그인은 서버 환경변수와 일치할 때만 세션을 발급한다", async () => withServerEnvironment(async () => {
  const success = createResponse();
  await handleStampRequest(createRequest({ action: "login", password: "strong-professor-password" }), success);
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.ok, true);
  assert.equal(verifyProfessorSession(success.body.data.professorToken, "server-secret"), true);

  const failure = createResponse();
  await handleStampRequest(createRequest({ action: "login", password: "wrong-password" }), failure);
  assert.equal(failure.statusCode, 401);
  assert.equal(failure.body.error.code, "UNAUTHORIZED");
}));

test("스탬프 지급은 교수 세션과 실제 과정 참여자를 검증하고 서버 값으로 저장한다", async () => withServerEnvironment(async () => {
  const fixture = createSupabaseFixture();
  const professorToken = createProfessorSession("server-secret");
  const res = createResponse();
  await handleStampRequest(createRequest({
    action: "save",
    professorToken,
    courseCode: "NH-1001",
    stamp: {
      id: "stamp-1",
      participantId: "participant-1",
      stampType: "cooperation",
      count: 2,
      memo: "팀 활동 지원",
      status: "active",
      createdAt: "2026-08-20T01:02:03.000Z",
    },
  }), res, { supabase: fixture.client });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(fixture.getRows()[0].student_name, "교육생");
  assert.equal(fixture.getRows()[0].stamp_label, "협동 스탬프");
  assert.equal(fixture.getRows()[0].given_by, "교수요원");
}));

test("교육생 조회는 참여자 ID와 재입장 토큰이 모두 일치할 때 자기 기록만 반환한다", async () => withServerEnvironment(async () => {
  const fixture = createSupabaseFixture();
  fixture.getRows().push({
    id: "stamp-1",
    course_code: "NH-1001",
    participant_id: "participant-1",
    class_id: "class-1",
    class_name: "1반",
    student_name: "교육생",
    stamp_type: "participation",
    stamp_label: "참여 스탬프",
    stamp_icon: "🙋",
    count: 1,
    memo: null,
    given_by: "교수요원",
    status: "active",
    created_at: "2026-08-20T01:02:03.000Z",
    cancelled_at: null,
  });

  const success = createResponse();
  await handleStampRequest(createRequest({
    action: "mine",
    courseCode: "NH-1001",
    participantId: "participant-1",
    reentryToken: "REENTRY-1234",
  }), success, { supabase: fixture.client });
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.data.stamps.length, 1);

  const denied = createResponse();
  await handleStampRequest(createRequest({
    action: "mine",
    courseCode: "NH-1001",
    participantId: "participant-1",
    reentryToken: "WRONG-TOKEN",
  }), denied, { supabase: fixture.client });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.error.code, "PARTICIPANT_NOT_FOUND");
}));
