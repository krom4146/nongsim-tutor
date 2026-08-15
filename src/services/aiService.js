import { requestAI } from "./aiClient.js";

export {
  AI_MODE,
  AIServiceError,
  getAIConfigurationError,
} from "./aiClient.js";

export function buildGoalCohortRequest(course, classInfo) {
  const goals = (course.goals || [])
    .filter((goal) => typeof goal.text === "string" && goal.text.trim())
    .map((goal, index) => ({
      sourceId: `goal-${String(index + 1).padStart(2, "0")}`,
      text: goal.text.trim(),
    }));

  return {
    task: "goalCohort",
    courseCode: course.code,
    payload: {
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      goals,
    },
  };
}

export function buildGoalComposeRequest(course, questions, answers) {
  return {
    task: "goalCompose",
    courseCode: course.code,
    payload: {
      answers: questions.map((question, index) => ({
        sourceId: `goal-answer-${String(index + 1).padStart(2, "0")}`,
        question: String(question || "").trim(),
        text: String(answers[index] || "").trim(),
      })),
    },
  };
}

export function buildTransferReportRequest(course, participantCount, classInfo) {
  const surveys = course.surveys || [];
  return {
    task: "transferReport",
    courseCode: course.code,
    payload: {
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      participantCount: Number(participantCount) || 0,
      surveys: surveys.map((survey, index) => ({
        sourceId: `survey-${String(index + 1).padStart(2, "0")}`,
        likert: (survey.likert || []).map((value) => Number(value)),
        barriers: [...new Set((survey.barriers || []).map((barrier) => String(barrier).trim()).filter(Boolean))],
        applied: String(survey.applied || "").trim(),
        support: String(survey.support || "").trim(),
      })),
    },
  };
}

export function requestGoalCohortAnalysis(course, classInfo, options) {
  return requestAI(buildGoalCohortRequest(course, classInfo), options);
}

export function requestGoalCompose(course, questions, answers, options) {
  return requestAI(buildGoalComposeRequest(course, questions, answers), options);
}

export function requestTransferReport(course, participantCount, classInfo, options) {
  return requestAI(buildTransferReportRequest(course, participantCount, classInfo), options);
}
