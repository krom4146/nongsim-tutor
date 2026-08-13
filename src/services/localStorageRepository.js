import { seedCourse } from "../data";
import { generateParticipantCode, generateParticipantId, generateReentryToken, getTransferDate, now, personalFollowupLink } from "../utils";
import { normalizeClassCourse } from "./classManagementService";

const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSES_KEY = "nongsim-courses-v3";
export const CURRENT_SCHEMA_VERSION = 1;

export function migrate(saved) {
  if (!saved) return null;
  if (!saved.schemaVersion) return { ...saved, schemaVersion: CURRENT_SCHEMA_VERSION };
  if (saved.schemaVersion > CURRENT_SCHEMA_VERSION) return null;
  return saved;
}

export function normalizeCourse(course) {
  const legacyPrompt = "현장에서 실수를 발견했을 때 가장 먼저 해야 할 행동은 무엇인가요?";
  const baseCourse = {
    ...course,
    cohort: course.cohort === "신규 과정" ? "" : course.cohort,
    transferDate: getTransferDate(course),
    rounds: (course.rounds || []).filter((round) => round.prompt !== legacyPrompt),
    learningChecks: course.learningChecks || [],
    legacyJobChecks: course.legacyJobChecks || course.learningChecks || [],
    jobSessions: course.jobSessions || [],
    jobReflections: course.jobReflections || [],
    roleplayConfig: course.roleplayConfig || { enabled: false, scenario: "민원 발생 보고", difficulty: "보통" },
    roleplaySessions: course.roleplaySessions || [],
    reportTrainings: course.reportTrainings || course.roleplaySessions || [],
  };
  const participantSources = [
    ...(baseCourse.participants || []),
    ...(baseCourse.goals || []).map((item) => ({ id: item.participantId, name: item.name, courseId: baseCourse.code, classId: item.classId, className: item.className, createdAt: item.createdAt })),
    ...(baseCourse.achievements || []).map((item) => ({ id: item.participantId, name: item.name, courseId: baseCourse.code, classId: item.classId, className: item.className, createdAt: item.createdAt })),
    ...(baseCourse.surveys || []).map((item) => ({ id: item.participantId, name: item.name, courseId: baseCourse.code, classId: item.classId, className: item.className, createdAt: item.createdAt })),
  ];
  const participants = [];
  participantSources.forEach((source) => {
    if (!source?.name && !source?.studentName) return;
    const participantId = source.participantId || source.id || generateParticipantId();
    if (participants.some((item) => item.id === participantId || item.participantId === participantId)) return;
    const classInfo = source.classId ? { id: source.classId, name: source.className || `${String(source.classId).replace("class-", "")}반` } : null;
    const token = source.reentryToken || generateReentryToken();
    const participant = {
      ...source,
      id: participantId,
      participantId,
      courseId: source.courseId || baseCourse.code,
      courseCode: source.courseCode || baseCourse.code,
      name: source.name || source.studentName,
      studentName: source.studentName || source.name,
      classId: source.classId || null,
      className: source.className || "미배정",
      participantCode: source.participantCode || generateParticipantCode({ ...baseCourse, participants }, classInfo),
      reentryToken: token,
      personalFollowupLink: source.personalFollowupLink || personalFollowupLink(token),
      createdAt: source.createdAt || now(),
      lastAccessAt: source.lastAccessAt || source.lastActiveAt || now(),
    };
    participants.push(participant);
  });
  return normalizeClassCourse({ ...baseCourse, participants, schemaVersion: CURRENT_SCHEMA_VERSION });
}

export function loadActiveCourse() {
  try {
    const saved = localStorage.getItem(ACTIVE_COURSE_KEY);
    const migrated = saved ? migrate(JSON.parse(saved)) : seedCourse;
    return normalizeCourse(migrated ? { ...seedCourse, ...migrated } : seedCourse);
  } catch {
    return normalizeCourse(seedCourse);
  }
}

export function saveActiveCourse(course) {
  localStorage.setItem(ACTIVE_COURSE_KEY, JSON.stringify({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION }));
}

export function loadCourses() {
  try {
    const saved = localStorage.getItem(COURSES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        const migrated = parsed.map(migrate).filter(Boolean);
        if (migrated.length) return migrated.map(normalizeCourse);
      }
    }
    return [loadActiveCourse()];
  } catch {
    return [normalizeCourse(seedCourse)];
  }
}

export function saveCourses(courses) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses.map((course) => ({ ...course, schemaVersion: CURRENT_SCHEMA_VERSION }))));
}

export const storageKeys = { activeCourse: ACTIVE_COURSE_KEY, courses: COURSES_KEY };
