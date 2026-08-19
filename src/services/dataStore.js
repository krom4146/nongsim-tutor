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
 * survey: id, classId, className, likert[], barriers[], applied, support,
 *         submittedAt (no name or participantId: anonymous response content)
 * achievement: id, participantId, name, classId, className, text, answers[],
 *              createdAt
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
const GOAL_COLUMNS = [
  "id",
  "course_code",
  "participant_id",
  "name",
  "class_id",
  "class_name",
  "text",
  "created_at",
].join(",");
const ACHIEVEMENT_COLUMNS = [
  "id",
  "course_code",
  "participant_id",
  "name",
  "class_id",
  "class_name",
  "text",
  "answers",
  "created_at",
].join(",");
const MISSION_COLUMNS = [
  "id",
  "course_code",
  "participant_id",
  "text",
  "elements",
  "checkpoints",
  "created_at",
].join(",");
const SURVEY_COLUMNS = [
  "id",
  "course_code",
  "class_id",
  "class_name",
  "likert",
  "barriers",
  "applied",
  "support",
  "submitted_at",
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

export function goalToRow(courseCode, goal) {
  return {
    id: goal.id,
    course_code: courseCode,
    participant_id: goal.participantId,
    name: goal.name || null,
    class_id: goal.classId || null,
    class_name: goal.className || null,
    text: goal.text || goal.goalText || "",
    created_at: goal.createdAt || new Date().toISOString(),
  };
}

export function goalFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_code,
    participantId: row.participant_id,
    name: row.name || "",
    classId: row.class_id || null,
    className: row.class_name || (row.class_id ? DEFAULT_CLASS_NAME : "미배정"),
    text: row.text || "",
    goalText: row.text || "",
    createdAt: row.created_at,
  };
}

export function achievementToRow(courseCode, achievement) {
  return {
    id: achievement.id,
    course_code: courseCode,
    participant_id: achievement.participantId,
    name: achievement.name || null,
    class_id: achievement.classId || null,
    class_name: achievement.className || null,
    text: achievement.text || "",
    answers: Array.isArray(achievement.answers) ? achievement.answers : [],
    created_at: achievement.createdAt || new Date().toISOString(),
  };
}

export function achievementFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_code,
    participantId: row.participant_id,
    name: row.name || "",
    classId: row.class_id || null,
    className: row.class_name || (row.class_id ? DEFAULT_CLASS_NAME : "미배정"),
    text: row.text || "",
    answers: Array.isArray(row.answers) ? row.answers : [],
    createdAt: row.created_at,
  };
}

function missionElements(elements = {}) {
  return {
    when: typeof elements.when === "string" ? elements.when : "",
    what: typeof elements.what === "string" ? elements.what : "",
    how: typeof elements.how === "string" ? elements.how : "",
  };
}

export function missionToRow(courseCode, mission) {
  return {
    id: mission.id,
    course_code: courseCode,
    participant_id: mission.participantId,
    text: mission.text || mission.missionText || "",
    elements: missionElements(mission.elements),
    checkpoints: Array.isArray(mission.missionCheckpoints)
      ? mission.missionCheckpoints
      : Array.isArray(mission.checkpoints)
        ? mission.checkpoints
        : [],
    created_at: mission.createdAt || new Date().toISOString(),
  };
}

export function missionFromRow(row) {
  if (!row) return null;
  const checkpoints = Array.isArray(row.checkpoints) ? row.checkpoints : [];
  return {
    id: row.id,
    courseId: row.course_code,
    participantId: row.participant_id,
    text: row.text || "",
    missionText: row.text || "",
    elements: missionElements(row.elements),
    checkpoints,
    missionCheckpoints: checkpoints,
    createdAt: row.created_at,
  };
}

export function latestMissionsByParticipant(missions = []) {
  const latestByParticipant = new Map();
  (missions || []).filter(Boolean).forEach((mission) => {
    const key = mission.participantId || mission.id;
    if (!key) return;
    const current = latestByParticipant.get(key);
    if (!current || (mission.createdAt || "").localeCompare(current.createdAt || "") >= 0) {
      latestByParticipant.set(key, mission);
    }
  });
  return [...latestByParticipant.values()].sort((a, b) =>
    (a.createdAt || "").localeCompare(b.createdAt || ""));
}

export function surveyToRow(courseCode, survey) {
  return {
    id: survey.id,
    course_code: courseCode,
    class_id: survey.classId || null,
    class_name: survey.className || null,
    likert: Array.isArray(survey.likert) ? survey.likert : [],
    barriers: Array.isArray(survey.barriers) ? survey.barriers : [],
    applied: survey.applied || "",
    support: survey.support || "",
    submitted_at: survey.submittedAt || survey.createdAt || new Date().toISOString(),
  };
}

export function surveyFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_code,
    classId: row.class_id || null,
    className: row.class_name || DEFAULT_CLASS_NAME,
    likert: Array.isArray(row.likert) ? row.likert : [],
    barriers: Array.isArray(row.barriers) ? row.barriers : [],
    applied: row.applied || "",
    support: row.support || "",
    submittedAt: row.submitted_at,
    createdAt: row.submitted_at,
  };
}

async function requestJobReflectionApi(action, payload = {}) {
  const response = await fetch("/api/job-reflections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error?.message || "직무강의 회고 서버 요청에 실패했습니다.");
  }
  return body.data;
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

async function getSupabaseOutcomeData(client, courseCodes) {
  const codes = [...new Set((courseCodes || []).filter(Boolean))];
  if (!codes.length) return new Map();
  const [goalResult, achievementResult, missionResult, surveyResult, jobReflections] = await Promise.all([
    client
      .from("goals")
      .select(GOAL_COLUMNS)
      .in("course_code", codes)
      .order("created_at", { ascending: true }),
    client
      .from("achievements")
      .select(ACHIEVEMENT_COLUMNS)
      .in("course_code", codes)
      .order("created_at", { ascending: true }),
    client
      .from("missions")
      .select(MISSION_COLUMNS)
      .in("course_code", codes)
      .order("created_at", { ascending: true }),
    client
      .from("surveys")
      .select(SURVEY_COLUMNS)
      .in("course_code", codes)
      .order("submitted_at", { ascending: true }),
    requestJobReflectionApi("list", { courseCodes: codes }).then((result) => result.reflections || []),
  ]);
  if (goalResult.error) throw new Error(errorMessage(goalResult.error));
  if (achievementResult.error) throw new Error(errorMessage(achievementResult.error));
  if (missionResult.error) throw new Error(errorMessage(missionResult.error));
  if (surveyResult.error) throw new Error(errorMessage(surveyResult.error));

  const outcomeByCourse = new Map(codes.map((code) => [code, { goals: [], achievements: [], missions: [], surveys: [], jobReflections: [] }]));
  (goalResult.data || []).map(goalFromRow).filter(Boolean).forEach((goal) => {
    const outcome = outcomeByCourse.get(goal.courseId);
    if (outcome) outcome.goals = mergeById(outcome.goals, goal);
  });
  (achievementResult.data || []).map(achievementFromRow).filter(Boolean).forEach((achievement) => {
    const outcome = outcomeByCourse.get(achievement.courseId);
    if (outcome) outcome.achievements = mergeById(outcome.achievements, achievement);
  });
  (missionResult.data || []).map(missionFromRow).filter(Boolean).forEach((mission) => {
    const outcome = outcomeByCourse.get(mission.courseId);
    if (outcome) outcome.missions = mergeById(outcome.missions, mission);
  });
  (surveyResult.data || []).map(surveyFromRow).filter(Boolean).forEach((survey) => {
    const outcome = outcomeByCourse.get(survey.courseId);
    if (outcome) outcome.surveys = mergeById(outcome.surveys, survey);
  });
  (jobReflections || []).filter(Boolean).forEach((reflection) => {
    const outcome = outcomeByCourse.get(reflection.courseId);
    if (outcome) outcome.jobReflections = mergeById(outcome.jobReflections, reflection);
  });
  return outcomeByCourse;
}

function withOutcomeData(course, outcome = {}) {
  const goals = outcome.goals || [];
  const participantById = new Map((course.participants || []).map((participant) => [
    participant.participantId || participant.id,
    participant,
  ]));
  const goalByParticipantId = new Map(goals.map((goal) => [goal.participantId, goal]));
  const achievements = (outcome.achievements || []).map((achievement) => {
    const participant = participantById.get(achievement.participantId);
    return {
      ...achievement,
      name: achievement.name || participant?.name || participant?.studentName || "",
      classId: achievement.classId || participant?.classId || null,
      className: achievement.className || participant?.className || "미배정",
    };
  });
  const missions = latestMissionsByParticipant(outcome.missions || []).map((mission) => {
    const participant = participantById.get(mission.participantId);
    const checkpoints = Array.isArray(mission.missionCheckpoints) ? mission.missionCheckpoints : [];
    return {
      ...mission,
      classId: participant?.classId || null,
      className: participant?.className || "미배정",
      goalId: goalByParticipantId.get(mission.participantId)?.id,
      dueDate: course.transferDate,
      status: checkpoints.length && checkpoints.every((checkpoint) => checkpoint.status === "completed") ? "done" : "assigned",
    };
  });
  return normalizeCourse({
    ...course,
    goals,
    achievements,
    missions,
    surveys: outcome.surveys || [],
    jobReflections: outcome.jobReflections || [],
  });
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
  const baseCourse = courseFromRow(data);
  const [activities, outcomes] = await Promise.all([
    getSupabaseActivities(clientResult.client, [code]),
    getSupabaseOutcomeData(clientResult.client, [code]),
  ]);
  return withOutcomeData(
    { ...baseCourse, rounds: activities.get(code) || [] },
    outcomes.get(code),
  );
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
  const courseCodes = courses.map((course) => course.code);
  const [activities, outcomes] = await Promise.all([
    getSupabaseActivities(clientResult.client, courseCodes),
    getSupabaseOutcomeData(clientResult.client, courseCodes),
  ]);
  return courses.map((course) => withOutcomeData(
    { ...course, rounds: activities.get(course.code) || [] },
    outcomes.get(course.code),
  ));
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

export async function saveGoal(course, goal) {
  if (DATA_MODE === "local") {
    const savedGoal = { ...goal, courseId: course.code };
    const result = await saveLocalCourse({ ...course, goals: mergeById(course.goals, savedGoal) });
    return result.ok ? { ...result, goal: savedGoal } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("goals")
      .upsert(goalToRow(course.code, goal), { onConflict: "id" })
      .select(GOAL_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, goal: goalFromRow(data) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveAchievement(course, achievement) {
  if (DATA_MODE === "local") {
    const savedAchievement = { ...achievement, courseId: course.code };
    const result = await saveLocalCourse({
      ...course,
      achievements: mergeById(course.achievements, savedAchievement),
    });
    return result.ok ? { ...result, achievement: savedAchievement } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("achievements")
      .upsert(achievementToRow(course.code, achievement), { onConflict: "course_code,participant_id" })
      .select(ACHIEVEMENT_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, achievement: achievementFromRow(data) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveMission(course, mission) {
  if (DATA_MODE === "local") {
    const existingMission = latestMissionsByParticipant(course.missions)
      .find((item) => item.participantId === mission.participantId);
    const savedMission = {
      ...mission,
      id: existingMission?.id || mission.id,
      courseId: course.code,
      createdAt: existingMission?.createdAt || mission.createdAt,
    };
    const missions = latestMissionsByParticipant(mergeById(course.missions, savedMission));
    const result = await saveLocalCourse({ ...course, missions });
    return result.ok ? { ...result, mission: savedMission } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data: existingRows, error: existingError } = await clientResult.client
      .from("missions")
      .select("id,created_at")
      .eq("course_code", course.code)
      .eq("participant_id", mission.participantId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (existingError) return { ok: false, error: errorMessage(existingError) };
    const existingMission = existingRows?.[0];
    const missionRow = missionToRow(course.code, {
      ...mission,
      id: existingMission?.id || mission.id,
      createdAt: existingMission?.created_at || mission.createdAt,
    });
    const { data, error } = await clientResult.client
      .from("missions")
      .upsert(missionRow, { onConflict: "id" })
      .select(MISSION_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, mission: missionFromRow(data) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveSurvey(course, survey) {
  if (!survey.classId || !survey.className) {
    return { ok: false, error: "Survey class information is required." };
  }
  if (DATA_MODE === "local") {
    const savedSurvey = { ...survey, courseId: course.code };
    const result = await saveLocalCourse({ ...course, surveys: mergeById(course.surveys, savedSurvey) });
    return result.ok ? { ...result, survey: savedSurvey } : result;
  }

  const clientResult = getSupabaseClient();
  if (!clientResult.ok) return clientResult;
  try {
    const { data, error } = await clientResult.client
      .from("surveys")
      .insert(surveyToRow(course.code, survey))
      .select(SURVEY_COLUMNS)
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    return { ok: true, survey: surveyFromRow(data) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveJobReflection(course, reflection) {
  if (!reflection.participantId || !reflection.classId || !reflection.className || !reflection.date) {
    return { ok: false, error: "Job reflection participant, class, and date are required." };
  }
  if (DATA_MODE === "local") {
    const savedJobReflection = { ...reflection, courseId: course.code };
    const result = await saveLocalCourse({
      ...course,
      jobReflections: mergeById(course.jobReflections, savedJobReflection),
    });
    return result.ok ? { ...result, jobReflection: savedJobReflection } : result;
  }

  try {
    const data = await requestJobReflectionApi("save", {
      courseCode: course.code,
      reflection,
    });
    return { ok: true, jobReflection: data.reflection };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function getJobReflection(courseCode, participantId) {
  if (DATA_MODE === "local") {
    const course = await getCourse(courseCode);
    const reflection = [...(course?.jobReflections || [])]
      .filter((item) => item.participantId === participantId)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
    return { ok: true, jobReflection: reflection };
  }
  try {
    const data = await requestJobReflectionApi("mine", { courseCode, participantId });
    return { ok: true, jobReflection: data.reflection || null };
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
