import { generateParticipantCode, generateParticipantId, generateReentryToken, getTransferDate, now, personalFollowupLink } from "../utils.js";
import { normalizeClassCourse } from "./classManagementService.js";

export const CURRENT_SCHEMA_VERSION = 1;

export function migrate(saved) {
  if (!saved) return null;
  if (!saved.schemaVersion) return { ...saved, schemaVersion: CURRENT_SCHEMA_VERSION };
  if (saved.schemaVersion > CURRENT_SCHEMA_VERSION) return null;
  return saved;
}

export function normalizeCourse(course) {
  const legacyPrompt = "현장에서 실수를 발견했을 때 가장 먼저 해야 할 행동은 무엇인가요?";
  const courseCreatedAt = course.createdAt || now();
  const withIdentity = (item = {}, index, prefix) => ({
    ...item,
    id: item.id || `${prefix}-${item.participantId || index + 1}-${item.createdAt || courseCreatedAt}`,
    createdAt: item.createdAt || item.submittedAt || courseCreatedAt,
  });
  const baseCourse = {
    ...course,
    id: course.id || course.code,
    createdAt: courseCreatedAt,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    cohort: course.cohort === "신규 과정" ? "" : course.cohort,
    transferDate: getTransferDate(course),
    goals: (course.goals || []).map((item, index) => withIdentity(item, index, "goal")),
    surveys: (course.surveys || []).map((item, index) => {
      const normalized = withIdentity(item, index, "survey");
      return { ...normalized, submittedAt: item.submittedAt || normalized.createdAt };
    }),
    missions: (course.missions || []).map((item, index) => {
      const normalized = withIdentity(item, index, "mission");
      return {
        ...normalized,
        text: item.text || item.missionText || "",
        elements: item.elements || { when: "", what: "", how: "" },
        missionCheckpoints: item.missionCheckpoints || [],
      };
    }),
    rounds: (course.rounds || [])
      .filter((round) => round.prompt !== legacyPrompt)
      .map((round, roundIndex) => {
        const normalizedRound = withIdentity(round, roundIndex, "round");
        return {
          ...normalizedRound,
          anonymous: Boolean(round.anonymous),
          questionIntent: round.questionIntent || null,
          items: (round.items || []).map((item, itemIndex) => ({
            ...withIdentity(item, itemIndex, `${normalizedRound.id}-item`),
            url: item.url || item.imageUrl || null,
          })),
        };
      }),
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
