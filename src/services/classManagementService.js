export const DEFAULT_CLASS_ID = "class-1";
export const DEFAULT_CLASS_NAME = "1반";

export function createClasses(classCount = 1) {
  const safeCount = Math.min(4, Math.max(1, Number(classCount) || 1));
  return Array.from({ length: safeCount }, (_, index) => ({
    id: `class-${index + 1}`,
    name: `${index + 1}반`,
  }));
}

export function classMeta(item = {}) {
  return {
    classId: item.classId || DEFAULT_CLASS_ID,
    className: item.className || DEFAULT_CLASS_NAME,
  };
}

export function withClass(item, fallback = {}) {
  return { ...item, ...classMeta({ ...fallback, ...item }) };
}

export function normalizeRound(round = {}) {
  const scope = "class";
  return {
    ...round,
    scope,
    classId: round.classId || DEFAULT_CLASS_ID,
    className: round.className || (round.classId ? `${round.classId.replace("class-", "")}반` : DEFAULT_CLASS_NAME),
    items: (round.items || []).map((item) => withClass(item)),
  };
}

export function normalizeClassCourse(course = {}) {
  const classes = course.classes?.length ? course.classes.slice(0, 4) : createClasses(course.classCount);
  const safeClasses = classes.map((item, index) => ({
    id: item.id || `class-${index + 1}`,
    name: item.name || `${index + 1}반`,
  }));
  const normalizeList = (items) => (items || []).map((item) => withClass(item));
  const normalizeGoals = (items) => (items || []).map((item) => ({
    ...item,
    classId: item.classId || null,
    className: item.className || "미배정",
  }));
  return {
    ...course,
    classCount: safeClasses.length || 1,
    classes: safeClasses.length ? safeClasses : createClasses(1),
    participants: normalizeList(course.participants),
    goals: normalizeGoals(course.goals),
    achievements: normalizeList(course.achievements),
    surveys: normalizeList(course.surveys),
    missions: normalizeList(course.missions),
    learningChecks: normalizeList(course.learningChecks),
    legacyJobChecks: normalizeList(course.legacyJobChecks),
    jobSessions: normalizeList(course.jobSessions),
    jobReflections: normalizeList(course.jobReflections),
    roleplaySessions: normalizeList(course.roleplaySessions),
    reportTrainings: normalizeList(course.reportTrainings),
    rounds: (course.rounds || []).map(normalizeRound),
    roleplayConfig: {
      ...(course.roleplayConfig || {}),
      scope: "class",
      classId: course.roleplayConfig?.classId || DEFAULT_CLASS_ID,
      className: course.roleplayConfig?.className || DEFAULT_CLASS_NAME,
    },
  };
}

export function isVisibleToClass(item, classId) {
  return item.classId === classId;
}

export function matchesClass(item, classId) {
  return classId === "all" || (item.classId || DEFAULT_CLASS_ID) === classId;
}

export function filterCourseByClass(course, classId = "all") {
  if (classId === "all") return course;
  const filterList = (items) => (items || []).filter((item) => matchesClass(item, classId));
  return {
    ...course,
    goals: filterList(course.goals),
    achievements: filterList(course.achievements),
    surveys: filterList(course.surveys),
    missions: filterList(course.missions),
    jobReflections: filterList(course.jobReflections),
    reportTrainings: filterList(course.reportTrainings),
    roleplaySessions: filterList(course.roleplaySessions),
    rounds: (course.rounds || [])
      .filter((round) => isVisibleToClass(round, classId))
      .map((round) => ({ ...round, items: filterList(round.items) })),
  };
}

export function participantCountForClass(course, classId = "all") {
  if (classId === "all") return course.participantCount || 0;
  const registered = (course.participants || []).filter((item) => matchesClass(item, classId)).length;
  return registered || Math.ceil((course.participantCount || 0) / Math.max(1, course.classCount || 1));
}
