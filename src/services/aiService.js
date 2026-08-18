import { requestAI } from "./aiClient.js";

const POLL_QUESTION_INTENTS = new Set([
  "general",
  "understanding",
  "misconception",
  "application",
  "dilemma",
  "emotion",
]);

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

export function buildPollClusterRequest(course, round) {
  const responses = (round?.items || [])
    .filter((item) => typeof item.text === "string" && item.text.trim())
    .map((item, index) => ({
      sourceId: `poll-${String(index + 1).padStart(2, "0")}`,
      text: item.text.trim(),
      agree: Math.max(0, Math.trunc(Number(item.reactions?.agree) || 0)),
    }));

  return {
    task: "pollCluster",
    courseCode: course.code,
    payload: {
      round: {
        sourceId: "poll-round-01",
        prompt: String(round?.prompt || "").trim(),
        questionType: round?.questionType === "objective" ? "objective" : "subjective",
        questionIntent: POLL_QUESTION_INTENTS.has(round?.questionIntent) ? round.questionIntent : "general",
        anonymous: round?.anonymous === true,
      },
      responses,
    },
  };
}

export function buildBoardAnalysisRequest(course, round, item) {
  const teamLabel = String(item?.by || "팀").trim();
  return {
    task: "boardAnalysis",
    courseCode: course.code,
    payload: {
      classId: item?.classId || round?.classId || null,
      className: item?.className || round?.className || null,
      moduleTitle: String(round?.prompt || "").trim(),
      scopeLabel: teamLabel.endsWith("팀") ? `${teamLabel} 장표` : `${teamLabel} 팀 장표`,
      imageUrl: String(item?.url || item?.imageUrl || "").trim(),
    },
  };
}

export function isLegacyBoardDataUrl(value) {
  return /^data:/i.test(String(value || "").trim());
}

export function buildReportFeedbackRequest(course, config, reportText, followupQuestions, followupAnswer) {
  const turns = [
    { speaker: "manager", text: String(config?.opening || "").trim() },
    { speaker: "learner", text: String(reportText || "").trim() },
    ...(followupQuestions || []).map((question) => ({
      speaker: "manager",
      text: String(question || "").trim(),
    })),
    { speaker: "learner", text: String(followupAnswer || "").trim() },
  ].filter((turn) => turn.text);

  return {
    task: "reportFeedback",
    courseCode: course.code,
    payload: {
      scenario: String(config?.scenario || "").trim(),
      difficulty: String(config?.difficulty || "").trim(),
      turns,
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

export function requestPollCluster(course, round, options) {
  return requestAI(buildPollClusterRequest(course, round), options);
}

export function requestBoardAnalysis(course, round, item, options) {
  return requestAI(buildBoardAnalysisRequest(course, round, item), options);
}

export function requestReportFeedback(course, config, reportText, followupQuestions, followupAnswer, options) {
  return requestAI(
    buildReportFeedbackRequest(course, config, reportText, followupQuestions, followupAnswer),
    options,
  );
}
