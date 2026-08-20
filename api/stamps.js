import { z, ZodError } from "zod";
import { createServerSupabaseClient } from "../server/ai/aiPersistence.js";
import {
  hasJsonContentType,
  isAllowedOrigin,
  readJsonBody,
  RequestSecurityError,
} from "../server/ai/security.js";
import {
  createProfessorSession,
  IDEOLOGY_STAMP_COLUMNS,
  ideologyStampFromServerRow,
  ideologyStampToServerRow,
  verifyProfessorPassword,
  verifyProfessorSession,
} from "../server/ideologyStamps.js";

const courseCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u).max(64);
const participantIdSchema = z.string().trim().min(1).max(160);
const sessionTokenSchema = z.string().trim().min(1).max(2048);
const stampSchema = z.object({
  id: z.string().trim().min(1).max(200),
  participantId: participantIdSchema,
  stampType: z.enum(["participation", "cooperation", "consideration", "reflection", "olympic", "action"]),
  count: z.number().int().min(1).max(3),
  memo: z.string().trim().max(300),
  status: z.enum(["active", "cancelled"]).default("active"),
  createdAt: z.iso.datetime({ offset: true }),
  cancelledAt: z.iso.datetime({ offset: true }).optional(),
}).strict();

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), password: z.string().min(1).max(256) }).strict(),
  z.object({ action: z.literal("list"), professorToken: sessionTokenSchema, courseCodes: z.array(courseCodeSchema).min(1).max(20) }).strict(),
  z.object({
    action: z.literal("mine"),
    courseCode: courseCodeSchema,
    participantId: participantIdSchema,
    reentryToken: z.string().trim().min(6).max(160),
  }).strict(),
  z.object({ action: z.literal("save"), professorToken: sessionTokenSchema, courseCode: courseCodeSchema, stamp: stampSchema }).strict(),
  z.object({ action: z.literal("cancel"), professorToken: sessionTokenSchema, courseCode: courseCodeSchema, stampId: z.string().trim().min(1).max(200) }).strict(),
  z.object({ action: z.literal("migrate"), professorToken: sessionTokenSchema, stamps: z.array(stampSchema.extend({ courseId: courseCodeSchema })).max(500) }).strict(),
]);

class SafeHttpError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "SafeHttpError";
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function serverSecret() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new SafeHttpError("SERVER_MISCONFIGURED", 500, "스탬프 서버 설정을 확인해 주세요.");
  return secret;
}

function assertProfessor(token, secret) {
  if (!verifyProfessorSession(token, secret)) {
    throw new SafeHttpError("UNAUTHORIZED", 401, "교수요원 인증이 만료되었거나 올바르지 않습니다.");
  }
}

function findParticipant(course, participantId) {
  return (Array.isArray(course?.participants) ? course.participants : [])
    .find((participant) => (participant.participantId || participant.id) === participantId) || null;
}

async function findCourse(client, courseCode) {
  const { data, error } = await client
    .from("courses")
    .select("code, participants")
    .eq("code", courseCode)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "과정 정보를 확인하지 못했습니다.");
  if (!data) throw new SafeHttpError("COURSE_NOT_FOUND", 404, "활성 과정을 찾을 수 없습니다.");
  return data;
}

async function listCourseStamps(client, courseCodes) {
  const { data, error } = await client
    .from("ideology_stamps")
    .select(IDEOLOGY_STAMP_COLUMNS)
    .in("course_code", [...new Set(courseCodes)])
    .order("created_at", { ascending: true });
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "스탬프 이력을 불러오지 못했습니다.");
  return (data || []).map(ideologyStampFromServerRow).filter(Boolean);
}

async function listMine(client, courseCode, participantId, reentryToken) {
  const course = await findCourse(client, courseCode);
  const participant = findParticipant(course, participantId);
  if (!participant || participant.reentryToken !== reentryToken) {
    throw new SafeHttpError("PARTICIPANT_NOT_FOUND", 403, "교육생 재입장 정보를 확인할 수 없습니다.");
  }
  const { data, error } = await client
    .from("ideology_stamps")
    .select(IDEOLOGY_STAMP_COLUMNS)
    .eq("course_code", courseCode)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "나의 스탬프를 불러오지 못했습니다.");
  return (data || []).map(ideologyStampFromServerRow).filter(Boolean);
}

async function touchCourses(client, courseCodes) {
  const { error } = await client
    .from("courses")
    .update({ updated_at: new Date().toISOString() })
    .in("code", [...new Set(courseCodes)]);
  if (error) console.warn(JSON.stringify({ event: "ideology_stamp_realtime_touch_failed" }));
}

async function saveStamp(client, courseCode, stamp) {
  const course = await findCourse(client, courseCode);
  const participant = findParticipant(course, stamp.participantId);
  if (!participant) throw new SafeHttpError("PARTICIPANT_NOT_FOUND", 422, "스탬프 지급 대상자를 확인해 주세요.");
  const row = ideologyStampToServerRow(course, participant, stamp);
  const { data, error } = await client
    .from("ideology_stamps")
    .upsert(row, { onConflict: "id" })
    .select(IDEOLOGY_STAMP_COLUMNS)
    .single();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "스탬프를 저장하지 못했습니다.");
  await touchCourses(client, [courseCode]);
  return ideologyStampFromServerRow(data);
}

async function cancelStamp(client, courseCode, stampId) {
  await findCourse(client, courseCode);
  const { data, error } = await client
    .from("ideology_stamps")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", stampId)
    .eq("course_code", courseCode)
    .select(IDEOLOGY_STAMP_COLUMNS)
    .maybeSingle();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "스탬프 지급 취소를 저장하지 못했습니다.");
  if (!data) throw new SafeHttpError("STAMP_NOT_FOUND", 404, "취소할 스탬프 지급 이력을 찾지 못했습니다.");
  await touchCourses(client, [courseCode]);
  return ideologyStampFromServerRow(data);
}

async function migrateStamps(client, stamps) {
  if (!stamps.length) return [];
  const courseCodes = [...new Set(stamps.map((stamp) => stamp.courseId))];
  const { data: courses, error: courseError } = await client
    .from("courses")
    .select("code, participants")
    .in("code", courseCodes)
    .is("archived_at", null);
  if (courseError) throw new SafeHttpError("UPSTREAM_ERROR", 502, "과정 정보를 확인하지 못했습니다.");
  const courseByCode = new Map((courses || []).map((course) => [course.code, course]));
  const rows = stamps.map((stamp) => {
    const course = courseByCode.get(stamp.courseId);
    const participant = findParticipant(course, stamp.participantId);
    if (!course || !participant) throw new SafeHttpError("INVALID_LEGACY_STAMP", 422, "기존 스탬프 지급 대상자를 확인해 주세요.");
    return ideologyStampToServerRow(course, participant, stamp);
  });
  const { data, error } = await client
    .from("ideology_stamps")
    .upsert(rows, { onConflict: "id" })
    .select(IDEOLOGY_STAMP_COLUMNS);
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "기존 스탬프 이력을 이전하지 못했습니다.");
  await touchCourses(client, courseCodes);
  return (data || []).map(ideologyStampFromServerRow).filter(Boolean);
}

export async function handleStampRequest(req, res, dependencies = {}) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw new SafeHttpError("METHOD_NOT_ALLOWED", 405, "POST 요청만 지원합니다.");
    }
    if (!hasJsonContentType(req)) throw new SafeHttpError("UNSUPPORTED_MEDIA_TYPE", 415, "Content-Type은 application/json이어야 합니다.");
    if (!isAllowedOrigin(req)) throw new SafeHttpError("INVALID_ORIGIN", 403, "허용되지 않은 요청입니다.");
    const body = requestSchema.parse(await readJsonBody(req));
    const secret = serverSecret();

    if (body.action === "login") {
      const configuredPassword = process.env.PROFESSOR_PASSWORD;
      if (!configuredPassword) throw new SafeHttpError("SERVER_MISCONFIGURED", 500, "교수요원 인증 서버 설정을 확인해 주세요.");
      if (!verifyProfessorPassword(body.password, configuredPassword)) {
        throw new SafeHttpError("UNAUTHORIZED", 401, "교수요원 관리자 비밀번호가 맞지 않습니다.");
      }
      return jsonResponse(res, 200, { ok: true, data: { professorToken: createProfessorSession(secret) } });
    }

    const client = dependencies.supabase || createServerSupabaseClient();
    if (body.action === "mine") {
      return jsonResponse(res, 200, { ok: true, data: { stamps: await listMine(client, body.courseCode, body.participantId, body.reentryToken) } });
    }

    assertProfessor(body.professorToken, secret);
    if (body.action === "list") {
      return jsonResponse(res, 200, { ok: true, data: { stamps: await listCourseStamps(client, body.courseCodes) } });
    }
    if (body.action === "save") {
      return jsonResponse(res, 200, { ok: true, data: { stamp: await saveStamp(client, body.courseCode, body.stamp) } });
    }
    if (body.action === "cancel") {
      return jsonResponse(res, 200, { ok: true, data: { stamp: await cancelStamp(client, body.courseCode, body.stampId) } });
    }
    return jsonResponse(res, 200, { ok: true, data: { stamps: await migrateStamps(client, body.stamps) } });
  } catch (error) {
    let safeError = error;
    if (error instanceof ZodError || error instanceof RequestSecurityError) {
      safeError = new SafeHttpError(error.code || "INVALID_PAYLOAD", error.code === "PAYLOAD_TOO_LARGE" ? 413 : 422, "요청 데이터가 올바르지 않습니다.");
    } else if (!(error instanceof SafeHttpError)) {
      console.error(JSON.stringify({ event: "ideology_stamp_request_failed", error: error?.name || "Error" }));
      safeError = new SafeHttpError("UPSTREAM_ERROR", 502, "스탬프 서비스에 일시적인 문제가 있습니다.");
    }
    return jsonResponse(res, safeError.status, {
      ok: false,
      error: { code: safeError.code, message: safeError.message },
    });
  }
}

export default async function handler(req, res) {
  return handleStampRequest(req, res);
}
