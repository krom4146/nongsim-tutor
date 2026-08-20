import { createHmac, timingSafeEqual } from "node:crypto";

export const IDEOLOGY_STAMP_COLUMNS = [
  "id",
  "course_code",
  "participant_id",
  "class_id",
  "class_name",
  "student_name",
  "stamp_type",
  "stamp_label",
  "stamp_icon",
  "count",
  "memo",
  "given_by",
  "status",
  "created_at",
  "cancelled_at",
].join(",");

export const IDEOLOGY_STAMP_TYPES = {
  participation: { label: "참여 스탬프", icon: "🙋" },
  cooperation: { label: "협동 스탬프", icon: "🤝" },
  consideration: { label: "배려 스탬프", icon: "🌱" },
  reflection: { label: "성찰 스탬프", icon: "💭" },
  olympic: { label: "올림픽 스탬프", icon: "🏅" },
  action: { label: "실천 다짐 스탬프", icon: "✍️" },
};

const PROFESSOR_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function sessionSignature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyProfessorPassword(provided, configured) {
  const actual = Buffer.from(String(provided || ""), "utf8");
  const expected = Buffer.from(String(configured || ""), "utf8");
  return actual.byteLength === expected.byteLength
    && actual.byteLength > 0
    && timingSafeEqual(actual, expected);
}

export function createProfessorSession(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ scope: "professor", exp: now + PROFESSOR_SESSION_TTL_MS }), "utf8").toString("base64url");
  return `${payload}.${sessionSignature(payload, secret)}`;
}

export function verifyProfessorSession(token, secret, now = Date.now()) {
  const [payload, providedSignature, ...rest] = String(token || "").split(".");
  if (!payload || !providedSignature || rest.length) return false;
  const expectedSignature = sessionSignature(payload, secret);
  const actual = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.scope === "professor" && Number(session.exp) > now;
  } catch {
    return false;
  }
}

export function ideologyStampToServerRow(course, participant, stamp) {
  const type = IDEOLOGY_STAMP_TYPES[stamp.stampType];
  if (!type) throw new Error("INVALID_STAMP_TYPE");
  return {
    id: stamp.id,
    course_code: course.code,
    participant_id: participant.participantId || participant.id,
    class_id: participant.classId || "class-1",
    class_name: participant.className || "1반",
    student_name: participant.name || participant.studentName || "",
    stamp_type: stamp.stampType,
    stamp_label: type.label,
    stamp_icon: type.icon,
    count: Number(stamp.count),
    memo: stamp.memo || null,
    given_by: "교수요원",
    status: stamp.status === "cancelled" ? "cancelled" : "active",
    created_at: stamp.createdAt,
    cancelled_at: stamp.cancelledAt || null,
  };
}

export function ideologyStampFromServerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_code,
    participantId: row.participant_id,
    classId: row.class_id,
    className: row.class_name,
    studentName: row.student_name,
    stampType: row.stamp_type,
    stampLabel: row.stamp_label,
    stampIcon: row.stamp_icon,
    count: Number(row.count),
    memo: row.memo || "",
    givenBy: row.given_by,
    status: row.status,
    createdAt: row.created_at,
    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {}),
  };
}
