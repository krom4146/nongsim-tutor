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

async function getLocalCourses() {
  const saved = readJson(COURSES_KEY, []);
  if (Array.isArray(saved) && saved.length) return saved.map(migrate).filter(Boolean).map(normalizeCourse);
  const activeCourse = migrate(readJson(ACTIVE_COURSE_KEY));
  return activeCourse ? [normalizeCourse(activeCourse)] : [];
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
  return courseFromRow(data);
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
  return (data || []).map(courseFromRow).filter(Boolean);
}

async function saveLocalCourse(course) {
  const courses = await getLocalCourses();
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
