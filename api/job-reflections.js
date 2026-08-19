import { z, ZodError } from "zod";
import { createServerSupabaseClient } from "../server/ai/aiPersistence.js";
import {
  hasJsonContentType,
  isAllowedOrigin,
  readJsonBody,
  RequestSecurityError,
} from "../server/ai/security.js";
import {
  createParticipantKey,
  JOB_REFLECTION_COLUMNS,
  jobReflectionFromRow,
  jobReflectionToRow,
} from "../server/jobReflections.js";

const courseCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u).max(64);
const participantIdSchema = z.string().trim().min(1).max(160);
const nullableShortText = z.string().trim().max(160).nullable();
const reflectionSchema = z.object({
  participantId: participantIdSchema,
  date: z.iso.date(),
  bestSessionId: z.string().trim().min(1).max(160),
  bestReason: z.string().trim().min(1).max(80),
  bestReasonEtc: nullableShortText,
  improvementSessionId: nullableShortText,
  improvementReason: nullableShortText,
  improvementReasonEtc: nullableShortText,
  workApplicationPoint: z.string().trim().min(1).max(500),
  createdAt: z.iso.datetime({ offset: true }),
}).strict();

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), courseCodes: z.array(courseCodeSchema).min(1).max(20) }).strict(),
  z.object({ action: z.literal("mine"), courseCode: courseCodeSchema, participantId: participantIdSchema }).strict(),
  z.object({ action: z.literal("save"), courseCode: courseCodeSchema, reflection: reflectionSchema }).strict(),
]);

const BEST_REASONS = new Set([
  "실제 사례가 많아서",
  "설명이 쉬워서",
  "현업 절차와 바로 연결돼서",
  "평소 궁금했던 내용이라서",
  "강사의 전달력이 좋아서",
  "기타",
]);
const IMPROVEMENT_REASONS = new Set([
  "내용이 어려웠다",
  "사례가 부족했다",
  "현업 적용 방법이 잘 보이지 않았다",
  "시간이 부족했다",
  "자료나 화면이 이해하기 어려웠다",
  "강의 흐름이 빠르거나 산만했다",
  "기타",
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

function serverConfig() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new SafeHttpError("SERVER_MISCONFIGURED", 500, "회고 저장 서버 설정을 확인해 주세요.");
  return { secret };
}

function findParticipant(course, participantId) {
  return (Array.isArray(course?.participants) ? course.participants : [])
    .find((participant) => (participant.participantId || participant.id) === participantId) || null;
}

async function findCourse(client, courseCode) {
  const { data, error } = await client
    .from("courses")
    .select("code, participants, data")
    .eq("code", courseCode)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "과정 정보를 확인하지 못했습니다.");
  if (!data) throw new SafeHttpError("COURSE_NOT_FOUND", 404, "활성 과정을 찾을 수 없습니다.");
  return data;
}

function validateReflection(course, participant, reflection) {
  const sessions = Array.isArray(course.data?.jobSessions) ? course.data.jobSessions : [];
  const classId = participant.classId || "class-1";
  const sessionIds = new Set(sessions
    .filter((session) => session.classId === classId && session.date === reflection.date)
    .map((session) => session.id));
  if (!sessionIds.has(reflection.bestSessionId)) {
    throw new SafeHttpError("INVALID_PAYLOAD", 422, "선택한 직무강의를 확인해 주세요.");
  }
  if (reflection.improvementSessionId && !sessionIds.has(reflection.improvementSessionId)) {
    throw new SafeHttpError("INVALID_PAYLOAD", 422, "보완이 필요한 직무강의를 확인해 주세요.");
  }
  if (!BEST_REASONS.has(reflection.bestReason)
    || (reflection.improvementSessionId && !IMPROVEMENT_REASONS.has(reflection.improvementReason))) {
    throw new SafeHttpError("INVALID_PAYLOAD", 422, "회고 선택 항목을 확인해 주세요.");
  }
  if ((reflection.bestReason === "기타") !== Boolean(reflection.bestReasonEtc)) {
    throw new SafeHttpError("INVALID_PAYLOAD", 422, "도움이 된 기타 이유를 확인해 주세요.");
  }
  if ((reflection.improvementReason === "기타") !== Boolean(reflection.improvementReasonEtc)) {
    throw new SafeHttpError("INVALID_PAYLOAD", 422, "보완이 필요한 기타 이유를 확인해 주세요.");
  }
}

async function listReflections(client, courseCodes) {
  const uniqueCodes = [...new Set(courseCodes)];
  const { data: courses, error: courseError } = await client
    .from("courses")
    .select("code")
    .in("code", uniqueCodes)
    .is("archived_at", null);
  if (courseError) throw new SafeHttpError("UPSTREAM_ERROR", 502, "과정 정보를 확인하지 못했습니다.");
  const activeCodes = (courses || []).map((course) => course.code);
  if (!activeCodes.length) return [];
  const { data, error } = await client
    .from("job_reflections")
    .select(JOB_REFLECTION_COLUMNS)
    .in("course_code", activeCodes)
    .order("created_at", { ascending: true });
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "회고를 불러오지 못했습니다.");
  const respondentIndex = new Map();
  return (data || []).map((row) => {
    const nextIndex = (respondentIndex.get(row.course_code) || 0) + 1;
    respondentIndex.set(row.course_code, nextIndex);
    return jobReflectionFromRow(row, { respondentIndex: nextIndex });
  });
}

async function findMine(client, secret, courseCode, participantId) {
  const course = await findCourse(client, courseCode);
  if (!findParticipant(course, participantId)) {
    throw new SafeHttpError("PARTICIPANT_NOT_FOUND", 403, "과정 참여자 정보를 확인할 수 없습니다.");
  }
  const participantKey = createParticipantKey(secret, courseCode, participantId);
  const { data, error } = await client
    .from("job_reflections")
    .select(JOB_REFLECTION_COLUMNS)
    .eq("course_code", courseCode)
    .eq("participant_key", participantKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "나의 회고를 불러오지 못했습니다.");
  return data ? jobReflectionFromRow(data, { participantId }) : null;
}

async function saveReflection(client, secret, courseCode, reflection) {
  const course = await findCourse(client, courseCode);
  const participant = findParticipant(course, reflection.participantId);
  if (!participant) {
    throw new SafeHttpError("PARTICIPANT_NOT_FOUND", 403, "과정 참여자 정보를 확인할 수 없습니다.");
  }
  validateReflection(course, participant, reflection);
  const row = jobReflectionToRow({ secret, courseCode, participant, reflection });
  const { data, error } = await client
    .from("job_reflections")
    .upsert(row, { onConflict: "course_code,participant_key,reflection_date" })
    .select(JOB_REFLECTION_COLUMNS)
    .single();
  if (error) throw new SafeHttpError("UPSTREAM_ERROR", 502, "회고를 저장하지 못했습니다.");

  const { error: touchError } = await client
    .from("courses")
    .update({ updated_at: new Date().toISOString() })
    .eq("code", courseCode)
    .is("archived_at", null);
  if (touchError) console.warn(JSON.stringify({ event: "job_reflection_realtime_touch_failed", courseCode }));
  return jobReflectionFromRow(data, { participantId: reflection.participantId });
}

export async function handleJobReflectionRequest(req, res, dependencies = {}) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw new SafeHttpError("METHOD_NOT_ALLOWED", 405, "POST 요청만 지원합니다.");
    }
    if (!hasJsonContentType(req)) {
      throw new SafeHttpError("UNSUPPORTED_MEDIA_TYPE", 415, "Content-Type은 application/json이어야 합니다.");
    }
    if (!isAllowedOrigin(req)) {
      throw new SafeHttpError("INVALID_ORIGIN", 403, "허용되지 않은 요청입니다.");
    }
    const body = requestSchema.parse(await readJsonBody(req));
    const { secret } = serverConfig();
    const client = dependencies.supabase || createServerSupabaseClient();

    if (body.action === "list") {
      return jsonResponse(res, 200, { ok: true, data: { reflections: await listReflections(client, body.courseCodes) } });
    }
    if (body.action === "mine") {
      return jsonResponse(res, 200, { ok: true, data: { reflection: await findMine(client, secret, body.courseCode, body.participantId) } });
    }
    return jsonResponse(res, 200, { ok: true, data: { reflection: await saveReflection(client, secret, body.courseCode, body.reflection) } });
  } catch (error) {
    let safeError = error;
    if (error instanceof ZodError || error instanceof RequestSecurityError) {
      safeError = new SafeHttpError(error.code || "INVALID_PAYLOAD", error.code === "PAYLOAD_TOO_LARGE" ? 413 : 422, "요청 데이터가 올바르지 않습니다.");
    } else if (!(error instanceof SafeHttpError)) {
      console.error(JSON.stringify({ event: "job_reflection_request_failed", error: error?.name || "Error" }));
      safeError = new SafeHttpError("UPSTREAM_ERROR", 502, "회고 서비스에 일시적인 문제가 있습니다.");
    }
    return jsonResponse(res, safeError.status, {
      ok: false,
      error: { code: safeError.code, message: safeError.message },
    });
  }
}

export default async function handler(req, res) {
  return handleJobReflectionRequest(req, res);
}
