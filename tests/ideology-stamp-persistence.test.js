import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ideologyStampFromRow,
  ideologyStampToRow,
} from "../src/services/dataStore.js";

const stamp = {
  id: "stamp:NH-1001:participant-1:1",
  courseId: "NH-1001",
  participantId: "participant-1",
  classId: "class-1",
  className: "1반",
  studentName: "교육생",
  stampType: "cooperation",
  stampLabel: "협동 스탬프",
  stampIcon: "🤝",
  count: 2,
  memo: "팀 활동 지원",
  givenBy: "교수요원",
  status: "active",
  createdAt: "2026-08-20T01:02:03.000Z",
};

test("스탬프 행 변환은 지급 대상·유형·개수와 취소 상태를 보존한다", () => {
  const row = ideologyStampToRow("NH-1001", stamp);
  assert.deepEqual(row, {
    id: stamp.id,
    course_code: "NH-1001",
    participant_id: "participant-1",
    class_id: "class-1",
    class_name: "1반",
    student_name: "교육생",
    stamp_type: "cooperation",
    stamp_label: "협동 스탬프",
    stamp_icon: "🤝",
    count: 2,
    memo: "팀 활동 지원",
    given_by: "교수요원",
    status: "active",
    created_at: "2026-08-20T01:02:03.000Z",
    cancelled_at: null,
  });
  assert.deepEqual(ideologyStampFromRow(row), stamp);

  const cancelledAt = "2026-08-20T02:03:04.000Z";
  const cancelled = ideologyStampFromRow({
    ...row,
    status: "cancelled",
    cancelled_at: cancelledAt,
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt, cancelledAt);
});

test("스탬프 스키마는 FK·검증·인덱스·RLS와 서버 전용 권한을 선언한다", async () => {
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  assert.match(schema, /create table if not exists ideology_stamps/i);
  assert.match(schema, /course_code text not null references courses\(code\) on delete cascade/i);
  assert.match(schema, /count smallint not null check \(count between 1 and 3\)/i);
  assert.match(schema, /status text not null default 'active' check \(status in \('active', 'cancelled'\)\)/i);
  assert.match(schema, /idx_ideology_stamps_course_created/i);
  assert.match(schema, /alter table ideology_stamps enable row level security/i);
  assert.match(schema, /revoke all on table public\.ideology_stamps from anon, authenticated/i);
  assert.match(schema, /revoke all on table public\.ideology_stamps from service_role/i);
  assert.match(schema, /grant select, insert, update on table public\.ideology_stamps to service_role/i);
  assert.doesNotMatch(schema, /create policy [^\n]*ideology_stamps/i);
  assert.doesNotMatch(schema, /alter publication supabase_realtime add table public\.ideology_stamps/i);
});

test("지급 화면은 DB 저장 성공 후에만 반영하고 중복 클릭을 막는다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /stampActionInFlightRef\.current/);
  assert.match(source, /await onGiveStamp\(course, pendingStamp\)/);
  assert.match(source, /스탬프가 저장되지 않았습니다/);
  assert.match(source, /disabled=\{stampActionPending\}/);
  assert.match(source, /지급 확정/);
  assert.doesNotMatch(source, /window\.confirm\(`\$\{selectedStudent\.name\} 교육생에게/);
});

test("교육생은 과정 변경 알림 후 검증된 서버 경로로 자기 지급 이력을 다시 조회한다", async () => {
  const appSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  const realtimeSource = await readFile(new URL("../src/services/realtimeBridge.js", import.meta.url), "utf8");

  assert.match(appSource, /detail\.table === "ideology_stamps" \|\| detail\.table === "courses"/);
  assert.match(appSource, /getIdeologyStamps\(\[course\.code\], ideologyStampAccess\)/);
  assert.match(realtimeSource, /table: "courses"/);
  assert.doesNotMatch(realtimeSource, /table: "ideology_stamps"/);
});
