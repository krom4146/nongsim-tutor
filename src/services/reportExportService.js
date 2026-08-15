const DEFAULT_CLASS_ID = "class-1";
const DEFAULT_CLASS_NAME = "1반";
const SURVEY_SCORE_COUNT = 5;

function normalizedLikertScores(likert = []) {
  return Array.from({ length: SURVEY_SCORE_COUNT }, (_, index) => {
    const score = Number(likert[index]);
    return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
  });
}

function surveyQuestion(question, index) {
  return question || `현업활용도 문항 ${index + 1}`;
}

export function anonymizeSurveyResponses(surveys = [], questions = []) {
  return (surveys || []).map((survey, index) => {
    const scores = normalizedLikertScores(survey.likert);
    return {
      label: `응답자 ${index + 1}`,
      classId: survey.classId || DEFAULT_CLASS_ID,
      className: survey.className || DEFAULT_CLASS_NAME,
      likert: scores,
      likertScores: scores.map((score, questionIndex) => ({
        question: surveyQuestion(questions[questionIndex], questionIndex),
        score,
      })),
      likert1Score: scores[0],
      likert2Score: scores[1],
      likert3Score: scores[2],
      likert4Score: scores[3],
      likert5Score: scores[4],
      barriers: Array.isArray(survey.barriers) ? survey.barriers : [],
      applied: typeof survey.applied === "string" ? survey.applied : "",
      support: typeof survey.support === "string" ? survey.support : "",
      submittedAt: survey.submittedAt || survey.createdAt || "",
    };
  });
}

export function anonymizeCsvRows(items = [], questions = []) {
  let surveyIndex = 0;
  return (items || []).map((item, index) => {
    const isSurvey = item.responseType === "survey";
    const survey = isSurvey
      ? anonymizeSurveyResponses([item], questions)[0]
      : null;
    if (isSurvey) {
      surveyIndex += 1;
      survey.label = `응답자 ${surveyIndex}`;
    }
    return {
      courseCode: item.courseId || item.courseCode || "",
      classId: item.classId || DEFAULT_CLASS_ID,
      className: item.className || DEFAULT_CLASS_NAME,
      respondentLabel: survey?.label || `응답자 ${index + 1}`,
      responseType: item.responseType || "",
      submittedAt: item.submittedAt || item.createdAt || "",
      likert1Score: survey?.likert1Score ?? "",
      likert2Score: survey?.likert2Score ?? "",
      likert3Score: survey?.likert3Score ?? "",
      likert4Score: survey?.likert4Score ?? "",
      likert5Score: survey?.likert5Score ?? "",
      surveyBarriers: survey ? survey.barriers.join(" | ") : "",
      surveyAppliedCase: survey?.applied || "",
      surveyNeededSupport: survey?.support || "",
    };
  });
}

export function reportCsvColumns(questions = []) {
  return [
    { key: "courseCode", header: "courseCode" },
    { key: "classId", header: "classId" },
    { key: "className", header: "className" },
    { key: "respondentLabel", header: "respondentLabel" },
    { key: "responseType", header: "responseType" },
    { key: "submittedAt", header: "submittedAt" },
    ...Array.from({ length: SURVEY_SCORE_COUNT }, (_, index) => ({
      key: `likert${index + 1}Score`,
      header: `현업활용도 ${index + 1} 점수 (${surveyQuestion(questions[index], index)})`,
    })),
    { key: "surveyBarriers", header: "장애요인(복수 선택)" },
    { key: "surveyAppliedCase", header: "적용 사례(주관식)" },
    { key: "surveyNeededSupport", header: "필요한 지원(주관식)" },
  ];
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function createReportCsvContent(rows = [], questions = []) {
  const columns = reportCsvColumns(questions);
  const values = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? "")),
  ];
  return "\uFEFF" + values.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function isExpectedExportCourse(course, expectedCourseCode) {
  return Boolean(expectedCourseCode && course?.code === expectedCourseCode);
}
