import { DATA_MODE } from "./supabaseClient.js";
import { getCourse, saveCourse } from "./dataStore.js";

const env = import.meta.env ?? {};
const DEMO_COURSE_CODE = "NH-2480";

const demoCourse = {
  schemaVersion: 1,
  code: DEMO_COURSE_CODE,
  type: "newbie",
  name: "2026 신규직원 농협이념·현장실무 과정",
  cohort: "제24기",
  startDate: "2026-06-24",
  endDate: "2026-06-26",
  transferDate: "2026-08-26",
  createdAt: "2026-06-01T09:00:00.000Z",
  templateId: "newbie-v3",
  privacyNoticeAccepted: true,
  participantCount: 0,
  classCount: 1,
  classes: [{ id: "class-1", name: "1반" }],
  participants: [],
  learningChecks: [],
  jobSessions: [],
  roleplayConfig: { enabled: false, scenario: "민원 발생 보고", difficulty: "보통" },
  reportTrainings: [],
  checkpointConfig: {},
  olympicActivityOpen: false,
};

export function isDemoCourseSeedEnabled() {
  return env.DEV === true
    && DATA_MODE === "supabase"
    && env.VITE_ENABLE_DEMO_SEED === "true";
}

export async function seedDemoCourse() {
  if (!isDemoCourseSeedEnabled()) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  try {
    const existingCourse = await getCourse(DEMO_COURSE_CODE);
    if (existingCourse) return { ok: true, skipped: true, reason: "exists" };
    return saveCourse(demoCourse);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
