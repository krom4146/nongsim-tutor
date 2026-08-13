import { CURRENT_SCHEMA_VERSION, migrate, normalizeCourse } from "./localStorageRepository";
import { notifyCourseChanged } from "./realtimeBridge";

const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSES_KEY = "nongsim-courses-v3";
const COLLECTION_KEYS = {
  stamps: "ideologyStamps",
  studentProfiles: "nongsim-student-profiles-v1",
  demoNotification: "nongsim-followup-demo-notification",
};
const STORAGE_WARNING_MESSAGE = "\uC800\uC7A5 \uACF5\uAC04\uC774 \uAC00\uB4DD \uCC3C\uC2B5\uB2C8\uB2E4. \uC624\uB798\uB41C \uC7A5\uD45C \uC774\uBBF8\uC9C0\uB97C \uC815\uB9AC\uD558\uAC70\uB098 \uC0C8 \uACFC\uC815\uC73C\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.";

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

export async function getCourses() {
  const saved = readJson(COURSES_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.map(migrate).filter(Boolean).map(normalizeCourse);
}

export async function getCourse(code) {
  const courses = await getCourses();
  return courses.find((course) => course.code === code) || null;
}

export async function saveCourse(course) {
  const courses = await getCourses();
  const normalized = normalizeCourse({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION });
  const index = courses.findIndex((item) => item.code === normalized.code);
  const nextCourses = index >= 0
    ? courses.map((item, itemIndex) => itemIndex === index ? normalized : item)
    : [...courses, normalized];
  const result = safeWrite(COURSES_KEY, nextCourses);
  if (result.ok) notifyCourseChanged(normalized.code);
  return result;
}

export async function saveCourses(courses) {
  const normalized = (courses || []).map((course) => normalizeCourse({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION }));
  const result = safeWrite(COURSES_KEY, normalized);
  if (result.ok) normalized.forEach((course) => notifyCourseChanged(course.code));
  return result;
}

export async function getActiveCourseCode() {
  const saved = migrate(readJson(ACTIVE_COURSE_KEY));
  return saved?.code || null;
}

export async function setActiveCourseCode(code) {
  const course = await getCourse(code);
  if (!course) return { ok: false, error: "Course not found." };
  const result = safeWrite(ACTIVE_COURSE_KEY, { ...course, schemaVersion: CURRENT_SCHEMA_VERSION });
  if (result.ok) notifyCourseChanged(code);
  return result;
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
