import { createHmac } from "node:crypto";

export const JOB_REFLECTION_COLUMNS = [
  "id",
  "course_code",
  "participant_key",
  "class_id",
  "class_name",
  "reflection_date",
  "best_session_id",
  "best_reason",
  "best_reason_etc",
  "improvement_session_id",
  "improvement_reason",
  "improvement_reason_etc",
  "work_application_point",
  "created_at",
].join(",");

export function createParticipantKey(secret, courseCode, participantId) {
  return createHmac("sha256", secret)
    .update(`${courseCode}:${participantId}`)
    .digest("hex");
}

export function jobReflectionToRow({ secret, courseCode, participant, reflection }) {
  const participantId = participant.participantId || participant.id;
  return {
    id: createParticipantKey(secret, courseCode, `${participantId}:${reflection.date}`),
    course_code: courseCode,
    participant_key: createParticipantKey(secret, courseCode, participantId),
    class_id: participant.classId || "class-1",
    class_name: participant.className || "1반",
    reflection_date: reflection.date,
    best_session_id: reflection.bestSessionId,
    best_reason: reflection.bestReason,
    best_reason_etc: reflection.bestReasonEtc || null,
    improvement_session_id: reflection.improvementSessionId || null,
    improvement_reason: reflection.improvementReason || null,
    improvement_reason_etc: reflection.improvementReasonEtc || null,
    work_application_point: reflection.workApplicationPoint,
    created_at: reflection.createdAt || new Date().toISOString(),
  };
}

export function jobReflectionFromRow(row, { participantId = null, respondentIndex = 1 } = {}) {
  return {
    id: row.id,
    courseId: row.course_code,
    participantId,
    studentName: participantId ? "나" : `응답자 ${respondentIndex}`,
    classId: row.class_id,
    className: row.class_name || "1반",
    date: row.reflection_date,
    bestSessionId: row.best_session_id,
    bestReason: row.best_reason,
    bestReasonEtc: row.best_reason_etc || null,
    improvementSessionId: row.improvement_session_id || null,
    improvementReason: row.improvement_reason || null,
    improvementReasonEtc: row.improvement_reason_etc || null,
    workApplicationPoint: row.work_application_point || "",
    createdAt: row.created_at,
  };
}
