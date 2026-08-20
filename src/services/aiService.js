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

export function buildJobReflectionAnalysisRequest(course, participantCount, classInfo, reflectionDate) {
  const classId = classInfo?.id || null;
  const sessions = (course.jobSessions || [])
    .filter((session) => session.date === reflectionDate && (!classId || session.classId === classId))
    .map((session) => ({
      sessionId: String(session.id || "").trim(),
      title: String(session.title || "").trim(),
    }))
    .filter((session) => session.sessionId && session.title);
  const knownSessionIds = new Set(sessions.map((session) => session.sessionId));
  const reflections = (course.jobReflections || [])
    .filter((reflection) => reflection.date === reflectionDate && (!classId || reflection.classId === classId))
    .filter((reflection) => knownSessionIds.has(reflection.bestSessionId))
    .map((reflection, index) => {
      const improvementSessionId = String(reflection.improvementSessionId || "").trim();
      return {
        sourceId: `job-reflection-${String(index + 1).padStart(2, "0")}`,
        bestSessionId: String(reflection.bestSessionId || "").trim(),
        bestReason: String(reflection.bestReason || "").trim(),
        bestReasonEtc: String(reflection.bestReasonEtc || "").trim() || null,
        improvementSessionId: improvementSessionId === "none" || knownSessionIds.has(improvementSessionId)
          ? improvementSessionId
          : null,
        improvementReason: String(reflection.improvementReason || "").trim() || null,
        improvementReasonEtc: String(reflection.improvementReasonEtc || "").trim() || null,
        workApplicationPoint: String(reflection.workApplicationPoint || "").trim(),
      };
    })
    .filter((reflection) => reflection.bestReason && reflection.workApplicationPoint);

  return {
    task: "jobReflectionAnalysis",
    courseCode: course.code,
    payload: {
      classId,
      className: classInfo?.name || null,
      reflectionDate,
      participantCount: Math.max(reflections.length, Number(participantCount) || 0),
      sessions,
      reflections,
    },
  };
}

export function buildCompletionReflectionAnalysisRequest(course, participantCount, classInfo) {
  const goalByParticipant = new Map((course.goals || []).map((goal) => [goal.participantId, goal]));
  const missionByParticipant = new Map();
  [...(course.missions || [])]
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .forEach((mission) => missionByParticipant.set(mission.participantId, mission));
  const reflections = (course.achievements || [])
    .filter((achievement) => typeof achievement.text === "string" && achievement.text.trim())
    .map((achievement, index) => {
      const goal = goalByParticipant.get(achievement.participantId);
      const mission = missionByParticipant.get(achievement.participantId);
      return {
        sourceId: `completion-reflection-${String(index + 1).padStart(2, "0")}`,
        goal: String(goal?.goalText || goal?.text || "").trim() || null,
        answers: (achievement.answers || []).map((answer) => String(answer || "").trim()).filter(Boolean),
        reflection: achievement.text.trim(),
        mission: String(mission?.missionText || mission?.text || "").trim() || null,
      };
    });

  return {
    task: "completionReflectionAnalysis",
    courseCode: course.code,
    payload: {
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      participantCount: Math.max(reflections.length, Number(participantCount) || 0),
      reflections,
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

export function buildMissionDraftRequest(course, goal, achievementAnswers, jobReflection) {
  const goalText = String(goal?.goalText || goal?.text || "").trim();
  const reflectionText = String(jobReflection?.workApplicationPoint || jobReflection?.text || "").trim();
  const achievementResponses = (achievementAnswers || [])
    .map((answer, index) => ({
      sourceId: `mission-ach-${String(index + 1).padStart(2, "0")}`,
      text: String(answer || "").trim(),
    }))
    .filter(({ text }) => text);

  return {
    task: "missionDraft",
    courseCode: course.code,
    payload: {
      goal: goalText ? { sourceId: "mission-goal-01", text: goalText } : null,
      achievementResponses,
      jobReflection: reflectionText
        ? { sourceId: "mission-reflection-01", text: reflectionText }
        : null,
    },
  };
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

export function requestJobReflectionAnalysis(course, participantCount, classInfo, reflectionDate, options) {
  return requestAI(
    buildJobReflectionAnalysisRequest(course, participantCount, classInfo, reflectionDate),
    options,
  );
}

export function requestCompletionReflectionAnalysis(course, participantCount, classInfo, options) {
  return requestAI(
    buildCompletionReflectionAnalysisRequest(course, participantCount, classInfo),
    options,
  );
}

export function requestPollCluster(course, round, options) {
  return requestAI(buildPollClusterRequest(course, round), options);
}

export function requestBoardAnalysis(course, round, item, options) {
  return requestAI(buildBoardAnalysisRequest(course, round, item), options);
}

export function requestMissionDraft(course, goal, achievementAnswers, jobReflection, options) {
  return requestAI(
    buildMissionDraftRequest(course, goal, achievementAnswers, jobReflection),
    options,
  );
}

export function requestReportFeedback(course, config, reportText, followupQuestions, followupAnswer, options) {
  return requestAI(
    buildReportFeedbackRequest(course, config, reportText, followupQuestions, followupAnswer),
    options,
  );
}
