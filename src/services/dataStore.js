import { CURRENT_SCHEMA_VERSION, migrate, normalizeCourse } from "./localStorageRepository.js";
import { notifyCourseChanged } from "./realtimeBridge.js";
import { DATA_MODE, getSupabaseClient } from "./supabaseClient.js";

/*
 * Storage schema contract (Supabase table design draft)
 *
 * course: code, type, name, cohort, startDate, endDate, transferDate,
 *         classes[], participants[], schemaVersion
 * goal: id, participantId, name, classId, className, text, createdAt
 * round: id, kind("poll" | "board"), prompt, anonymous, questionIntent,
 *        items[], createdAt
 * roundItem: id, by, text | url, reactions{}, createdAt
 * survey: id, participantId, classId, className, likert[], barriers[],
 *         applied, support, submittedAt (no name: anonymous response content)
 * mission: id, participantId, text, elements{when, what, how},
 *          missionCheckpoints[], createdAt
 *
 * Every entity uses id and createdAt for database identity and ordering.
 */

const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSES_KEY = "nongsim-courses-v3";
const COLLECTION_KEYS = {
  stamps: "ideologyStamps",
  studentProfiles: "nongsim-student-profiles-v1",
  demoNotification: "nongsim-followup-demo-notification",
};
const STORAGE_WARNING_MESSAGE = "\uC800\uC7A5 \uACF5\uAC04\uC774 \uAC00\uB4DD \uCC3C\uC2B5\uB2C8\uB2E4. \uC624\uB798\uB41C \uC7A5\uD45C \uC774\uBBF8\uC9C0\uB97C \uC815\uB9AC\uD558\uAC70\uB098 \uC0C8 \uACFC\uC815\uC73C\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.";
const COURSE_COLUMNS = [
  "code",
  "type",
  "name",
  "cohort",
  "start_date",
  "end_date",
  "transfer_date",
  "classes",
  "participants",
  "data",
  "schema_version",
  "created_at",
  "updated_at",
].join(",");
const ROUND_COLUMNS = [
  "id",
  "course_code",
  "kind",
  "prompt",
  "anonymous",
  "question_intent",
  "created_at",
].join(",");
const ROUND_ITEM_COLUMNS = [
  "id",
  "round_id",
  "course_code",
  "by_name",
  "text",
  "url",
  "reactions",
  "created_at",
].join(",");
const ACTIVITY_PAYLOAD_PREFIX = "nongsim:v1:";
const DEFAULT_CLASS_ID = "class-1";
const DEFAULT_CLASS_NAME = "1반";
const COURSE_DATA_FIELDS = [
  "templateId",
  "privacyNoticeAccepted",
  "participantCount",
  "classCount",
  "leadershipGrade",
  "learningChecks",
  "jobSessions",
  "roleplayConfig",
  "reportTrainings",
  "checkpointConfig",
  "olympicActivityOpen",
];

function errorMessage(error) {
  return error instanceof Error ? error.message : error?.message || String(error);
}

function encodeActivityPayload(value) {
  return `${ACTIVITY_PAYLOAD_PREFIX}${JSON.stringify(value)}`;
}

function decodeActivityPayload(value) {
  if (typeof value !== "string" || !value.startsWith(ACTIVITY_PAYLOAD_PREFIX)) return null;
  try {
    return JSON.parse(value.slice(ACTIVITY_PAYLOAD_PREFIX.length));
  } catch (error) {
    console.warn("활동 메타데이터를 복원하지 못했습니다.", error);
    return null;
  }
}

function mergeById(items, incoming) {
  const merged = new Map((items || []).filter((item) => item?.id).map((item) => [item.id, item]));
  if (incoming?.id) merged.set(incoming.id, incoming);
  return [...merged.values()];
}

export function roundToRow(courseCode, round) {
  const metadata = {
    questionIntent: round.questionIntent ?? null,
    questionType: round.questionType ?? "subjective",
    options: Array.isArray(round.options) ? round.options : [],
    scope: round.scope ?? "class",
    classId: round.classId ?? DEFAULT_CLASS_ID,
    className: round.className ?? DEFAULT_CLASS_NAME,
    description: round.description ?? null,
  };
  return {
    id: round.id,
    course_code: courseCode,
    kind: round.kind,
    prompt: round.prompt ?? "",
    anonymous: round.anonymous === true,
    question_intent: encodeActivityPayload(metadata),
    created_at: round.createdAt || new Date().toISOString(),
  };
}

export function roundFromRow(row) {
  if (!row) return null;
  const metadata = decodeActivityPayload(row.question_intent);
  return {
    id: row.id,
    courseId: row.course_code,
    kind: row.kind,
    prompt: row.prompt || "",
    anonymous: row.anonymous === true,
    questionIntent: metadata?.questionIntent ?? (metadata ? null : row.question_intent),
    questionType: metadata?.questionType || "subjective",
    options: Array.isArray(metadata?.options) ? metadata.options : [],
    scope: metadata?.scope || "class",
    classId: metadata?.classId || DEFAULT_CLASS_ID,
    className: metadata?.className || DEFAULT_CLASS_NAME,
    description: metadata?.description || undefined,
    items: [],
    createdAt: row.created_at,
  };
}

export function roundItemToRow(courseCode, round, item) {
  const content = {
    text: item.text ?? "",
    participantId: item.participantId ?? null,
    choice: item.choice ?? null,
  };
  return {
    id: item.id,
    round_id: round.id,
    course_code: courseCode,
    by_name: round.anonymous === true ? "익명" : String(item.by || "").trim(),
    text: encodeActivityPayload(content),
    url: item.url || item.imageUrl || null,
    reactions: item.reactions && typeof item.reactions === "object" ? item.reactions : {},
    created_at: item.createdAt || new Date().toISOString(),
  };
}

export function roundItemFromRow(row, round = null) {
  if (!row) return null;
  const content = decodeActivityPayload(row.text);
  return {
    id: row.id,
    roundId: row.round_id,
    courseId: row.course_code,
    participantId: content?.participantId || null,
    by: row.by_name || (round?.anonymous ? "익명" : ""),
    classId: round?.classId || DEFAULT_CLASS_ID,
    className: round?.className || DEFAULT_CLASS_NAME,
    text: content?.text ?? row.text ?? "",
    choice: content?.choice || undefined,
    url: row.url || undefined,
    reactions: row.reactions && typeof row.reactions === "object" ? row.reactions : {},
    createdAt: row.created_at,
  };
}

async function getSupabaseActivities(client, courseCodes) {
  const codes = [...new Set((courseCodes || []).filter(Boolean))];
  if (!codes.length) return new Map();
  const [roundResult, itemResult] = await Promise.all([
    client
      .from("rounds")
      .select(ROUND_COLUMNS)
      .in("course_code", codes)
      .order("created_at", { ascending: true }),
    client
      .from("round_items")
      .select(ROUND_ITEM_COLUMNS)
      .in("course_code", codes)
      .order("created_at", { ascending: true }),
  ]);
  if (roundResult.error) throw new Error(errorMessage(roundResult.error));
  if (itemResult.error) throw new Error(errorMessage(itemResult.error));

  const rounds = (roundResult.data || []).map(roundFromRow).filter(Boolean);
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  (itemResult.data || []).forEach((row) => {
    const round = roundById.get(row.round_id);
    if (!round || round.courseId !== row.course_code) return;
    const item = roundItemFromRow(row, round);
    round.items = mergeById(round.items, item);
  });

  const activitiesByCourse = new Map(codes.map((code) => [code, []]));
  rounds.forEach((round) => {
    const courseRounds = activitiesByCourse.get(round.courseId) || [];
    activitiesByCourse.set(round.courseId, mergeById(courseRounds, round));
  });
  return activitiesByCourse;
}

function courseData(course = {}) {
  const source = course && typeof course === "object" && !Array.isArray(course) ? course : {};
  return COURSE_DATA_FIELDS.reduce((data, field) => {
    if (source[field] !== undefined) data[field] = source[field];
    return data;
  }, {});
}

export function courseFromRow(row) {
  if (!row) return null;
  return normalizeCourse({
    ...courseData(row.data),
    code: row.code,
    type: row.type,
    name: row.name,
    cohort: row.cohort,
    startDate: row.start_date,
    endDate: row.end_date,
    transferDate: row.transfer_date,
    classes: Array.isArray(row.classes) ? row.classes : [],
    participants: Array.isArray(row.participants) ? row.participants : [],
    schemaVersion: row.schema_version ?? CURRENT_SCHEMA_VERSION,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function courseToRow(course) {
  const normalized = normalizeCourse({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION });
  const row = {
    code: normalized.code,
    type: normalized.type ?? null,
    name: normalized.name ?? null,
    cohort: normalized.cohort ?? null,
    start_date: normalized.startDate ?? null,
    end_date: normalized.endDate ?? null,
    transfer_date: normalized.transferDate ?? null,
    classes: normalized.classes || [],
    participants: normalized.participants || [],
    data: courseData(normalized),
    schema_version: CURRENT_SCHEMA_VERSION,
  };
  if (normalized.createdAt) row.created_at = normalized.createdAt;
  return row;
}

function storageError(error) {
  console.warn("localStorage save failed:", error);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nongsim-storage-warning", { detail: { message: STORAGE_WARNING_MESSAGE } }));
  }
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return storageError(error);
  }
}

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("localStorage read failed:", error);
    return fallback;
  }
}

function getStoredLocalCourses() {
  const saved = readJson(COURSES_KEY, []);
  if (Array.isArray(saved) && saved.length) {
    return saved.map(migrate).filter(Boolean).map(normalizeCourse);
  }
  const activeCourse = migrate(readJson(ACTIVE_COURSE_KEY));
  return activeCourse ? [normalizeCourse(activeCourse)] : [];
}

async function getLocalCourses() {
  return getStoredLocalCourses().filter((course) => !course.archivedAt);
}

export async function getCourse(code) {
  if (DATA_MODE === "local") {
    const courses = await getLocalCourses();
    return courses.find((course) => course.code === code) || null;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) throw new Error(clientResult.error);
  const { data, error } = await clientResult.client
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("code", code)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(errorMessage(error));
  if (!data) return null;
  const activities = await getSupabaseActivities(clientResult.client, [code]);
  return { ...courseFromRow(data), rounds: activities.get(code) || [] };
}

export async function getCourses() {
  if (DATA_MODE === "local") return getLocalCourses();

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) throw new Error(clientResult.error);
  const { data, error } = await clientResult.client
    .from("courses")
    .select(COURSE_COLUMNS)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(errorMessage(error));
  const courses = (data || []).map(courseFromRow).filter(Boolean);
  const activities = await getSupabaseActivities(clientResult.client, courses.map((course) => course.code));
  return courses.map((course) => ({ ...course, rounds: activities.get(course.code) || [] }));
}

async function saveLocalCourse(course) {
  const courses = getStoredLocalCourses();
  const normalized = normalizeCourse({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION });
  const index = courses.findIndex((item) => item.code === normalized.code);
  const nextCourses = index >= 0
    ? courses.map((item, itemIndex) => itemIndex === index ? normalized : item)
    : [...courses, normalized];
  const result = safeWrite(COURSES_KEY, nextCourses);
  if (result.ok) notifyCourseChanged(normalized.code);
  return result;
}

export async function saveCourse(course) {
  if (DATA_MODE === "local") return saveLocalCourse(course);

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { error } = await clientResult.client
      .from("courses")
      .upsert(courseToRow(course), { onConflict: "code" });
    return error ? { ok: false, error: errorMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveRound(course, round) {
  if (DATA_MODE === "local") {
    const savedRound = { ...round, courseId: course.code, items: round.items || [] };
    const nextCourse = { ...course, rounds: mergeById(course.rounds, savedRound) };
    const result = await saveLocalCourse(nextCourse);
    return result.ok ? { ...result, round: savedRound } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("rounds")
      .upsert(roundToRow(course.code, round), { onConflict: "id" })
      .select(ROUND_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, round: roundFromRow(data) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveRoundItem(course, round, item) {
  if (DATA_MODE === "local") {
    const savedItem = {
      ...item,
      by: round.anonymous === true ? "익명" : item.by,
      classId: round.classId || item.classId || DEFAULT_CLASS_ID,
      className: round.className || item.className || DEFAULT_CLASS_NAME,
    };
    const nextCourse = {
      ...course,
      rounds: (course.rounds || []).map((currentRound) => currentRound.id === round.id
        ? { ...currentRound, items: mergeById(currentRound.items, savedItem) }
        : currentRound),
    };
    if (!nextCourse.rounds.some((currentRound) => currentRound.id === round.id)) {
      return { ok: false, error: "Round not found." };
    }
    const result = await saveLocalCourse(nextCourse);
    return result.ok ? { ...result, item: savedItem } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("round_items")
      .upsert(roundItemToRow(course.code, round, item), { onConflict: "id" })
      .select(ROUND_ITEM_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, item: roundItemFromRow(data, round) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function bumpReaction(course, roundId, itemId, reactionKey, delta) {
  if (reactionKey !== "agree") return { ok: false, error: "Unsupported reaction key." };
  if (![-1, 1].includes(delta)) return { ok: false, error: "Reaction delta must be -1 or 1." };

  if (DATA_MODE === "local") {
    const round = (course.rounds || []).find((currentRound) => currentRound.id === roundId);
    const item = round?.items?.find((currentItem) => currentItem.id === itemId);
    if (!item) return { ok: false, error: "Round item not found." };
    const reactions = {
      ...(item.reactions || {}),
      agree: Math.max(0, Number(item.reactions?.agree || 0) + delta),
    };
    const nextCourse = {
      ...course,
      rounds: course.rounds.map((currentRound) => currentRound.id === roundId
        ? {
          ...currentRound,
          items: currentRound.items.map((currentItem) => currentItem.id === itemId
            ? { ...currentItem, reactions }
            : currentItem),
        }
        : currentRound),
    };
    const result = await saveLocalCourse(nextCourse);
    return result.ok ? { ...result, reactions } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client.rpc("bump_reaction", {
      p_item_id: itemId,
      p_kind: reactionKey,
      p_delta: delta,
    });
    if (error) return { ok: false, error: errorMessage(error) };
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "Invalid reaction response." };
    }
    return { ok: true, reactions: data };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function saveLocalCourses(courses) {
  const normalized = (courses || []).map((course) => normalizeCourse({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION }));
  const result = safeWrite(COURSES_KEY, normalized);
  if (result.ok) normalized.forEach((course) => notifyCourseChanged(course.code));
  return result;
}

export async function saveCourses(courses) {
  if (DATA_MODE === "local") return saveLocalCourses(courses);

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  const rows = (courses || []).map(courseToRow);
  if (!rows.length) return { ok: true };
  try {
    const { error } = await clientResult.client
      .from("courses")
      .upsert(rows, { onConflict: "code" });
    return error ? { ok: false, error: errorMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function archiveCourse(code) {
  if (DATA_MODE === "local") {
    const courses = getStoredLocalCourses();
    const index = courses.findIndex((course) => course.code === code && !course.archivedAt);
    if (index < 0) return { ok: false, error: "Course not found." };
    const archivedAt = new Date().toISOString();
    const result = safeWrite(COURSES_KEY, courses.map((course, itemIndex) => (
      itemIndex === index ? { ...course, archivedAt } : course
    )));
    if (result.ok) notifyCourseChanged(code);
    return result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("courses")
      .update({ archived_at: new Date().toISOString() })
      .eq("code", code)
      .is("archived_at", null)
      .select("code")
      .maybeSingle();
    if (error) return { ok: false, error: errorMessage(error) };
    if (!data) return { ok: false, error: "Course not found or already archived." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function getActiveCourseCode() {
  const saved = migrate(readJson(ACTIVE_COURSE_KEY));
  return saved?.code || null;
}

export async function setActiveCourseCode(code) {
  try {
    const course = await getCourse(code);
    if (!course) return { ok: false, error: "Course not found." };
    return safeWrite(ACTIVE_COURSE_KEY, { ...course, schemaVersion: CURRENT_SCHEMA_VERSION });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function getCollection(name) {
  const key = COLLECTION_KEYS[name];
  if (!key) return null;
  const saved = readJson(key, null);
  if (!saved || Array.isArray(saved)) return saved;
  return migrate(saved);
}

export async function setCollection(name, value) {
  const key = COLLECTION_KEYS[name];
  if (!key) return { ok: false, error: `Unsupported collection: ${name}` };
  const savedValue = value && !Array.isArray(value) && typeof value === "object"
    ? { ...value, schemaVersion: CURRENT_SCHEMA_VERSION }
    : value;
  return safeWrite(key, savedValue);
}
