import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  achievementFromRow,
  achievementToRow,
  latestMissionsByParticipant,
} from "../src/services/dataStore.js";

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
