import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/* 단일 파일 구조 유지: 기존 내부 모듈 함수와 mock 데이터를 main.jsx 안에 포함합니다. */

/* ---- inlined from src\data.js ---- */
const COURSE_CODE = "NH-2480";

// TODO: 로컬 시연 전용 값입니다. 실제 배포에서는 서버 인증으로 교체하고 클라이언트 코드에 비밀번호를 두지 않습니다.
const ADMIN_PASSWORD = "nh1234";

const courseTypes = {
  ideology: "통합 농협이념과정",
  leader: "직급별 이념과정",
  newbie: "신규직원과정",
  job: "직무과정",
};

const courseCodeRanges = {
  ideology: 1000,
  leader: 2000,
  newbie: 3000,
  job: 4000,
};

const reactionLabels = { agree: "공감" };

const questionIntents = [
  { id: "general", label: "일반 의견형" },
  { id: "understanding", label: "이해 확인형" },
  { id: "misconception", label: "오개념 확인형" },
  { id: "application", label: "현장 적용형" },
  { id: "dilemma", label: "선택 갈등형" },
  { id: "emotion", label: "감정 반응형" },
];

const goalQuestions = [
  "이번 교육에 참여하게 된 가장 큰 계기나 기대는 무엇인가요?",
  "현재 현업에서 가장 어렵거나 아쉽다고 느끼는 점은 무엇인가요?",
  "교육이 끝났을 때, 어떤 모습이 되어 있으면 ‘성공’이라고 느낄까요?",
];

const achievementQuestions = [
  "입교 때 세운 목표를 떠올리면, 가장 크게 달라진 점은 무엇인가요?",
  "아직 부족하거나 더 연습이 필요한 부분은 무엇인가요?",
  "현업에 돌아가서 가장 먼저 시도해 볼 것은 무엇인가요?",
];

const transferQuestions = [
  "교육에서 배운 내용을 실제 업무에 적용하고 있다.",
  "배운 내용을 업무에 적용하는 빈도가 높은 편이다.",
  "교육 내용이 실제 업무 성과(효율·정확성·고객응대 등) 향상에 도움이 되었다.",
  "앞으로도 배운 내용을 지속적으로 활용할 의향이 있다.",
  "배운 내용을 동료나 부서에 공유·전파한 적이 있다.",
];

const transferBarriers = [
  "업무량·시간 부족",
  "상사·동료의 지원 부족",
  "적용 기회 부족",
  "교육 내용의 현업 적합성 부족",
  "추가 자료·도구 부족",
  "해당 없음(잘 적용함)",
];

const promptTemplates = {
  goalCompose: "교육생의 표현을 유지하며 측정 가능한 교육 목표로 다듬으세요.",
  achCompose: "교육 전 목표와 수료 성찰을 연결해 달성도를 정리하세요.",
  goalAnalysis: "제공된 목표만 근거로 공통 주제와 교육 설계 시사점을 JSON으로 반환하세요.",
  pollCluster: "반응 수를 우선순위에 반영하고 evidence와 후속질문 2개를 포함하세요.",
  transfer: "현업 적용 응답에서 실행 사례, 장벽, 지원 요구를 구분하세요.",
  reportSys: "과정 전·중·후 데이터를 연결해 교육성과를 설명하세요.",
  reportFb: "개인을 평가하지 말고 집계 관점에서 과정 개선안을 제시하세요.",
  olympicsSys: "신규직원의 보고 역량을 사실-영향-조치-요청 구조로 코칭하세요.",
  grounding: "제공된 교육생 응답만 근거로 분석하세요. 없는 사실을 추정하지 마세요. 모든 결과는 교수요원 검토가 필요합니다.",
};

const seedCourse = {
  code: COURSE_CODE,
  type: "newbie",
  name: "2026 신규직원 농협이념·현장실무 과정",
  cohort: "제24기",
  startDate: "2026-06-24",
  endDate: "2026-06-26",
  transferDate: "2026-08-26",
  createdAt: "2026-06-01T09:00:00.000Z",
  templateId: "newbie-v3",
  privacyNoticeAccepted: true,
  participantCount: 24,
  classCount: 1,
  classes: [{ id: "class-1", name: "1반" }],
  participants: [],
  goals: [
    { id: "g1", participantId: "s01", name: "김교육", text: "조합원 응대에서 농협의 정체성을 제 말로 설명하겠습니다.", createdAt: "2026-06-24T00:10:00.000Z" },
    { id: "g2", participantId: "s02", name: "이성장", text: "민원 상황에서도 사실과 조치 계획을 빠르게 보고하겠습니다.", createdAt: "2026-06-24T00:13:00.000Z" },
    { id: "g3", participantId: "s03", name: "박협동", text: "경제사업 업무가 조합원 실익과 연결되는 지점을 찾겠습니다.", createdAt: "2026-06-24T00:17:00.000Z" },
    { id: "g4", participantId: "s04", name: "최현장", text: "선배에게 질문을 미루지 않고 배운 내용을 당일 기록하겠습니다.", createdAt: "2026-06-24T00:21:00.000Z" },
    { id: "g5", participantId: "s05", name: "정신뢰", text: "정확한 보고 습관으로 동료와 조합원의 신뢰를 쌓겠습니다.", createdAt: "2026-06-24T00:25:00.000Z" },
    { id: "g6", participantId: "s06", name: "한실천", text: "협동조합 가치가 창구 업무에서 어떻게 보이는지 사례를 만들겠습니다.", createdAt: "2026-06-24T00:29:00.000Z" },
  ],
  achievements: [
    { id: "a1", participantId: "s01", text: "조합원 관점에서 먼저 질문하는 습관의 필요성을 이해했습니다.", createdAt: "2026-06-26T07:00:00.000Z" },
    { id: "a2", participantId: "s02", text: "보고는 완벽한 답보다 빠른 공유가 먼저라는 점을 연습했습니다.", createdAt: "2026-06-26T07:04:00.000Z" },
  ],
  rounds: [],
  learningChecks: [],
  legacyJobChecks: [],
  jobSessions: [],
  jobReflections: [],
  roleplayConfig: { enabled: false, scenario: "민원 발생 보고", difficulty: "보통" },
  roleplaySessions: [],
  reportTrainings: [],
  surveys: [
    { id: "s1", participantId: "s01", likert: [4, 4, 5, 4, 4], barriers: ["상사·동료의 지원 부족", "업무량·시간 부족"], applied: "민원 접수 후 처리 예상 시간을 먼저 안내했습니다.", support: "상사와 동료가 함께 볼 수 있는 상황별 보고 문장 예시가 더 필요합니다.", createdAt: "2026-08-26T01:00:00.000Z" },
  ],
  missions: [
    { id: "m1", participantId: "s01", goalId: "g1", missionText: "다음 주부터 매주 금요일 팀 회의가 끝나면, 결정사항을 한 줄로 정리해 팀 공유 채널에 올린다.", dueDate: "2026-08-26", status: "assigned" },
  ],
  olympicActivityOpen: false,
};

/* ---- inlined from src\utils.js ---- */
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const generateParticipantId = () => uid("p");
const generateReentryToken = () => Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[OI]/g, "7");

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addMonthsToDate(dateString, months = 2) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function getTransferDate(course) {
  return course.transferDate || addMonthsToDate(course.endDate, 2);
}

function getCoursePhase(course) {
  const today = todayInKorea();
  if (today < course.startDate) return "before";
  if (today < course.endDate) return "active";
  if (today === course.endDate) return "completion";
  if (today < getTransferDate(course)) return "followupWait";
  return "transfer";
}

function isCourseEnded(course) {
  return todayInKorea() > course.endDate;
}

function generateCourseCode(type, courses) {
  const base = courseCodeRanges[type];
  const usedNumbers = courses
    .filter((course) => course.type === type)
    .map((course) => Number(String(course.code).replace(/\D/g, "")))
    .filter((number) => number > base && number < base + 1000);
  const nextNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : base + 1;
  if (nextNumber >= base + 1000) throw new Error(`${courseTypes[type]} 코드 발급 범위를 모두 사용했습니다.`);
  return `NH-${nextNumber}`;
}

function generateParticipantCode(course, classInfo = null) {
  const classId = classInfo?.id || "common";
  const className = classInfo?.name || "공통";
  const used = (course.participants || [])
    .filter((participant) => (participant.classId || "common") === classId)
    .map((participant) => Number(String(participant.participantCode || "").split("-").pop()))
    .filter(Boolean);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${className}-${String(next).padStart(2, "0")}`;
}

function personalFollowupLink(token) {
  return `/followup/${token}`;
}

function reactionScore(item) {
  return Object.values(item.reactions || {}).reduce((a, b) => a + b, 0);
}

function sourceLabel(source) {
  return ({ goal: "교육 목표", poll: "실시간 답변", board: "팀게시판", survey: "사후 설문" }[source] || source);
}

function averageLikert(surveys) {
  const values = surveys.flatMap((survey) => survey.likert || []);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "0.0";
}

/* ---- inlined from src\services\classManagementService.js ---- */
const DEFAULT_CLASS_ID = "class-1";
const DEFAULT_CLASS_NAME = "1반";
const STORAGE_WARNING_MESSAGE = "저장 공간이 가득 찼습니다. 오래된 장표 이미지를 정리하거나 새 과정으로 시작해 주세요.";

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("localStorage 저장 실패:", error);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nongsim-storage-warning", { detail: { message: STORAGE_WARNING_MESSAGE } }));
    }
    return false;
  }
}

function createClasses(classCount = 1) {
  const safeCount = Math.min(4, Math.max(1, Number(classCount) || 1));
  return Array.from({ length: safeCount }, (_, index) => ({
    id: `class-${index + 1}`,
    name: `${index + 1}반`,
  }));
}

function classMeta(item = {}) {
  return {
    classId: item.classId || DEFAULT_CLASS_ID,
    className: item.className || DEFAULT_CLASS_NAME,
  };
}

function withClass(item, fallback = {}) {
  return { ...item, ...classMeta({ ...fallback, ...item }) };
}

function normalizeRound(round = {}) {
  const scope = "class";
  return {
    ...round,
    scope,
    classId: round.classId || DEFAULT_CLASS_ID,
    className: round.className || (round.classId ? `${round.classId.replace("class-", "")}반` : DEFAULT_CLASS_NAME),
    items: (round.items || []).map((item) => withClass(item)),
  };
}

function normalizeClassCourse(course = {}) {
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

function isVisibleToClass(item, classId) {
  return item.classId === classId;
}

function matchesClass(item, classId) {
  return classId === "all" || (item.classId || DEFAULT_CLASS_ID) === classId;
}

function filterCourseByClass(course, classId = "all") {
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

function participantCountForClass(course, classId = "all") {
  if (classId === "all") return course.participantCount || 0;
  const registered = (course.participants || []).filter((item) => matchesClass(item, classId)).length;
  return registered || Math.ceil((course.participantCount || 0) / Math.max(1, course.classCount || 1));
}

/* ---- inlined from src\services\localStorageRepository.js ---- */
const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSES_KEY = "nongsim-courses-v3";

function normalizeCourse(course) {
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
  return normalizeClassCourse({ ...baseCourse, participants });
}

function loadActiveCourse() {
  try {
    const saved = localStorage.getItem(ACTIVE_COURSE_KEY);
    return normalizeCourse(saved ? { ...seedCourse, ...JSON.parse(saved) } : seedCourse);
  } catch {
    return normalizeCourse(seedCourse);
  }
}

function saveActiveCourse(course) {
  safeSetItem(ACTIVE_COURSE_KEY, JSON.stringify(course));
}

function loadCourses() {
  try {
    const saved = localStorage.getItem(COURSES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeCourse);
    }
    return [loadActiveCourse()];
  } catch {
    return [normalizeCourse(seedCourse)];
  }
}

function saveCourses(courses) {
  safeSetItem(COURSES_KEY, JSON.stringify(courses));
}

const storageKeys = { activeCourse: ACTIVE_COURSE_KEY, courses: COURSES_KEY };

/* ---- inlined from src\services\analysisMockService.js ---- */
function buildAnalysis(course, kind = "all") {
  const pollItems = course.rounds.filter((round) => round.kind === "poll").flatMap((round) => round.items.map((item) => ({ ...item, by: round.anonymous ? "익명" : item.by, anonymous: round.anonymous })));
  const boardItems = course.rounds.filter((round) => round.kind === "board").flatMap((round) => round.items);
  const evidencePool = kind === "goals"
    ? course.goals.map((goal) => ({ quote: goal.text, by: goal.name, source: "goal" }))
    : kind === "poll"
      ? pollItems.map((item) => ({ quote: item.text, by: item.by, source: "poll", score: reactionScore(item) }))
      : [
        ...course.goals.slice(0, 2).map((goal) => ({ quote: goal.text, by: goal.name, source: "goal" })),
        ...pollItems.map((item) => ({ quote: item.text, by: item.by, source: "poll", score: reactionScore(item) })).sort((a, b) => b.score - a.score).slice(0, 2),
        ...boardItems.slice(0, 1).map((item) => ({ quote: item.text, by: item.by, source: "board" })),
        ...course.surveys.slice(0, 1).map((item) => ({ quote: item.applied, source: "survey" })),
      ];

  return {
    summary: "교육생 응답은 ‘신속하고 정확한 보고’, ‘조합원 관점의 판단’, ‘질문하고 기록하는 학습 습관’에 집중됩니다. 특히 실수를 숨기게 되는 현실적 장벽에 반응이 모여, 원칙 설명보다 실제 보고 문장을 연습하는 개입이 효과적입니다.",
    clusters: [
      { title: "신속한 보고와 투명성", count: Math.max(4, pollItems.length), insight: "완벽한 해결보다 영향 범위를 먼저 공유하는 행동이 핵심으로 나타났습니다." },
      { title: "조합원 실익과 신뢰", count: Math.max(3, boardItems.length + 1), insight: "규정 준수와 함께 조합원에게 처리 과정을 설명하는 태도를 중요하게 봅니다." },
      { title: "현장 적용 습관", count: Math.max(2, course.surveys.length + course.missions.length), insight: "질문, 기록, 사례 축적처럼 작고 반복 가능한 행동이 전이의 조건으로 제시됐습니다." },
    ],
    evidence: evidencePool.slice(0, 3),
    recommendedActions: [
      "반응이 가장 높은 ‘실수 은폐의 이유’를 익명 사례 질문으로 5분간 토의하세요.",
      "민원·시재 차이 상황을 활용해 사실–영향–조치–요청의 30초 보고를 실습하세요.",
      "수료 전 각자의 목표를 주 1회 행동으로 바꾼 현업 미션을 확인하세요.",
    ],
    followupQuestions: [
      "실수를 빨리 보고해야 한다고 알면서도, 실제 현장에서는 왜 숨기게 될까요?",
      "조합원 관점의 대응과 규정 준수가 충돌할 때 무엇을 판단 기준으로 삼아야 할까요?",
    ],
  };
}

function analyzeQuestionResponses(round) {
  const items = round.items || [];
  const texts = items.map((item) => item.text || "");
  const misconceptionWords = /(모르|헷갈|아닌가|잘못|무조건|상관없|모호)/;
  const needHelpWords = /(어렵|설명|궁금|이해 안|잘 모르)/;
  const misconception = items.filter((item) => misconceptionWords.test(item.text || ""));
  const needHelp = items.filter((item) => needHelpWords.test(item.text || "") && !misconception.includes(item));
  const good = items.filter((item) => !misconception.includes(item) && !needHelp.includes(item));
  const evidence = (misconception[0] || needHelp[0] || items[0])?.text || "아직 응답이 없습니다.";
  return {
    good: good.length,
    misconception: misconception.length,
    needHelp: needHelp.length,
    intervention: items.length
      ? `“${evidence.slice(0, 55)}${evidence.length > 55 ? "…" : ""}” 응답을 예로 들어 판단 기준을 다시 설명해보세요.`
      : "응답이 모이면 이해 양호·오개념·추가 설명 필요로 자동 분류됩니다.",
    followups: [
      round.questionIntent === "application" ? "이 내용을 실제 현장에서 적용하기 어려운 순간은 언제일까요?" : "그렇게 판단한 기준을 한 문장으로 설명해볼까요?",
      round.questionIntent === "misconception" ? "반대 사례가 있다면 지금 답이 달라질까요?" : "다른 선택을 한 동료의 입장에서는 어떻게 볼 수 있을까요?",
    ],
  };
}

function buildTeachingIntervention(course) {
  const pollItems = course.rounds.filter((round) => round.kind === "poll").flatMap((round) => round.items.map((item) => ({ ...item, prompt: round.prompt })));
  const boardItems = course.rounds.filter((round) => round.kind === "board").flatMap((round) => round.items);
  const evidenceItem = pollItems[0] || boardItems[0] || course.goals[0];
  const evidence = evidenceItem?.text || "아직 교육생 응답이 충분하지 않습니다.";
  return {
    insufficientConcept: pollItems.length ? "교육생이 답변의 판단 기준을 구체적인 행동 순서로 설명하는 부분" : "실시간 질문 응답을 먼저 수집해 주세요.",
    confusionPoint: pollItems.some((item) => /(모르|헷갈|어렵)/.test(item.text || "")) ? "원칙을 실제 상황에 적용하는 순서" : "원칙과 현장 예외 상황을 구분하는 기준",
    immediateQuestion: "이 판단을 현장에서 바로 행동으로 옮긴다면 가장 먼저 무엇을 해야 할까요?",
    miniLesson: "핵심 개념 → 현장 사례 → 첫 행동의 순서로 3분간 다시 설명하세요.",
    discussionTopic: boardItems.length ? "팀별 해결책에서 공통점과 차이점 찾기" : "원칙 준수와 현장 대응이 충돌하는 상황",
    evidence,
  };
}

/* ---- inlined from src\services\missionService.js ---- */
function roleplayManagerLabel(difficulty) {
  return ({ 쉬움: "친절한 팀장", 보통: "바쁜 팀장", 어려움: "꼬리질문 많은 팀장" })[difficulty] || "팀장";
}

function roleplayOpening(scenario) {
  return `${scenario} 상황이군요. 지금 무슨 일이 있었고 제가 무엇을 결정해야 합니까?`;
}

function buildRoleplayFeedback(scenario, difficulty) {
  const tone = difficulty === "어려움"
    ? "꼬리질문에 대비해 수치와 영향 범위를 더 명확히 하세요."
    : difficulty === "보통"
      ? "바쁜 상사가 바로 판단할 수 있게 첫 문장을 더 짧게 만드세요."
      : "핵심 구조가 좋습니다. 조치 완료 시점까지 덧붙여보세요.";
  return `상황: ${scenario}. 사실 → 영향 → 현재 조치 → 요청 순서로 재구성하면 좋습니다. ${tone}`;
}

function createGoalPlan(goalText, answers = []) {
  const expectation = answers[0]?.trim();
  const challenge = answers[1]?.trim();
  return {
    goalText,
    focusPoint: challenge
      ? `${challenge} 상황을 개선하는 설명 방식과 현장 대응 순서에 집중하기`
      : "핵심 개념을 현장 사례와 연결하는 방법에 집중하기",
    actionMission: expectation
      ? `교육에서 배운 내용을 활용해 “${expectation}”와 관련된 행동을 이번 주 1회 직접 실천하고 기록하기`
      : "배운 내용을 현업에서 1회 실천하고 결과를 짧게 기록하기",
  };
}

function createMissionCheckpoints() {
  return [
    { week: 2, label: "2주 후 실천 체크", status: "pending", response: "" },
    { week: 4, label: "4주 후 어려움 점검", status: "pending", response: "" },
    { week: 8, label: "2개월 후 현업활용도", status: "pending", response: "" },
  ];
}

const DEFAULT_TRANSFER_MISSION = "다음 주부터 매주 금요일 팀 회의가 끝나면, 결정사항을 한 줄로 정리해 팀 공유 채널에 올린다.";

function missionSourceText({ goal, achievementAnswers = [], jobReflection } = {}) {
  return [
    achievementAnswers[2],
    jobReflection?.workApplicationPoint,
    goal?.actionMission,
    goal?.focusPoint,
    goal?.goalText,
    goal?.text,
  ].find((item) => item && item.trim())?.trim() || "";
}

function compactMissionTopic(text = "") {
  return text
    .replace(/[“”"'`]/g, "")
    .replace(/하겠습니다\.?|합니다\.?|하기|하는 방법|상황을 개선하는|에 집중하기/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
}

function buildPersonalizedTransferMission({ goal, achievementAnswers = [], jobReflection, studentName = "" } = {}) {
  const source = missionSourceText({ goal, achievementAnswers, jobReflection });
  if (!source) return DEFAULT_TRANSFER_MISSION;
  if (/(민원|고객|조합원|응대|상담|소통)/.test(source)) {
    return "다음 민원 응대가 끝난 뒤, 고객과의 대화에서 막혔던 표현 한 가지를 기록하고, 다음 상담 전에 다시 확인한다.";
  }
  if (/(보고|공유|결정|회의|두괄식|전달)/.test(source)) {
    return "이번 주 첫 팀 회의가 끝난 뒤, 교육에서 정리한 핵심 내용을 한 줄로 요약해, 팀 공유 채널에 올린다.";
  }
  if (/(사고|예방|위험|체크|점검)/.test(source)) {
    return "다음 업무를 시작하기 전, 사고 예방 체크 포인트 한 가지를 확인하고, 놓친 부분을 업무 메모에 남긴다.";
  }
  if (/(계약|서류|채권|세무|실무|절차)/.test(source)) {
    return "다음 관련 업무를 처리하기 전, 교육에서 배운 확인 순서 한 가지를 떠올리고, 체크리스트에 표시한다.";
  }
  if (/(기록|질문|학습|메모|정리)/.test(source)) {
    return "이번 주 업무를 마친 뒤, 오늘 배운 내용과 현장 질문 한 가지를 정리해, 개인 업무 메모에 기록한다.";
  }
  const topic = compactMissionTopic(source) || `${studentName || "나"}의 교육 목표`;
  return `이번 주 첫 현업 적용 기회가 생기면, ${topic}와 연결되는 행동 한 가지를 실행하고, 결과를 짧게 기록한다.`;
}

function missionElementSummary(missionText = DEFAULT_TRANSFER_MISSION) {
  const text = missionText?.trim() || DEFAULT_TRANSFER_MISSION;
  if (text.startsWith("다음 민원 응대가 끝난 뒤")) {
    return {
      when: "다음 민원 응대가 끝난 뒤",
      what: "막혔던 표현 한 가지 기록",
      how: "다음 상담 전에 다시 확인",
    };
  }
  if (text.startsWith("이번 주 첫 팀 회의가 끝난 뒤")) {
    return {
      when: "이번 주 첫 팀 회의가 끝난 뒤",
      what: "핵심 내용을 한 줄로 요약",
      how: "팀 공유 채널에 올리기",
    };
  }
  if (text.startsWith("다음 업무를 시작하기 전")) {
    return {
      when: "다음 업무를 시작하기 전",
      what: "사고 예방 체크 포인트 확인",
      how: "놓친 부분을 업무 메모에 남기기",
    };
  }
  if (text.startsWith("다음 관련 업무를 처리하기 전")) {
    return {
      when: "다음 관련 업무를 처리하기 전",
      what: "교육에서 배운 확인 순서",
      how: "체크리스트에 표시하기",
    };
  }
  if (text.startsWith("이번 주 업무를 마친 뒤")) {
    return {
      when: "이번 주 업무를 마친 뒤",
      what: "배운 내용과 현장 질문 한 가지",
      how: "개인 업무 메모에 기록",
    };
  }
  if (text.startsWith("이번 주 첫 현업 적용 기회가 생기면")) {
    return {
      when: "이번 주 첫 현업 적용 기회가 생기면",
      what: "목표와 연결되는 행동 한 가지",
      how: "실행 후 결과를 짧게 기록",
    };
  }
  if (text.includes("매주 금요일") && text.includes("결정사항")) {
    return {
      when: "매주 금요일 팀 회의가 끝나면",
      what: "결정사항을 한 줄로 정리",
      how: "팀 공유 채널에 올린다",
    };
  }
  return {
    when: "현업에 돌아간 뒤 정한 시점에",
    what: text.length > 28 ? `${text.slice(0, 28)}…` : text,
    how: "작게 실행하고 결과를 기록한다",
  };
}

function MissionElementBadges({ missionText }) {
  const elements = missionElementSummary(missionText);
  return (
    <div className="mission-element-badges" aria-label="현업 미션 3요소">
      <span><b>⏰ 언제</b>{elements.when}</span>
      <span><b>🎯 무엇을</b>{elements.what}</span>
      <span><b>🛠 어떻게</b>{elements.how}</span>
    </div>
  );
}

function buildStructuredReportFeedback(reportText, followupAnswer = "") {
  const combined = `${reportText} ${followupAnswer}`.trim();
  const lengthScore = combined.length > 120 ? 5 : combined.length > 75 ? 4 : combined.length > 35 ? 3 : 2;
  const hasAction = /(조치|확인|연락|처리|예정|하겠습니다)/.test(combined);
  const hasRequest = /(요청|결정|지원|승인|지시|필요)/.test(combined);
  const hasCause = /(원인|때문|으로 인해|확인 중)/.test(combined);
  const hasNumber = /\d/.test(combined);
  return {
    summary: "보고의 핵심 구조를 기준으로 결론, 사실, 조치와 요청사항을 점검했습니다.",
    scores: {
      conclusionFirst: /^(현재|결론|먼저|보고드릴|발생)/.test(reportText.trim()) ? 5 : 3,
      accuracy: hasNumber ? 5 : Math.max(3, lengthScore),
      cause: hasCause ? 5 : 3,
      actionPlan: hasAction ? 5 : 3,
      requestClarity: hasRequest ? 5 : 2,
      attitude: /(하겠습니다|부탁드립니다|보고드립니다)/.test(combined) ? 5 : 4,
    },
    firstFix: hasRequest
      ? "첫 문장에서 결론과 영향 범위를 더 짧게 제시해보세요."
      : "마지막에 팀장에게 필요한 결정이나 지원 요청을 한 문장으로 명확히 덧붙이세요.",
  };
}

function createFollowupQuestions(scenario, difficulty) {
  const questions = [
    `${scenario}의 현재 영향 범위는 어디까지입니까?`,
    "지금 팀장에게 가장 먼저 요청할 결정은 무엇입니까?",
  ];
  return difficulty === "쉬움" ? questions.slice(0, 1) : questions;
}

/* ---- inlined from src\services\reportService.js ---- */
function anonymizeSurveyResponses(surveys = []) {
  return (surveys || []).map((survey, index) => ({
    id: survey.id,
    label: `응답자 ${index + 1}`,
    classId: survey.classId || DEFAULT_CLASS_ID,
    className: survey.className || DEFAULT_CLASS_NAME,
    likert: survey.likert || [],
    barriers: survey.barriers || [],
    applied: survey.applied || "",
    support: survey.support || "",
    submittedAt: survey.submittedAt || survey.createdAt || "",
  }));
}

function surveySubmissionStatus(course, classId = "all") {
  const submittedIds = new Set((course.surveys || []).filter((item) => matchesClass(item, classId)).map((item) => item.participantId));
  return collectCourseStudents(course)
    .filter((student) => matchesClass(student, classId))
    .map((student) => ({
      name: student.name || student.studentName || "이름 없음",
      className: student.className || DEFAULT_CLASS_NAME,
      submitted: submittedIds.has(student.participantId || student.id),
    }));
}

function reportData(course, classId = "all") {
  const filtered = filterCourseByClass(course, classId);
  const anonymousSurveys = anonymizeSurveyResponses(filtered.surveys);
  const classSummaries = (course.classes || []).map((classInfo) => {
    const classCourse = filterCourseByClass(course, classInfo.id);
    return {
      classId: classInfo.id,
      className: classInfo.name,
      goals: classCourse.goals.length,
      questionResponses: classCourse.rounds.filter((round) => round.kind === "poll").reduce((sum, round) => sum + round.items.length, 0),
      boardUploads: classCourse.rounds.filter((round) => round.kind === "board").reduce((sum, round) => sum + round.items.length, 0),
      reportTrainings: classCourse.reportTrainings.length,
      jobReflections: classCourse.jobReflections.length,
      surveys: classCourse.surveys.length,
    };
  });
  return {
    course: { name: course.name, cohort: course.cohort, code: course.code, period: `${course.startDate} ~ ${course.endDate}`, classFilter: classId },
    generatedAt: now(),
    classSummaries,
    preCourseGoalAnalysis: buildAnalysis(filtered, "goals"),
    inCourseParticipationAnalysis: buildAnalysis(filtered, "poll"),
    completionReflection: { submitted: filtered.achievements.length, responses: filtered.achievements },
    reportTrainings: filtered.reportTrainings || [],
    jobReflections: filtered.jobReflections || [],
    transferAfterTwoMonths: {
      submitted: filtered.surveys.length,
      averageLikert: averageLikert(filtered.surveys),
      responses: anonymousSurveys,
      submissionStatus: surveySubmissionStatus(course, classId),
      missions: filtered.missions,
      missionCheckpoints: filtered.missions.flatMap((mission) => mission.missionCheckpoints || []),
    },
    improvementSuggestions: buildAnalysis(filtered).recommendedActions,
    notice: "AI 분석 결과는 제공된 응답 안에서 생성되었으며 교수요원 검토가 필요합니다.",
  };
}

function downloadReport(course, format, classId = "all") {
  const filtered = filterCourseByClass(course, classId);
  const report = reportData(course, classId);
  let content;
  let type;
  let ext;

  if (format === "json") {
    content = JSON.stringify(report, null, 2);
    type = "application/json;charset=utf-8";
    ext = "json";
  } else {
    const anonymousSurveys = anonymizeSurveyResponses(filtered.surveys).map((item) => ({
      ...item,
      studentName: item.label,
      responseType: "survey",
      createdAt: item.submittedAt,
    }));
    const responseRows = [
      ...filtered.goals.map((item) => ({ ...item, studentName: item.name, responseType: "goal" })),
      ...filtered.achievements.map((item) => ({ ...item, studentName: item.name, responseType: "achievement" })),
      ...anonymousSurveys,
      ...filtered.jobReflections.map((item) => ({ ...item, responseType: "jobReflection" })),
      ...filtered.reportTrainings.map((item) => ({ ...item, studentName: item.name, responseType: "reportTraining" })),
      ...filtered.rounds.flatMap((round) => round.items.map((item) => ({ ...item, studentName: item.by, responseType: round.kind }))),
    ];
    const rows = [
      ["courseId", "classId", "className", "studentName", "responseType", "createdAt"],
      ...responseRows.map((item) => [
        course.code,
        item.classId || "class-1",
        item.className || "1반",
        item.studentName || "",
        item.responseType,
        item.createdAt || "",
      ]),
    ];
    content = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    type = "text/csv;charset=utf-8";
    ext = "csv";
  }

  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `농심튜터_${course.code}_성과리포트.${ext}`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ---- inlined from src\services\jobReflectionService.js ---- */
const bestReasonOptions = [
  "실제 사례가 많아서",
  "설명이 쉬워서",
  "현업 절차와 바로 연결돼서",
  "평소 궁금했던 내용이라서",
  "강사의 전달력이 좋아서",
  "기타",
];

const improvementReasonOptions = [
  "내용이 어려웠다",
  "사례가 부족했다",
  "현업 적용 방법이 잘 보이지 않았다",
  "시간이 부족했다",
  "자료나 화면이 이해하기 어려웠다",
  "강의 흐름이 빠르거나 산만했다",
  "기타",
];

function parseJobSchedule(text, date, courseId, createId) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(\d{1,2}:\d{2})\s*[~～\-]\s*(\d{1,2}:\d{2})\s+(.+?)\s*\/\s*(.+)$/);
    if (!match) return { error: line };
    return {
      id: createId("job-session"),
      courseId,
      date,
      startTime: match[1].padStart(5, "0"),
      endTime: match[2].padStart(5, "0"),
      title: match[3].trim(),
      instructor: match[4].trim(),
    };
  });
}

function countBy(values) {
  return values.reduce((counts, value) => {
    if (!value) return counts;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function ranked(counts, sessions) {
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count, title: sessions.find((session) => session.id === id)?.title || id }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ko"));
}

function summarizeJobReflections(sessions, reflections, participantCount) {
  const bestRanking = ranked(countBy(reflections.map((item) => item.bestSessionId)), sessions);
  const improvementRanking = ranked(countBy(reflections.map((item) => item.improvementSessionId)), sessions);
  const bestReasons = countBy(reflections.map((item) => item.bestReason));
  const improvementReasons = countBy(reflections.map((item) => item.improvementReason));
  const best = bestRanking[0];
  const improvement = improvementRanking[0];
  const topBestReason = Object.entries(bestReasons).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topImprovementReason = Object.entries(improvementReasons).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    submitted: reflections.length,
    participantCount,
    bestRanking,
    improvementRanking,
    bestReasons,
    improvementReasons,
    applicationPoints: reflections.map((item) => item.workApplicationPoint).filter(Boolean),
    analysis: best
      ? `오늘 직무과정에서는 ‘${best.title}’ 강의가 현업에 가장 도움이 된 강의로 가장 많이 선택되었습니다.${topBestReason ? ` 주요 이유는 ‘${topBestReason}’입니다.` : ""}`
      : "아직 제출된 회고가 없어 강의별 현업 적용성을 분석할 수 없습니다.",
    headquartersSummary: improvement
      ? `이번 기수에서는 ‘${improvement.title}’ 강의에서 보완 요구가 반복되었습니다.${topImprovementReason ? ` 주요 개선 요구는 ‘${topImprovementReason}’입니다.` : ""} 다음 기수 교안에는 실제 사례, 업무 단계별 흐름과 현장 적용 예시를 보완하는 것이 좋습니다.`
      : "현재까지 특정 강의에 집중된 보완 요구는 없습니다. 회고가 쌓이면 다음 기수 개선 항목을 제안합니다.",
    operationsSummary: `오늘 회고 제출률은 ${reflections.length}/${participantCount}명입니다.${best ? ` 현업 적용성이 높게 평가된 강의는 ‘${best.title}’입니다.` : ""}${improvement ? ` 보완 필요 응답이 가장 많은 강의는 ‘${improvement.title}’입니다.` : ""}`,
  };
}

/* ---- inlined from src\services\ideologyStampService.js ---- */
const STAMP_TYPES = [
  { type: "participation", label: "참여 스탬프", shortLabel: "참여", icon: "🙋", meaning: "질문, 발표, 토론과 실시간 응답에 적극 참여" },
  { type: "cooperation", label: "협동 스탬프", shortLabel: "협동", icon: "🤝", meaning: "팀 활동에서 역할을 수행하고 동료와 협력" },
  { type: "consideration", label: "배려 스탬프", shortLabel: "배려", icon: "🌱", meaning: "동료를 돕고 팀 분위기를 긍정적으로 조성" },
  { type: "reflection", label: "성찰 스탬프", shortLabel: "성찰", icon: "💭", meaning: "농협이념과 자신의 업무를 깊이 있게 연결" },
  { type: "olympic", label: "올림픽 스탬프", shortLabel: "올림픽", icon: "🏅", meaning: "농협올림픽 활동에서 우수한 참여와 팀 기여" },
  { type: "action", label: "실천 다짐 스탬프", shortLabel: "실천 다짐", icon: "✍️", meaning: "교육 내용을 현업에서 실천할 방법을 구체화" },
];

const STAMP_KEY = "ideologyStamps";

function loadIdeologyStamps() {
  try {
    const saved = JSON.parse(localStorage.getItem(STAMP_KEY) || "[]");
    return Array.isArray(saved) ? saved.map((item) => ({
      ...item,
      classId: item.classId || "class-1",
      className: item.className || "1반",
      status: item.status || "active",
    })) : [];
  } catch {
    return [];
  }
}

function saveIdeologyStamps(items) {
  safeSetItem(STAMP_KEY, JSON.stringify(items));
}

function stampCounts(items, participantId, studentName) {
  return STAMP_TYPES.reduce((counts, stamp) => ({
    ...counts,
    [stamp.type]: items
      .filter((item) => item.status === "active" && item.stampType === stamp.type && (participantId ? item.participantId === participantId : item.studentName === studentName))
      .reduce((sum, item) => sum + Number(item.count || 0), 0),
  }), {});
}

function buildStampRanking(items, students) {
  return students.map((student) => {
    const counts = stampCounts(items, student.id, student.name);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { ...student, counts, total };
  }).sort((a, b) =>
    b.total - a.total
    || b.counts.olympic - a.counts.olympic
    || b.counts.cooperation - a.counts.cooperation
    || b.counts.reflection - a.counts.reflection
    || a.name.localeCompare(b.name, "ko")
  ).map((item, index) => ({ ...item, rank: index + 1 }));
}

/* ---- app body ---- */
const SPLASH_VISIBLE_DURATION = 2200;
const SPLASH_FADE_DURATION = 600;
const REDUCED_MOTION_SPLASH_DURATION = 1200;
const REDUCED_MOTION_FADE_DURATION = 100;
const STUDENT_PROFILE_KEY = "nongsim-student-profiles-v1";

function followupTokenFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/followup\/([^/]+)/);
  return pathMatch?.[1] || new URLSearchParams(window.location.search).get("followup") || "";
}

function loadStoredStudentProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_PROFILE_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberStudentProfile(profile) {
  const profiles = loadStoredStudentProfiles().filter((item) => item.courseCode !== profile.courseCode || item.participantId !== profile.participantId);
  safeSetItem(STUDENT_PROFILE_KEY, JSON.stringify([...profiles, profile]));
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const presetRole = params.get("role");
  const presetCode = params.get("code") || "";
  const [splashPhase, setSplashPhase] = useState("visible");
  const [courses, setCourses] = useState(loadCourses);
  const [course, setCourseState] = useState(() => {
    const savedCourses = loadCourses();
    return savedCourses.find((item) => item.code === presetCode.toUpperCase()) || savedCourses[0];
  });
  const [role, setRole] = useState(() => {
    const matched = loadCourses().some((item) => item.code === presetCode.toUpperCase());
    return presetRole === "professor" && matched ? "professor" : null;
  });
  const [code, setCode] = useState(presetCode);
  const [studentName, setStudentName] = useState("");
  const [reentryCode, setReentryCode] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [allowDuplicateCreate, setAllowDuplicateCreate] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [toast, setToast] = useState("");
  const [showProfessorLogin, setShowProfessorLogin] = useState(false);
  const [professorPassword, setProfessorPassword] = useState("");
  const [professorStartTab, setProfessorStartTab] = useState("dashboard");
  const [ideologyStamps, setIdeologyStamps] = useState(loadIdeologyStamps);
  const entryCourse = courses.find((item) => item.code === code.trim().toUpperCase());

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visibleDuration = reduceMotion ? REDUCED_MOTION_SPLASH_DURATION : SPLASH_VISIBLE_DURATION;
    const fadeDuration = reduceMotion ? REDUCED_MOTION_FADE_DURATION : SPLASH_FADE_DURATION;
    const exitTimer = setTimeout(() => setSplashPhase("exiting"), visibleDuration);
    const hideTimer = setTimeout(() => setSplashPhase("hidden"), visibleDuration + fadeDuration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    saveActiveCourse(course);
  }, [course]);

  useEffect(() => {
    saveCourses(courses);
  }, [courses]);

  useEffect(() => {
    saveIdeologyStamps(ideologyStamps);
  }, [ideologyStamps]);

  useEffect(() => {
    const syncCourses = (event) => {
      if (event.key !== storageKeys.courses || !event.newValue) return;
      try {
        const nextCourses = JSON.parse(event.newValue);
        setCourses(nextCourses);
        setCourseState((current) => nextCourses.find((item) => item.code === current.code) || current);
      } catch {
        // 잘못된 외부 저장값은 무시합니다.
      }
    };
    window.addEventListener("storage", syncCourses);
    return () => window.removeEventListener("storage", syncCourses);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const showStorageWarning = (event) => setToast(event.detail?.message || STORAGE_WARNING_MESSAGE);
    window.addEventListener("nongsim-storage-warning", showStorageWarning);
    return () => window.removeEventListener("nongsim-storage-warning", showStorageWarning);
  }, []);

  useEffect(() => {
    const token = followupTokenFromLocation();
    if (!token || studentProfile) return;
    const matchedCourse = courses.find((item) => (item.participants || []).some((participant) => participant.reentryToken === token));
    const participant = matchedCourse?.participants?.find((item) => item.reentryToken === token);
    if (!matchedCourse || !participant) return;
    selectCourse(matchedCourse);
    setStudentProfile({ ...participant, lastAccessAt: now() });
    setRole("student");
    rememberStudentProfile({ ...participant, courseCode: matchedCourse.code });
  }, [courses, studentProfile]);

  const buildStudentProfile = (matchedCourse, classInfo, existingParticipant = null) => {
    const token = existingParticipant?.reentryToken || generateReentryToken();
    const participantId = existingParticipant?.participantId || existingParticipant?.id || generateParticipantId();
    const needsNewClassCode = classInfo && (!existingParticipant?.participantCode || String(existingParticipant.participantCode).startsWith("공통-") || String(existingParticipant.participantCode).startsWith("미배정-"));
    return {
      ...existingParticipant,
      id: participantId,
      participantId,
      name: studentName.trim() || existingParticipant?.name || existingParticipant?.studentName,
      studentName: studentName.trim() || existingParticipant?.studentName || existingParticipant?.name,
      courseId: matchedCourse.code,
      courseCode: matchedCourse.code,
      classId: classInfo?.id || existingParticipant?.classId || null,
      className: classInfo?.name || existingParticipant?.className || "미배정",
      participantCode: needsNewClassCode || !existingParticipant?.participantCode
        ? generateParticipantCode(matchedCourse, classInfo)
        : existingParticipant.participantCode,
      reentryToken: token,
      personalFollowupLink: existingParticipant?.personalFollowupLink || personalFollowupLink(token),
      deviceId: existingParticipant?.deviceId || null,
      pwaInstalled: existingParticipant?.pwaInstalled || false,
      notificationConsent: existingParticipant?.notificationConsent || "not-requested",
      fcmToken: existingParticipant?.fcmToken || null,
      createdAt: existingParticipant?.createdAt || now(),
      lastAccessAt: now(),
      lastActiveAt: now(),
    };
  };

  const saveStudentToCourse = (matchedCourse, profile, classInfo = null) => {
    const exists = (matchedCourse.participants || []).some((item) => (item.participantId || item.id) === profile.participantId);
    const nextCourse = {
      ...matchedCourse,
      participants: exists
        ? matchedCourse.participants.map((item) => (item.participantId || item.id) === profile.participantId ? profile : item)
        : [...(matchedCourse.participants || []), profile],
      goals: classInfo
        ? matchedCourse.goals.map((goal) => goal.participantId === profile.participantId && !goal.classId ? { ...goal, classId: classInfo.id, className: classInfo.name } : goal)
        : matchedCourse.goals,
    };
    setCourses((items) => items.map((item) => item.code === nextCourse.code ? nextCourse : item));
    selectCourse(nextCourse);
    setStudentProfile(profile);
    rememberStudentProfile(profile);
  };

  const setCourse = (update) => {
    setCourseState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      setCourses((items) => {
        const exists = items.some((item) => item.code === next.code);
        return exists ? items.map((item) => item.code === next.code ? next : item) : [...items, next];
      });
      return next;
    });
  };

  const selectCourse = (nextCourse) => {
    setCourseState(nextCourse);
    setCode(nextCourse.code);
  };

  const updateRegisteredCourse = (updatedCourse) => {
    setCourses((items) => items.map((item) => item.code === updatedCourse.code ? updatedCourse : item));
    if (course.code === updatedCourse.code) setCourseState(updatedCourse);
  };

  const deleteRegisteredCourse = (courseCode) => {
    const remaining = courses.filter((item) => item.code !== courseCode);
    setCourses(remaining);
    if (course.code === courseCode) {
      if (remaining.length) selectCourse(remaining[0]);
      else {
        setRole(null);
        setProfessorStartTab("create");
        setCode("");
      }
    }
  };

  const enterWithReentryOnly = () => {
    if (!privacyAccepted) {
      setToast("정보 입력 주의사항을 확인해주세요.");
      return;
    }
    const enteredReentry = reentryCode.trim();
    if (!enteredReentry) {
      setToast("재입장 코드를 입력해주세요.");
      return;
    }
    const matches = courses.flatMap((courseItem) => (courseItem.participants || [])
      .filter((participant) => [participant.participantCode, participant.reentryToken].includes(enteredReentry))
      .map((participant) => ({ courseItem, participant })));
    if (!matches.length) {
      setToast("재입장 코드와 일치하는 교육생을 찾지 못했습니다.");
      return;
    }
    if (matches.length > 1) {
      setToast("같은 재입장 코드가 여러 과정에 있습니다. 과정코드도 함께 입력해주세요.");
      return;
    }
    const { courseItem, participant } = matches[0];
    const profile = { ...participant, lastAccessAt: now(), lastActiveAt: now() };
    saveStudentToCourse(courseItem, profile, participant.classId ? { id: participant.classId, name: participant.className } : null);
    setCode(courseItem.code);
    setStudentName(participant.name || participant.studentName || "");
    setReentryCode("");
    setRole("student");
  };

  const enter = (nextRole) => {
    const enteredCode = code.trim().toUpperCase();
    if (nextRole === "professor" && !enteredCode) {
      setShowProfessorLogin(true);
      return;
    }
    if (!privacyAccepted) {
      setToast("정보 입력 주의사항을 확인해주세요.");
      return;
    }
    if (nextRole === "student" && !studentName.trim()) {
      setToast("교육생 이름을 입력해주세요.");
      return;
    }
    const matchedCourse = courses.find((item) => item.code === enteredCode);
    if (!matchedCourse) {
      setToast("해당 과정 코드를 찾을 수 없습니다. 발급받은 코드를 다시 확인해주세요.");
      return;
    }
    if (nextRole === "student") {
      const availableClasses = matchedCourse.classes || createClasses(matchedCourse.classCount);
      const phase = getCoursePhase(matchedCourse);
      const cleanName = studentName.trim();
      const sameNameParticipants = (matchedCourse.participants || []).filter((item) => (item.name || item.studentName) === cleanName);
      const enteredReentry = reentryCode.trim();
      const storedProfile = loadStoredStudentProfiles().find((item) => item.courseCode === matchedCourse.code && (item.name || item.studentName) === cleanName);
      const existingParticipant = enteredReentry
        ? (matchedCourse.participants || []).find((item) => [item.participantCode, item.reentryToken].includes(enteredReentry))
        : storedProfile
          ? (matchedCourse.participants || []).find((item) => (item.participantId || item.id) === storedProfile.participantId)
          : sameNameParticipants.length === 1
            ? sameNameParticipants[0]
            : null;
      if (enteredReentry && !existingParticipant) {
        setToast("재입장 코드가 맞지 않습니다. 코드를 다시 확인해주세요.");
        return;
      }
      if (!enteredReentry && sameNameParticipants.length > 1 && !existingParticipant && !allowDuplicateCreate) {
        setDuplicateCandidates(sameNameParticipants);
        setToast("같은 이름의 교육생이 2명 이상 있습니다. 본인의 반 또는 재입장 코드를 확인해주세요.");
        return;
      }
      const needsClass = phase !== "before";
      const classInfo = !needsClass
        ? null
        : existingParticipant?.classId
          ? availableClasses.find((item) => item.id === existingParticipant.classId)
          : availableClasses.length === 1
            ? availableClasses[0]
            : availableClasses.find((item) => item.id === selectedClassId);
      if (needsClass && !classInfo) {
        setToast("반 배정이 완료되었습니다. 본인의 반을 선택해주세요.");
        return;
      }
      const profile = buildStudentProfile(matchedCourse, classInfo, existingParticipant);
      saveStudentToCourse(matchedCourse, profile, classInfo);
      setDuplicateCandidates([]);
      setAllowDuplicateCreate(false);
      setReentryCode("");
    } else {
      selectCourse(matchedCourse);
    }
    setProfessorStartTab("dashboard");
    setRole(nextRole);
  };

  const enterProfessorAdmin = () => {
    if (!privacyAccepted) {
      setToast("정보 입력 주의사항을 확인해주세요.");
      return;
    }
    if (professorPassword !== ADMIN_PASSWORD) {
      setToast("교수요원 관리자 비밀번호가 맞지 않습니다.");
      return;
    }
    setShowProfessorLogin(false);
    setProfessorPassword("");
    setProfessorStartTab("create");
    setRole("professor");
  };

  if (splashPhase !== "hidden") {
    return <SplashScreen phase={splashPhase} />;
  }

  if (!role) {
    return (
      <div className="entry-shell main-entry-screen">
        <main className="entry-card">
          <Brand />
          <a className="academy-link" href="https://nh-gurye-edu.vercel.app/" target="_blank" rel="noreferrer" aria-label="농협교육원 통합관리앱 새 창으로 열기">
            농협교육원 통합관리앱 <span>↗</span>
          </a>
          <div className="entry-copy">
            <span className="eyebrow">AI 교육 평가·전이 관리 에이전트</span>
            <h1>교육의 순간을<br />현장의 변화로<br />연결합니다.</h1>
            <p>목표부터 수료 성찰, 2개월 후 현업 적용까지 하나의 데이터 흐름으로 확인하세요.</p>
          </div>
          <label className="field">
            <span>과정 코드</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NH-2480" />
          </label>
          <label className="field">
            <span>이름 <small>교육생 입장 시 필수</small></span>
            <input value={studentName} onChange={(e) => { setStudentName(e.target.value); setDuplicateCandidates([]); setAllowDuplicateCreate(false); }} placeholder="이름 입력" />
          </label>
          {entryCourse && getCoursePhase(entryCourse) !== "before" && (entryCourse.classCount || 1) > 1 && !reentryCode.trim() && (allowDuplicateCreate || !(entryCourse.participants || []).some((item) => (item.name || item.studentName) === studentName.trim() && item.courseId === entryCourse.code && item.classId)) && (
            <div className="entry-class-select">
              <span>반 배정이 완료되었습니다. 본인의 반을 선택해 주세요.</span>
              <div>{entryCourse.classes.map((item) => <button type="button" key={item.id} className={selectedClassId === item.id ? "selected" : ""} onClick={() => setSelectedClassId(item.id)}>{item.name}</button>)}</div>
            </div>
          )}
          {duplicateCandidates.length > 0 && (
            <div className="duplicate-entry-panel">
              <b>같은 이름의 교육생이 이 과정에 2명 이상 있습니다.</b>
              <p>본인의 반을 선택하거나, 안내받은 재입장 코드를 입력해 주세요.</p>
              <div>{duplicateCandidates.map((item) => <button type="button" key={item.participantId || item.id} onClick={() => {
                const profile = { ...item, lastAccessAt: now(), lastActiveAt: now() };
                saveStudentToCourse(entryCourse, profile, item.classId ? { id: item.classId, name: item.className } : null);
                setStudentName(item.name || item.studentName || "");
                setDuplicateCandidates([]);
                setRole("student");
              }}>{item.name || item.studentName} / {item.className || "미배정"}</button>)}</div>
              <label className="field">
                <span>재입장 코드 <small>동명이인 확인용</small></span>
                <input value={reentryCode} onChange={(e) => setReentryCode(e.target.value.trim())} placeholder="예: 1반-07 또는 A7K3Q9" />
              </label>
              <small>본인 반이 확실하지 않으면 교수요원에게 문의해 주세요.</small>
            </div>
          )}
          <p className="professor-entry-note">교수요원은 이름 없이 과정코드만 입력하면 됩니다. 교육생은 기본적으로 과정코드와 이름으로 입장합니다.</p>
          <label className="privacy-check">
            <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
            <span><b>입력 전 확인</b><br />입장용 이름 외 고객정보, 계좌정보 및 회사기밀은 입력하지 않습니다.</span>
          </label>
          <div className="entry-actions">
            <button className="primary" onClick={() => enter("student")}>교육생으로 입장</button>
            <button className="secondary" onClick={() => enter("professor")}>교수요원으로 입장</button>
          </div>
          <p className="demo-hint">과정 관리자는 코드를 비워둔 채 교수요원으로 입장할 수 있습니다.</p>
          {showProfessorLogin && (
            <div className="professor-login-panel">
              <span className="eyebrow">교수요원 관리자 인증</span>
              <h3>새 과정 등록</h3>
              <p>과정 코드가 없는 경우 관리자 비밀번호로 입장하세요.</p>
              <input
                type="password"
                value={professorPassword}
                onChange={(e) => setProfessorPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enterProfessorAdmin()}
                placeholder="관리자 비밀번호"
                aria-label="관리자 비밀번호 입력"
              />
              <button className="primary" onClick={enterProfessorAdmin}>인증 후 과정 등록</button>
              <small>로컬 시연 비밀번호: <b>{ADMIN_PASSWORD}</b></small>
            </div>
          )}
        </main>
        {toast && <Toast>{toast}</Toast>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header course={course} role={role} onHome={() => setRole(null)} onExit={() => setRole(null)} />
      {role === "student"
        ? <StudentApp course={course} setCourse={setCourse} student={studentProfile} ideologyStamps={ideologyStamps} onExit={() => setRole(null)} notify={setToast} />
        : <ProfessorApp course={course} setCourse={setCourse} courses={courses} ideologyStamps={ideologyStamps} setIdeologyStamps={setIdeologyStamps} onSelectCourse={selectCourse} onUpdateCourse={updateRegisteredCourse} onDeleteCourse={deleteRegisteredCourse} initialTab={professorStartTab} onExit={() => setRole(null)} notify={setToast} />}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

function SplashScreen({ phase }) {
  return (
    <div className={`splash-screen ${phase}`} aria-label="농심튜터 시작 화면">
      <div className="splash-pattern" aria-hidden="true">NH · NH · NH</div>
      <div className="splash-content">
        <div className="splash-mark">NH</div>
        <h1>NH 농심튜터</h1>
        <p>교육의 시간을 현장의 변화로</p>
        <i aria-hidden="true" />
        <small>NONGHYUP EDUCATION AI</small>
      </div>
    </div>
  );
}

function Brand({ onClick }) {
  return (
    <button className="brand" onClick={onClick} type="button">
      <div className="brand-mark">NH</div>
      <div><b>농심튜터</b><span>성과를 증명하는 교육 AI</span></div>
    </button>
  );
}

function Header({ course, role, onHome, onExit }) {
  return (
    <header className="topbar">
      <Brand onClick={onHome} />
      <div className="topbar-meta">
        <span className={`role-badge ${role}`}>{role === "student" ? "교육생" : "교수요원"}</span>
        <span className="course-code">{course.code}</span>
        <button className="icon-button" onClick={onExit} aria-label="나가기">↗</button>
      </div>
    </header>
  );
}

function StudentApp({ course, setCourse, student, ideologyStamps, onExit, notify }) {
  const participantId = student?.id || "student-demo";
  const participantName = student?.name || "교육생";
  const myGoal = course.goals.find((goal) => goal.participantId === participantId);
  const myAchievement = course.achievements.find((item) => item.participantId === participantId);
  const mySurvey = course.surveys.find((item) => item.participantId === participantId);
  const myMission = course.missions.find((item) => item.participantId === participantId);
  const myLatestJobReflection = [...(course.jobReflections || [])]
    .filter((item) => item.participantId === participantId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
  const personalizedMissionText = buildPersonalizedTransferMission({ goal: myGoal, jobReflection: myLatestJobReflection, studentName: participantName });
  const currentMissionText = myMission?.missionText && myMission.missionText !== DEFAULT_TRANSFER_MISSION
    ? myMission.missionText
    : personalizedMissionText;
  const classId = student?.classId || null;
  const className = student?.className || "미배정";
  const activeRound = course.rounds.find((round) => round.kind === "poll" && classId && round.classId === classId && !round.items.some((item) => item.participantId === participantId));
  const boardRounds = course.rounds.filter((round) => round.kind === "board" && classId && round.classId === classId);
  const [view, setView] = useState("home");
  const [goalStep, setGoalStep] = useState(0);
  const [goalAnswers, setGoalAnswers] = useState(["", "", ""]);
  const [goalDraft, setGoalDraft] = useState(null);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [studentRoleplayText, setStudentRoleplayText] = useState("");
  const [studentRoleplayStep, setStudentRoleplayStep] = useState(1);
  const [studentFollowupQuestions, setStudentFollowupQuestions] = useState([]);
  const [studentFollowupAnswer, setStudentFollowupAnswer] = useState("");
  const [studentRoleplayFeedback, setStudentRoleplayFeedback] = useState(null);
  const [checkpointResponses, setCheckpointResponses] = useState({});
  const [achievementStep, setAchievementStep] = useState(0);
  const [achievementAnswers, setAchievementAnswers] = useState(["", "", ""]);
  const [achievementDraft, setAchievementDraft] = useState(null);
  const [survey, setSurvey] = useState({ applied: "", support: "", likert: [0, 0, 0, 0, 0], barriers: [] });
  const phase = getCoursePhase(course);
  const [phaseTab, setPhaseTab] = useState(phase);
  const todayReflection = (course.jobReflections || []).some((item) => item.participantId === participantId && item.date === todayInKorea());
  const myBoardComplete = boardRounds.length > 0 && boardRounds.every((round) => round.items.some((item) => item.participantId === participantId));
  const myRoleplayComplete = (course.reportTrainings || []).some((item) => item.participantId === participantId);

  useEffect(() => {
    setPhaseTab(phase);
    setView("home");
  }, [phase, course.code]);

  useEffect(() => {
    if (window.location.hash === "#survey" && phase === "transfer" && !mySurvey) {
      setView("survey");
    }
  }, [phase, mySurvey]);

  const stage = phase === "before"
    ? (!myGoal ? "goal" : "done")
    : phase === "active"
      ? (activeRound ? "poll" : "class")
      : phase === "completion"
        ? (!myAchievement ? "achievement" : "done")
        : phase === "transfer"
          ? (!mySurvey ? "survey" : "done")
          : "followupWait";
  const olympicActivityOpen = course.type === "ideology" && phase === "active" && course.olympicActivityOpen === true;
  const nextMission = {
    goal: { title: "나의 교육 목표를 세워주세요", desc: "AI가 구체적인 실천 목표로 다듬어 드립니다.", cta: "나의 교육 목표 작성하기", target: "goal" },
    poll: { title: "강사의 실시간 질문에 답해주세요", desc: activeRound?.prompt, cta: "강사 질문에 답하기", target: "poll" },
    class: { title: "교육이 진행 중입니다", desc: "교수요원이 실시간 질문을 열면 이곳에 바로 표시됩니다." },
    achievement: { title: "배움과 목표 달성도를 돌아보세요", desc: "교육 전 목표와 연결해 수료 성찰을 남겨주세요.", cta: "목표 달성도 작성하기", target: "achievement" },
    survey: { title: "현업 적용 경험을 알려주세요", desc: "현업 적용을 도운 점과 막힌 점을 모아 다음 교육과 지원을 개선합니다.", cta: "현업 적용도 응답하기", target: "survey" },
    followupWait: { title: `현업 적용도 조사는 ${getTransferDate(course)}에 열립니다`, desc: "교육 종료 후 2개월 동안 배운 내용을 현업에서 적용해보세요." },
    done: { title: "이번 단계의 응답을 완료했어요", desc: "입력한 내용은 과정 운영 데이터에 안전하게 반영됩니다." },
  }[stage];
  const mission = nextMission;

  const saveGoal = () => {
    if (!goalDraft || goalDraft.trim().length < 8) return notify("목표를 조금 더 구체적으로 작성해주세요.");
    const refined = goalDraft.trim().endsWith("겠습니다.") ? goalDraft.trim() : `${goalDraft.trim().replace(/[.!]$/, "")}하겠습니다.`;
    const plan = createGoalPlan(refined, goalAnswers);
    setCourse((c) => ({
      ...c,
      goals: [...c.goals, {
        id: uid("goal"),
        participantId,
        name: participantName,
        classId: classId || null,
        className: classId ? className : "미배정",
        text: plan.goalText,
        goalText: plan.goalText,
        focusPoint: plan.focusPoint,
        actionMission: plan.actionMission,
        createdAt: now(),
      }],
    }));
    setGoalDraft(null);
    setGoalAnswers(["", "", ""]);
    setGoalStep(0);
    setView("home");
    notify("나의 교육 목표가 저장되었습니다.");
  };

  const composeGoal = () => {
    if (!goalAnswers[goalStep].trim()) return notify("질문에 대한 답변을 작성해주세요.");
    const [expectation, challenge, success] = goalAnswers;
    setGoalDraft(
      `현재 현업에서 “${challenge.trim()}”라고 느끼고 있습니다. 이번 교육에서는 “${expectation.trim()}”라는 기대를 구체적인 배움과 실천으로 연결하겠습니다. 교육이 끝난 뒤에는 “${success.trim()}”라고 말할 수 있도록 배운 내용을 현장에 꾸준히 적용하겠습니다.`
    );
  };

  const submitAnswer = () => {
    const isObjective = activeRound?.questionType === "objective";
    if (isObjective && !selectedChoice) return notify("답변 항목을 선택해주세요.");
    if (!isObjective && !answer.trim()) return notify("답변을 입력해주세요.");
    setCourse((c) => ({
      ...c,
      rounds: c.rounds.map((r) => r.id === activeRound.id ? {
        ...r,
        items: [...r.items, {
          id: uid("item"),
          participantId,
          by: participantName,
          classId,
          className,
          text: isObjective ? selectedChoice : answer.trim(),
          choice: isObjective ? selectedChoice : undefined,
          reactions: {},
          createdAt: now(),
        }],
      } : r),
    }));
    setAnswer("");
    setSelectedChoice("");
    setView("home");
    notify("답변을 제출했습니다.");
  };

  const saveAchievement = () => {
    if (!achievementDraft?.summary.trim()) return notify("수료 성찰 내용을 확인해주세요.");
    const achievement = { id: uid("ach"), participantId, name: participantName, classId, className, text: achievementDraft.summary.trim(), answers: achievementAnswers, createdAt: now() };
    const missionItem = {
      id: uid("mission"),
      participantId,
      classId,
      className,
      goalId: myGoal?.id,
      missionText: achievementDraft.mission.trim(),
      dueDate: getTransferDate(course),
      status: "assigned",
      missionCheckpoints: createMissionCheckpoints(),
    };
    setCourse((c) => ({ ...c, achievements: [...c.achievements, achievement], missions: [...c.missions, missionItem] }));
    setAchievementDraft(null);
    setAchievementAnswers(["", "", ""]);
    setAchievementStep(0);
    setView("home");
    notify("수료 성찰과 현업 미션이 생성되었습니다.");
  };

  const composeAchievement = () => {
    if (!achievementAnswers[achievementStep].trim()) return notify("질문에 대한 답변을 작성해주세요.");
    const missionText = buildPersonalizedTransferMission({ goal: myGoal, achievementAnswers, jobReflection: myLatestJobReflection, studentName: participantName });
    setAchievementDraft({
      summary: `교육 전 목표를 기준으로 돌아보면 “${achievementAnswers[0].trim()}”라는 변화가 있었습니다. 앞으로 “${achievementAnswers[1].trim()}” 부분을 더 연습하겠습니다.`,
      mission: missionText,
    });
  };

  const saveSurvey = () => {
    if (survey.likert.some((value) => !value)) return notify("객관식 문항에 모두 답해주세요.");
    if (!survey.applied.trim() || !survey.support.trim()) return notify("현업 적용 사례와 필요한 지원을 모두 작성해주세요.");
    setCourse((c) => ({
      ...c,
      surveys: [...c.surveys, { id: uid("survey"), participantId, classId, className, ...survey, submittedAt: now(), createdAt: now() }],
      missions: c.missions.map((mission) => mission.participantId === participantId ? {
        ...mission,
        missionCheckpoints: (mission.missionCheckpoints || createMissionCheckpoints()).map((checkpoint) => checkpoint.week === 8 ? { ...checkpoint, status: "completed", response: "현업활용도 제출 완료" } : checkpoint),
      } : mission),
    }));
    setView("home");
    notify("현업 적용도 응답을 완료했습니다.");
  };

  const submitRoleplay = () => {
    if (!studentRoleplayText.trim()) return notify("AI 팀장에게 보고할 내용을 작성해주세요.");
    const config = course.roleplayConfig;
    setStudentFollowupQuestions(createFollowupQuestions(config.scenario, config.difficulty));
    setStudentRoleplayStep(3);
  };

  const completeRoleplay = () => {
    if (!studentFollowupAnswer.trim()) return notify("AI 팀장의 꼬리질문에 답해주세요.");
    const config = course.roleplayConfig;
    const feedback = buildStructuredReportFeedback(studentRoleplayText.trim(), studentFollowupAnswer.trim());
    const training = {
      id: uid("report-training"),
      participantId,
      name: participantName,
      classId,
      className,
      scenario: config.scenario,
      difficulty: config.difficulty,
      reportText: studentRoleplayText.trim(),
      followupQuestion: studentFollowupQuestions.join(" / "),
      followupAnswer: studentFollowupAnswer.trim(),
      feedback,
      createdAt: now(),
    };
    setCourse((current) => ({ ...current, reportTrainings: [...(current.reportTrainings || []), training] }));
    setStudentRoleplayFeedback(feedback);
    setStudentRoleplayStep(4);
    notify("4단계 보고 훈련을 완료했습니다.");
  };

  const completeCheckpoint = (missionId, week) => {
    const response = (checkpointResponses[`${missionId}-${week}`] || "").trim();
    if (!response) return notify("실천 내용이나 어려움을 짧게 작성해주세요.");
    setCourse((current) => ({
      ...current,
      missions: current.missions.map((mission) => mission.id === missionId ? {
        ...mission,
        missionCheckpoints: (mission.missionCheckpoints || createMissionCheckpoints()).map((checkpoint) => checkpoint.week === week ? { ...checkpoint, status: "completed", response } : checkpoint),
      } : mission),
    }));
    notify(`${week}주 체크를 완료했습니다.`);
  };

  return (
    <main className="page student-page">
      <PageBack onClick={() => view === "home" ? onExit() : setView("home")} />
      <section className="course-hero">
        <div>
          <span className="eyebrow">오늘의 학습 여정</span>
          <div className="course-title-row">
            <h1>{course.name}</h1>
            {olympicActivityOpen && <OlympicsLink />}
          </div>
          <p>{courseTypes[course.type]}{course.leadershipGrade ? ` · ${course.leadershipGrade}` : ""}{course.cohort ? ` · ${course.cohort}` : ""} · {course.startDate} ~ {course.endDate}</p>
          <span className="student-class-meta">{course.name}{classId ? ` · ${className}` : " · 입교 전"}</span>
        </div>
        <Progress steps={[!!myGoal, course.rounds.some((round) => round.kind === "poll" && round.items.some((item) => item.participantId === participantId)), !!myAchievement, !!mySurvey]} />
      </section>
      <StudentPhaseTabs phase={phase} selected={phaseTab} transferDate={getTransferDate(course)} onSelect={(next) => {
        if (next !== phase) return notify("현재 교육기간에 해당하는 단계만 이용할 수 있습니다.");
        setPhaseTab(next);
        setView("home");
      }} />
      {view === "home" && <StudentTodayTasks
        phase={phase}
        stage={stage}
        activeRound={activeRound}
        boardRounds={boardRounds}
        boardComplete={myBoardComplete}
        roleplayEnabled={course.type === "newbie" && course.roleplayConfig?.enabled && course.roleplayConfig.classId === classId}
        roleplayComplete={myRoleplayComplete}
        jobReflection={course.type === "job"}
        reflectionComplete={todayReflection}
        olympics={olympicActivityOpen}
        onAction={setView}
      />}
      {view === "home"
        && stage !== "class"
        && !(phase === "before" && myGoal)
        && !(phase === "completion" && stage === "done")
        && !(phase === "transfer" && stage === "done")
        && <StudentMissionCard mission={mission} completed={stage === "done"} onAction={mission.target ? () => setView(mission.target) : undefined} />}
      {view === "home" && ["completion", "followupWait", "transfer"].includes(phase) && (
        <StudentReentryCard course={course} student={student} phase={phase} onOpenSurvey={() => setView("survey")} />
      )}
      {phase !== "active" && <StudentGoalCard goal={myGoal} onWrite={() => setView("goal")} />}
      {view === "goal" && (
        <ActionPanel title="나의 목표 세우기" eyebrow="입교 전 목표">
          <p className="helper">몇 가지 질문에 답하면 AI가 ‘나의 교육 목표’로 정리해 드립니다. 이 목표는 수료 때와 교육 2개월 후 다시 확인합니다.</p>
          <p className="theory-caption">커크패트릭 4단계 중 3단계(행동·전이)를 직접 측정합니다.</p>
          {goalDraft === null ? (
            <div className="goal-wizard">
              <div className="goal-progress">{goalQuestions.map((_, index) => <i key={index} className={index <= goalStep ? "active" : ""} />)}</div>
              <span>질문 {goalStep + 1} / {goalQuestions.length}</span>
              <h3>{goalQuestions[goalStep]}</h3>
              <textarea
                value={goalAnswers[goalStep]}
                onChange={(e) => setGoalAnswers(goalAnswers.map((answer, index) => index === goalStep ? e.target.value : answer))}
                placeholder="자유롭게 적어 주세요"
                aria-label={`목표 질문 ${goalStep + 1} 답변`}
              />
              <div className="goal-wizard-actions">
                {goalStep > 0 && <button className="secondary" onClick={() => setGoalStep(goalStep - 1)}>이전</button>}
                {goalStep < goalQuestions.length - 1
                  ? <button className="primary" disabled={!goalAnswers[goalStep].trim()} onClick={() => setGoalStep(goalStep + 1)}>다음</button>
                  : <button className="gold-button" disabled={!goalAnswers[goalStep].trim()} onClick={composeGoal}>AI로 정리하기</button>}
              </div>
            </div>
          ) : (
            <div className="goal-draft-card">
              <span>AI가 정리한 목표 — 자유롭게 다듬어도 좋아요</span>
              <textarea value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} aria-label="AI가 정리한 교육 목표 수정" />
              <div><button className="secondary" onClick={() => setGoalDraft(null)}>다시 답하기</button><button className="primary" onClick={saveGoal}>나의 목표 저장하기</button></div>
            </div>
          )}
          <button className="goal-cancel" onClick={() => setView("home")}>← 돌아가기</button>
        </ActionPanel>
      )}
      {view === "poll" && (
        <ActionPanel title="강사 질문에 답하기" eyebrow="실시간 참여">
          {activeRound.anonymous && <span className="anonymous-badge">🙈 익명</span>}
          <div className="question-box">{activeRound.prompt}</div>
          {activeRound.questionType === "objective"
            ? <div className="student-choice-list">{activeRound.options.map((option) => <button key={option} className={selectedChoice === option ? "selected" : ""} onClick={() => setSelectedChoice(option)}>{option}</button>)}</div>
            : <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="정답보다 현장의 생각을 솔직하게 적어주세요." aria-label="강사 질문 답변" />}
          <PanelActions onBack={() => setView("home")} onSave={submitAnswer} saveLabel="답변 제출하기" />
        </ActionPanel>
      )}
      {phase === "active" && view === "home" && (
        <>
          {course.type === "job"
            ? <StudentJobReflection course={course} setCourse={setCourse} student={student} notify={notify} />
            : <StudentBoardArea rounds={boardRounds} course={course} setCourse={setCourse} student={student} notify={notify} />}
          {course.type === "newbie" && course.roleplayConfig?.enabled && course.roleplayConfig.classId === classId && (
            <section className="student-roleplay-card">
              <div><span className="eyebrow">신규직원 개인 훈련</span><h2>AI 보고 훈련</h2><p>{course.roleplayConfig.scenario} · {course.roleplayConfig.difficulty} 난이도</p></div>
              <button className="primary" onClick={() => { setStudentRoleplayText(""); setStudentFollowupAnswer(""); setStudentFollowupQuestions([]); setStudentRoleplayFeedback(null); setStudentRoleplayStep(1); setView("roleplay"); }}>보고 훈련 시작</button>
            </section>
          )}
        </>
      )}
      {phase === "active" && view === "home" && <StudentGoalCard goal={myGoal} onWrite={() => setView("goal")} compact />}
      {course.type === "ideology" && phase === "active" && view === "home" && <StudentStampCard stamps={ideologyStamps.filter((item) => item.courseId === course.code)} student={student} />}
      {view === "roleplay" && course.type === "newbie" && course.roleplayConfig?.enabled && course.roleplayConfig.classId === classId && (
        <ActionPanel title="AI 팀장 보고 훈련" eyebrow="신규직원과정">
          <div className="roleplay-stepper">{["상황 확인", "30초 보고", "AI 꼬리질문", "보고 피드백"].map((label, index) => <div className={studentRoleplayStep >= index + 1 ? "active" : ""} key={label}><b>{index + 1}</b><span>{label}</span></div>)}</div>
          <div className="roleplay-setting-summary"><b>{course.roleplayConfig.scenario}</b><span>{course.roleplayConfig.difficulty} · {roleplayManagerLabel(course.roleplayConfig.difficulty)}</span></div>
          {studentRoleplayStep === 1 && <div className="roleplay-situation-card"><h3>상황을 확인하세요</h3><p>{roleplayOpening(course.roleplayConfig.scenario)}</p><button className="primary" onClick={() => setStudentRoleplayStep(2)}>상황 확인 완료</button></div>}
          {studentRoleplayStep === 2 && <div className="roleplay-box">
            <div className="manager-bubble"><b>{course.roleplayConfig.difficulty} 팀장</b><p>{roleplayOpening(course.roleplayConfig.scenario)}</p></div>
            <textarea value={studentRoleplayText} onChange={(e) => setStudentRoleplayText(e.target.value)} placeholder="30초 안에 보고한다는 마음으로 작성하세요." aria-label="보고 훈련 답변" />
            <button className="primary" onClick={submitRoleplay}>AI 팀장에게 보고하기</button>
          </div>}
          {studentRoleplayStep === 3 && <div className="roleplay-followup"><span className="eyebrow">AI 팀장 꼬리질문</span>{studentFollowupQuestions.map((question) => <h3 key={question}>“{question}”</h3>)}<textarea value={studentFollowupAnswer} onChange={(e) => setStudentFollowupAnswer(e.target.value)} placeholder="추가 사실, 조치 계획, 요청사항을 포함해 답해주세요." aria-label="AI 팀장 꼬리질문 답변" /><button className="primary" onClick={completeRoleplay}>답변하고 피드백 받기</button></div>}
          {studentRoleplayStep === 4 && studentRoleplayFeedback && <ReportFeedback feedback={studentRoleplayFeedback} />}
          <PanelActions onBack={() => setView("home")} />
        </ActionPanel>
      )}
      {view === "achievement" && (
        <ActionPanel title="수료 · 목표 달성도" eyebrow="수료일">
          <div className="linked-goal"><span>교육 전 나의 목표</span><p>{myGoal?.text}</p></div>
          <p className="helper">입교 때 세운 목표를 떠올리며 답하면 AI가 달성도를 정리하고 2주 현업 미션을 제안합니다.</p>
          <p className="theory-caption">커크패트릭 4단계 중 3단계(행동·전이)를 직접 측정합니다.</p>
          {achievementDraft === null ? (
            <div className="goal-wizard">
              <div className="goal-progress">{achievementQuestions.map((_, index) => <i key={index} className={index <= achievementStep ? "active" : ""} />)}</div>
              <span>질문 {achievementStep + 1} / {achievementQuestions.length}</span>
              <h3>{achievementQuestions[achievementStep]}</h3>
              <textarea value={achievementAnswers[achievementStep]} onChange={(e) => setAchievementAnswers(achievementAnswers.map((item, index) => index === achievementStep ? e.target.value : item))} placeholder="자유롭게 적어 주세요" aria-label={`수료 성찰 질문 ${achievementStep + 1} 답변`} />
              <div className="goal-wizard-actions">
                {achievementStep > 0 && <button className="secondary" onClick={() => setAchievementStep(achievementStep - 1)}>이전</button>}
                {achievementStep < achievementQuestions.length - 1
                  ? <button className="primary" disabled={!achievementAnswers[achievementStep].trim()} onClick={() => setAchievementStep(achievementStep + 1)}>다음</button>
                  : <button className="gold-button" disabled={!achievementAnswers[achievementStep].trim()} onClick={composeAchievement}>AI로 정리하기</button>}
              </div>
            </div>
          ) : (
            <div className="goal-draft-card">
              <span>AI가 정리한 목표 달성도</span>
              <textarea value={achievementDraft.summary} onChange={(e) => setAchievementDraft({ ...achievementDraft, summary: e.target.value })} aria-label="AI가 정리한 목표 달성도 수정" />
              <span>2주 현업 미션</span>
              <textarea value={achievementDraft.mission} onChange={(e) => setAchievementDraft({ ...achievementDraft, mission: e.target.value })} aria-label="2주 현업 미션 수정" />
              <MissionElementBadges missionText={achievementDraft.mission} />
              <p className="theory-caption">좋은 행동계획의 3요소(언제·무엇을·어떻게)를 갖추도록 설계됩니다.</p>
              <div><button className="secondary" onClick={() => setAchievementDraft(null)}>다시 답하기</button><button className="primary" onClick={saveAchievement}>성찰 저장하기</button></div>
            </div>
          )}
        </ActionPanel>
      )}
      {view === "survey" && (
        <ActionPanel title="현업 적용도 응답" eyebrow="교육 2개월 후">
          <div className="survey-notice">
            <b>교육은 아직 끝나지 않았습니다.</b>
            <span>배운 것을 현업에 적용하면서 막힌 점이 있다면 알려주세요. 다음 교육과 지원을 개선하는 데 활용하겠습니다.</span>
            <small>이 조사는 개인 평가가 아니라, 무엇이 적용을 도왔고 무엇이 막았는지를 배우기 위한 것입니다. 응답 내용은 교수요원에게 실명으로 공개되지 않으며, 분석·보고에는 익명·집계 형태로만 활용됩니다. 단, 재안내와 중복 응답 방지를 위해 제출 여부는 시스템에서 확인될 수 있습니다.</small>
          </div>
          <div className="survey-mission-preview">
            <span className="eyebrow">나의 현업 미션</span>
            <h3>{currentMissionText}</h3>
            <MissionElementBadges missionText={currentMissionText} />
            <p className="theory-caption">좋은 행동계획의 3요소(언제·무엇을·어떻게)를 갖추도록 설계됩니다.</p>
          </div>
          <div className="likert-survey">{transferQuestions.map((question, questionIndex) => (
            <div key={question}><b>{questionIndex + 1}. {question}</b><div>{["전혀 아니다", "아니다", "보통", "그렇다", "매우 그렇다"].map((label, optionIndex) => <button key={label} className={survey.likert[questionIndex] === optionIndex + 1 ? "selected" : ""} onClick={() => setSurvey({ ...survey, likert: survey.likert.map((value, index) => index === questionIndex ? optionIndex + 1 : value) })}>{label}</button>)}</div></div>
          ))}</div>
          <div className="barrier-field"><b>6. 현업 적용을 어렵게 한 요인 (복수 선택)</b><p className="theory-caption">전이이론(Baldwin & Ford, 1988)의 업무환경 요인 진단 문항입니다.</p><div>{transferBarriers.map((barrier) => <button key={barrier} className={survey.barriers.includes(barrier) ? "selected" : ""} onClick={() => setSurvey({ ...survey, barriers: survey.barriers.includes(barrier) ? survey.barriers.filter((item) => item !== barrier) : [...survey.barriers, barrier] })}>{barrier}</button>)}</div></div>
          <label className="field"><span>7. 배운 것 중 실제로 업무에 적용한 구체적인 사례를 적어 주세요.</span><textarea value={survey.applied} onChange={(e) => setSurvey({ ...survey, applied: e.target.value })} placeholder="예: 보고 두괄식을 매일 적용 중입니다." /></label>
          <label className="field"><span>8. 적용하면서 겪은 어려움이나 조직에 바라는 지원을 적어 주세요.</span><textarea value={survey.support} onChange={(e) => setSurvey({ ...survey, support: e.target.value })} placeholder="예: 실제 사례로 더 연습할 기회가 필요해요." /></label>
          <PanelActions onBack={() => setView("home")} onSave={saveSurvey} saveLabel="응답 완료하기" />
        </ActionPanel>
      )}
      {view === "mission" && (
        <ActionPanel title="나의 현업 미션" eyebrow="전이 관리">
          {course.missions.filter((m) => m.participantId === participantId).map((m) => {
            const checkpoints = m.missionCheckpoints || createMissionCheckpoints();
            const completed = checkpoints.filter((checkpoint) => checkpoint.status === "completed").length;
            const displayMissionText = m.missionText && m.missionText !== DEFAULT_TRANSFER_MISSION ? m.missionText : currentMissionText;
            return <div className="mission-item" key={m.id}>
              <span>{m.status === "done" ? "완료" : "진행 중"}</span><h3>{displayMissionText}</h3><MissionElementBadges missionText={displayMissionText} /><p className="theory-caption">좋은 행동계획의 3요소(언제·무엇을·어떻게)를 갖추도록 설계됩니다.</p><p>현업 미션 진행률 {completed}/{checkpoints.length}</p>
              <div className="checkpoint-progress"><i style={{ width: `${completed / checkpoints.length * 100}%` }} /></div>
              <div className="mission-checkpoints">{checkpoints.map((checkpoint) => <article key={checkpoint.week} className={checkpoint.status}>
                <div><b>{checkpoint.status === "completed" ? "✓" : "□"} {checkpoint.label}</b><span>{checkpoint.status === "completed" ? "완료" : "대기"}</span></div>
                {checkpoint.response && <p>{checkpoint.response}</p>}
                {checkpoint.status !== "completed" && checkpoint.week < 8 && <>
                  <textarea value={checkpointResponses[`${m.id}-${checkpoint.week}`] || ""} onChange={(e) => setCheckpointResponses({ ...checkpointResponses, [`${m.id}-${checkpoint.week}`]: e.target.value })} placeholder={checkpoint.week === 2 ? "실천한 행동과 결과를 적어주세요." : "실천하면서 어려웠던 점을 적어주세요."} />
                  <button className="secondary" onClick={() => completeCheckpoint(m.id, checkpoint.week)}>시연용 체크 완료</button>
                </>}
                {checkpoint.status !== "completed" && checkpoint.week === 8 && <small>교육 2개월 후 현업활용도 제출 시 자동 완료됩니다.</small>}
              </article>)}</div>
            </div>;
          })}
          <PanelActions onBack={() => setView("home")} />
        </ActionPanel>
      )}
      <PrivacyFooter />
    </main>
  );
}

function StudentTodayTasks({ phase, stage, activeRound, boardRounds, boardComplete, roleplayEnabled, roleplayComplete, jobReflection, reflectionComplete, olympics, onAction }) {
  const stageTitles = {
    before: "입교 전 확인",
    active: "교육 중 참여",
    completion: "수료 성찰",
    followupWait: "교육 후 현업활용 준비",
    transfer: "교육 후 현업활용 확인",
  };
  const tasks = phase === "before"
    ? [{ label: "나의 교육 목표 작성하기", done: stage !== "goal", action: "goal", button: "작성하기" }]
    : phase === "active"
      ? [
        ...(activeRound ? [{ label: "강사의 질문에 답변하기", done: false, action: "poll", button: "답변하기" }] : []),
        ...(boardRounds.length ? [{ label: "팀 장표 업로드하기", done: boardComplete, button: "업로드하기" }] : []),
        ...(olympics ? [{ label: "농협올림픽 활동 참여하기", done: false, external: true, button: "참여하기" }] : []),
        ...(roleplayEnabled ? [{ label: "보고훈련 참여하기", done: roleplayComplete, action: "roleplay", button: "참여하기" }] : []),
        ...(jobReflection ? [{ label: "오늘의 직무강의 회고 작성하기", done: reflectionComplete, button: "작성하기" }] : []),
      ]
      : phase === "completion"
        ? [{ label: "목표 달성도와 수료 성찰 작성하기", done: stage !== "achievement", action: "achievement", button: "작성하기" }]
        : phase === "transfer"
          ? [{ label: "현업활용도 조사 작성하기", done: stage !== "survey", action: "survey", button: "작성하기" }]
          : [];
  return (
    <section className="today-tasks-card">
      <div><span className="eyebrow">지금 먼저 확인하세요</span><h2>{stageTitles[phase] || "단계별 참여"}</h2></div>
      {phase === "before" && <p className="before-class-note">반 배정은 교육 시작 후 선택합니다. 입교 전 목표는 반 선택 없이 작성할 수 있습니다.</p>}
      {!tasks.length && <p className="before-class-note">현재 단계에서 바로 작성할 항목은 없습니다.</p>}
      <div className="today-task-list">{tasks.map((task) => <article key={task.label} className={task.done ? "done" : ""}>
        <span>{task.done ? "✓ 완료" : "● 미완료"}</span><b>{task.label}</b>
        {!task.done && task.external
          ? <a href="https://nh-olympic.netlify.app/" target="_blank" rel="noreferrer">{task.button}</a>
          : !task.done && <button onClick={() => task.action ? onAction(task.action) : document.getElementById("current-activity")?.scrollIntoView({ behavior: "smooth" })}>{task.button}</button>}
      </article>)}</div>
    </section>
  );
}

function StudentGoalCard({ goal, onWrite, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = compact ? "goal-detail-compact" : "goal-detail-full";
  return (
    <section className={`goal-card ${goal ? "completed-goal" : ""} ${compact ? "compact-goal" : ""} ${expanded ? "expanded" : ""}`}>
      <div className="goal-icon">◎</div>
      <div className="goal-card-content" id={goal ? detailId : undefined}>{goal ? <>
        <div><span>나의 교육 목표</span><p>{goal.goalText || goal.text}</p></div>
        <div><span>교육 중 집중 포인트</span><p>{goal.focusPoint || "핵심 개념을 현장 사례와 연결하는 방법에 집중하기"}</p></div>
        <div><span>현업 행동 미션</span><p>{goal.actionMission || "배운 내용을 현업에서 1회 실천하고 결과를 기록하기"}</p></div>
      </> : <><span>나의 이번 교육 목표</span><p className="muted">아직 목표를 작성하지 않았어요.</p></>}</div>
      {!goal ? <button onClick={onWrite}>작성</button> : <button className="goal-summary-toggle" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded((value) => !value)}>{expanded ? "접기" : "더보기"}</button>}
    </section>
  );
}

function StudentStampCard({ stamps, student }) {
  const [expanded, setExpanded] = useState(false);
  const counts = stampCounts(stamps, student?.id, student?.name);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const recent = [...stamps].filter((item) => item.status === "active" && (student?.id ? item.participantId === student.id : item.studentName === student?.name)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
  return (
    <section className={`student-stamp-card ${expanded ? "expanded" : ""}`}>
      <div className="stamp-card-head">
        <div><span>통합 농협이념과정</span><h2>나의 스탬프 카드</h2><p>교육 과정 중 받은 스탬프를 확인할 수 있습니다.</p></div>
        <strong>총 {total}개</strong>
      </div>
      <div className="mobile-stamp-recent">{recent.length ? recent.map((item) => <span key={item.id}>{item.stampIcon} {item.stampLabel.replace(" 스탬프", "")} × {item.count}</span>) : <span>아직 받은 스탬프가 없습니다.</span>}</div>
      <div className="stamp-seal-grid" id="student-stamp-seal-grid">
        {STAMP_TYPES.map((stamp) => {
          const count = counts[stamp.type] || 0;
          return <article key={stamp.type} className={count ? "stamped" : "empty"} title={stamp.meaning}><div>{stamp.icon}</div><b>{stamp.shortLabel}</b><span>× {count}</span></article>;
        })}
      </div>
      <button className="secondary mobile-stamp-toggle" aria-expanded={expanded} aria-controls="student-stamp-seal-grid" onClick={() => setExpanded((value) => !value)}>{expanded ? "카드 접기" : "카드 펼쳐보기"}</button>
      <small>참여와 협동, 성찰과 실천의 순간이 한 장의 카드에 쌓입니다.</small>
    </section>
  );
}

function collectCourseStudents(course) {
  const sources = [
    ...(course.participants || []),
    ...(course.goals || []).map((item) => ({ id: item.participantId, name: item.name, classId: item.classId, className: item.className })),
    ...(course.achievements || []).map((item) => ({ id: item.participantId, name: item.name, classId: item.classId, className: item.className })),
    ...(course.surveys || []).map((item) => ({ id: item.participantId, name: item.name, classId: item.classId, className: item.className })),
  ];
  return [...new Map(sources.filter((item) => item.name).map((item) => {
    const classId = item.classId || "class-1";
    return [`${item.participantId || item.id || item.name}:${classId}`, {
      ...item,
      id: item.participantId || item.id || `name:${item.name}`,
      participantId: item.participantId || item.id,
      name: item.name || item.studentName,
      classId,
      className: item.className || "1반",
    }];
  })).values()];
}

function ProfessorStampManager({ course, stamps, setStamps, notify }) {
  const [stampTab, setStampTab] = useState("give");
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [stampType, setStampType] = useState(STAMP_TYPES[0].type);
  const [count, setCount] = useState(1);
  const [memo, setMemo] = useState("");
  const students = collectCourseStudents(course);
  const visibleStudents = students.filter((student) => (classFilter === "all" || student.classId === classFilter) && (!search.trim() || student.name.includes(search.trim())));
  const selectedStudent = students.find((student) => `${student.id}:${student.classId}` === selectedStudentId);
  const activeStamp = STAMP_TYPES.find((item) => item.type === stampType) || STAMP_TYPES[0];
  const rankingStudents = classFilter === "all" ? students : students.filter((student) => student.classId === classFilter);
  const ranking = buildStampRanking(stamps, rankingStudents);
  const history = [...stamps].filter((item) => classFilter === "all" || item.classId === classFilter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const giveStamp = () => {
    if (!selectedStudent) return notify("스탬프를 받을 교육생을 선택해주세요.");
    if (!window.confirm(`${selectedStudent.name} 교육생에게 ${activeStamp.shortLabel} 스탬프 ${count}개를 지급하시겠습니까?`)) return;
    const record = {
      id: uid("stamp"),
      courseId: course.code,
      participantId: selectedStudent.id,
      classId: selectedStudent.classId || "class-1",
      className: selectedStudent.className || "1반",
      studentName: selectedStudent.name,
      stampType: activeStamp.type,
      stampLabel: activeStamp.label,
      stampIcon: activeStamp.icon,
      count,
      memo: memo.trim(),
      givenBy: "교수요원",
      status: "active",
      createdAt: now(),
    };
    setStamps((items) => [...items, record]);
    setMemo("");
    notify(`${selectedStudent.name} 교육생에게 ${activeStamp.shortLabel} 스탬프 ${count}개를 지급했습니다.`);
  };

  const cancelStamp = (record) => {
    if (!window.confirm(`${record.studentName} 교육생의 ${record.stampLabel} 지급을 취소할까요?`)) return;
    setStamps((items) => items.map((item) => item.id === record.id ? { ...item, status: "cancelled", cancelledAt: now() } : item));
    notify("스탬프 지급을 취소했습니다.");
  };

  return (
    <section className="content-card stamp-manager">
      <SectionTitle eyebrow="통합 농협이념과정 전용" title="스탬프 관리" />
      <div className="stamp-manager-tabs">
        {[["give", "스탬프 지급"], ["ranking", "전체 순위"], ["history", "지급 이력"]].map(([id, label]) => <button key={id} className={stampTab === id ? "active" : ""} onClick={() => setStampTab(id)}>{label}</button>)}
      </div>
      <div className="stamp-class-filter">
        <button className={classFilter === "all" ? "active" : ""} onClick={() => { setClassFilter("all"); setSelectedStudentId(""); }}>전체</button>
        {course.classes.map((item) => <button key={item.id} className={classFilter === item.id ? "active" : ""} onClick={() => { setClassFilter(item.id); setSelectedStudentId(""); }}>{item.name}</button>)}
      </div>

      {stampTab === "give" && <div className="stamp-give-layout">
        <div className="stamp-student-picker">
          <label className="field"><span>교육생 검색</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 검색" /></label>
          <div>{visibleStudents.map((student) => {
            const key = `${student.id}:${student.classId}`;
            return <button key={key} className={selectedStudentId === key ? "selected" : ""} onClick={() => setSelectedStudentId(key)}><b>{student.name}</b><span>{student.className}</span></button>;
          })}</div>
          {!visibleStudents.length && <div className="board-empty">현재 조건에 맞는 교육생이 없습니다. 교육생이 과정에 한 번 입장하면 목록에 표시됩니다.</div>}
        </div>
        <div className="stamp-give-form">
          <h3>스탬프 선택</h3>
          <div className="stamp-type-picker">{STAMP_TYPES.map((stamp) => <button key={stamp.type} className={stampType === stamp.type ? "selected" : ""} onClick={() => setStampType(stamp.type)}><span>{stamp.icon}</span><b>{stamp.shortLabel}</b></button>)}</div>
          <div className="stamp-count-picker"><span>지급 개수</span>{[1, 2, 3].map((value) => <button key={value} className={count === value ? "selected" : ""} onClick={() => setCount(value)}>{value}개</button>)}</div>
          <label className="field"><span>메모 <small>선택사항</small></span><input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="예: 팀 활동에서 역할을 잘 수행함" /></label>
          <button className="primary large" onClick={giveStamp}>스탬프 지급</button>
        </div>
      </div>}

      {stampTab === "ranking" && <div className="stamp-ranking">
        <div className="stamp-ranking-head"><span>순위는 총 스탬프 수를 우선하며 올림픽·협동·성찰 순으로 동률을 정리합니다.</span></div>
        <div className="stamp-ranking-table">
          <div className="stamp-ranking-row header"><b>순위</b><b>교육생</b><b>반</b>{STAMP_TYPES.map((stamp) => <b key={stamp.type}>{stamp.icon}</b>)}<b>총계</b></div>
          {ranking.map((student) => <div className="stamp-ranking-row" key={`${student.id}:${student.classId}`}><strong>{student.rank}</strong><span>{student.name}</span><span>{student.className}</span>{STAMP_TYPES.map((stamp) => <span key={stamp.type}>{student.counts[stamp.type]}</span>)}<strong>{student.total}</strong></div>)}
        </div>
        {!ranking.length && <div className="board-empty">순위를 표시할 교육생이 없습니다.</div>}
      </div>}

      {stampTab === "history" && <details className="stamp-history mobile-details">
        <summary>지급 이력 {history.length}건 보기</summary>
        {history.map((record) => <article key={record.id} className={record.status === "cancelled" ? "cancelled" : ""}>
          <div className="stamp-history-icon">{record.stampIcon}</div>
          <div><b>{record.studentName} · {record.className}</b><p>{record.stampLabel} {record.count}개{record.memo ? ` · ${record.memo}` : ""}</p><span>{new Date(record.createdAt).toLocaleString("ko-KR")}{record.status === "cancelled" ? " · 취소됨" : ""}</span></div>
          {record.status === "active" && <button className="danger-button compact" onClick={() => cancelStamp(record)}>취소</button>}
        </article>)}
        {!history.length && <div className="board-empty">스탬프 지급 이력이 없습니다.</div>}
      </details>}
    </section>
  );
}

function StudentMissionCard({ mission, completed, onAction }) {
  return (
    <section className={`mission-card ${completed ? "complete" : ""}`}>
      <div className="mission-top"><span className="eyebrow">개인 활동</span><span className="status-pill">{completed ? "✓ 완료" : "● 미완료"}</span></div>
      <h2>{mission.title}</h2>
      <p>{mission.desc}</p>
      {mission.cta && <button className="primary large" onClick={onAction}>{mission.cta}<span>→</span></button>}
    </section>
  );
}

function StudentReentryCard({ course, student, phase, onOpenSurvey }) {
  if (!student?.participantCode && !student?.reentryToken) return null;
  return (
    <section className="reentry-card">
      <div>
        <span className="eyebrow">2개월 후 현업활용도 조사 안내</span>
        <h3>알림으로 다시 안내됩니다</h3>
        <p>향후 알림 기능이 연결되면, 교육 종료 2개월 후 과정코드와 접속 링크가 함께 안내됩니다.</p>
        <p>응답 내용은 실명으로 공개되지 않으며, 제출 여부만 재안내와 중복 응답 방지를 위해 확인될 수 있습니다.</p>
        <p className="demo-compression-note">실제 서비스에서는 교육종료일 +2개월에 예약 발송됩니다. 본 화면은 시연을 위해 10초로 압축한 데모입니다.</p>
        <p>현재 화면의 정보는 확인용입니다. 별도로 외우거나 저장하지 않아도 됩니다.</p>
        <small>과정코드: {course.code} · 이름: {student.name || student.studentName}</small>
        {phase === "transfer" && (
          <button className="secondary compact followup-demo-link" onClick={onOpenSurvey}>현업활용도 조사로 이동</button>
        )}
      </div>
    </section>
  );
}

function StudentPhaseTabs({ phase, selected, transferDate, onSelect }) {
  const tabs = [
    ["before", "입교 전", "교육 시작일 이전"],
    ["active", "교육 중", "시작일~종료일 전날"],
    ["completion", "수료일", "교육 종료일 당일"],
    ["transfer", "교육 후", `${transferDate}부터`],
  ];
  return (
    <section className="student-phase-tabs" aria-label="교육 단계">
      {tabs.map(([id, label, description]) => {
        const enabled = id === phase;
        return (
          <button
            key={id}
            className={`${selected === id ? "selected" : ""} ${enabled ? "enabled" : "locked"}`}
            onClick={() => onSelect(id)}
            aria-disabled={!enabled}
          >
            <span>{enabled ? "● 활성" : "🔒 잠김"}</span>
            <b>{label}</b>
            <small>{description}</small>
          </button>
        );
      })}
    </section>
  );
}

function StudentJobReflection({ course, setCourse, student, notify }) {
  const participantId = student?.id || "student-demo";
  const participantName = student?.name || "교육생";
  const classId = student?.classId || "class-1";
  const className = student?.className || "1반";
  const date = todayInKorea();
  const sessions = (course.jobSessions || []).filter((session) => session.date === date && session.classId === classId).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const mine = (course.jobReflections || []).find((item) => item.participantId === participantId && item.date === date);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    bestSessionId: "",
    bestReason: "",
    bestReasonEtc: "",
    improvementSessionId: "",
    improvementReason: "",
    improvementReasonEtc: "",
    workApplicationPoint: "",
  });
  const save = () => {
    if (!form.bestSessionId || !form.bestReason) return notify("현업에 가장 도움이 된 강의와 이유를 선택해주세요.");
    if (form.bestReason === "기타" && !form.bestReasonEtc.trim()) return notify("도움이 된 기타 이유를 입력해주세요.");
    if (!form.improvementSessionId) return notify("보완이 필요한 강의를 선택해주세요. 해당 없으면 ‘없음’을 선택하세요.");
    if (form.improvementSessionId !== "none" && !form.improvementReason) return notify("보완이 필요하다고 느낀 이유를 선택해주세요.");
    if (form.improvementReason === "기타" && !form.improvementReasonEtc.trim()) return notify("보완이 필요한 기타 이유를 입력해주세요.");
    if (!form.workApplicationPoint.trim()) return notify("내 업무에 가져갈 한 가지를 입력해주세요.");
    setCourse((current) => ({
      ...current,
      jobReflections: [...(current.jobReflections || []), {
        id: uid("job-reflection"),
        courseId: current.code,
        participantId,
        studentName: participantName,
        classId,
        className,
        date,
        bestSessionId: form.bestSessionId,
        bestReason: form.bestReason,
        bestReasonEtc: form.bestReason === "기타" ? form.bestReasonEtc.trim() : null,
        improvementSessionId: form.improvementSessionId === "none" ? null : form.improvementSessionId,
        improvementReason: form.improvementSessionId === "none" ? null : form.improvementReason,
        improvementReasonEtc: form.improvementReason === "기타" ? form.improvementReasonEtc.trim() : null,
        workApplicationPoint: form.workApplicationPoint.trim(),
        createdAt: now(),
      }],
    }));
    notify("오늘의 직무강의 회고를 저장했습니다.");
  };
  const sessionTitle = (id) => sessions.find((session) => session.id === id)?.title || "-";
  const bestReasonLabel = form.bestReason === "기타" ? form.bestReasonEtc : form.bestReason;
  const improvementReasonLabel = form.improvementReason === "기타" ? form.improvementReasonEtc : form.improvementReason;
  const nextStep = () => {
    if (step === 1 && !form.bestSessionId) return notify("현업에 가장 도움이 된 강의를 선택해주세요.");
    if (step === 2 && !form.bestReason) return notify("도움이 된 이유를 선택해주세요.");
    if (step === 2 && form.bestReason === "기타" && !form.bestReasonEtc.trim()) return notify("도움이 된 기타 이유를 입력해주세요.");
    if (step === 3 && !form.improvementSessionId) return notify("보완이 필요한 강의를 선택해주세요. 해당 없으면 ‘없음’을 선택하세요.");
    if (step === 4 && !form.improvementReason) return notify("보완이 필요하다고 느낀 이유를 선택해주세요.");
    if (step === 4 && form.improvementReason === "기타" && !form.improvementReasonEtc.trim()) return notify("보완이 필요한 기타 이유를 입력해주세요.");
    if (step === 5 && !form.workApplicationPoint.trim()) return notify("내 업무에 가져갈 한 가지를 입력해주세요.");
    if (step === 3 && form.improvementSessionId === "none") return setStep(5);
    setStep((current) => Math.min(6, current + 1));
  };
  const previousStep = () => {
    if (step === 5 && form.improvementSessionId === "none") return setStep(3);
    setStep((current) => Math.max(1, current - 1));
  };
  return (
    <section id="current-activity" className="student-board-area job-reflection">
      <div className="section-title"><div><span className="eyebrow">과정 개선을 위한 회고</span><h2>오늘의 직무강의 회고</h2></div></div>
      <p className="job-reflection-desc">오늘 들은 강의 중 현업에 바로 쓸 수 있는 내용과 보완이 필요한 부분을 짧게 남겨 주세요. 개별 자료 요청이 아니라 다음 기수와 과정 개선을 위한 회고입니다.</p>
      {!sessions.length ? <div className="board-empty">교수요원이 오늘 강의 목록을 등록하면 회고를 작성할 수 있습니다.</div> : mine ? (
        <div className="learning-check-complete"><b>✓ 오늘 회고 완료</b><p>{mine.workApplicationPoint}</p><span>오늘은 한 번만 제출할 수 있습니다.</span></div>
      ) : (
        <div className="job-reflection-wizard">
          <div className="job-wizard-progress">
            <div><b>{step} / 6</b><span>{step === 6 ? "제출 전 확인" : "오늘의 회고 작성 중"}</span></div>
            <i><em style={{ width: `${step / 6 * 100}%` }} /></i>
          </div>
          <div className="job-reflection-step">
            {step === 1 && <JobChoiceField number="1" title="오늘 들은 강의 중 현업에 가장 도움이 된 강의는 무엇인가요?" options={sessions.map((session) => ({ value: session.id, label: session.title }))} value={form.bestSessionId} onChange={(value) => setForm({ ...form, bestSessionId: value })} />}
            {step === 2 && <>
              <JobChoiceField number="2" title="그 강의가 도움이 된 이유는 무엇인가요?" options={bestReasonOptions.map((reason) => ({ value: reason, label: reason }))} value={form.bestReason} onChange={(value) => setForm({ ...form, bestReason: value, bestReasonEtc: value === "기타" ? form.bestReasonEtc : "" })} />
              {form.bestReason === "기타" && <input value={form.bestReasonEtc} onChange={(e) => setForm({ ...form, bestReasonEtc: e.target.value })} placeholder="기타 이유를 한 줄로 적어주세요." />}
            </>}
            {step === 3 && <JobChoiceField number="3" title="오늘 들은 강의 중 보완이 필요하다고 느낀 강의는 무엇인가요?" options={[{ value: "none", label: "없음" }, ...sessions.map((session) => ({ value: session.id, label: session.title }))]} value={form.improvementSessionId} onChange={(value) => setForm({ ...form, improvementSessionId: value, improvementReason: value === "none" ? "" : form.improvementReason, improvementReasonEtc: value === "none" ? "" : form.improvementReasonEtc })} />}
            {step === 4 && <>
              <JobChoiceField number="4" title="보완이 필요하다고 느낀 이유는 무엇인가요?" options={improvementReasonOptions.map((reason) => ({ value: reason, label: reason }))} value={form.improvementReason} onChange={(value) => setForm({ ...form, improvementReason: value, improvementReasonEtc: value === "기타" ? form.improvementReasonEtc : "" })} />
              {form.improvementReason === "기타" && <input value={form.improvementReasonEtc} onChange={(e) => setForm({ ...form, improvementReasonEtc: e.target.value })} placeholder="기타 이유를 한 줄로 적어주세요." />}
            </>}
            {step === 5 && <label className="field job-application-field"><span>5. 오늘 배운 것 중 내 업무에 가져갈 한 가지는 무엇인가요?</span><input value={form.workApplicationPoint} onChange={(e) => setForm({ ...form, workApplicationPoint: e.target.value })} placeholder="예: 계약서 확인 시 특약사항을 먼저 확인하겠다." /></label>}
            {step === 6 && <div className="job-reflection-review">
              <span className="eyebrow">제출 전 요약 확인</span>
              <h3>작성한 회고를 확인해주세요.</h3>
              <dl>
                <div><dt>현업에 가장 도움 된 강의</dt><dd>{sessionTitle(form.bestSessionId)}</dd></div>
                <div><dt>도움이 된 이유</dt><dd>{bestReasonLabel}</dd></div>
                <div><dt>보완이 필요한 강의</dt><dd>{form.improvementSessionId === "none" ? "없음" : sessionTitle(form.improvementSessionId)}</dd></div>
                <div><dt>보완 이유</dt><dd>{form.improvementSessionId === "none" ? "해당 없음" : improvementReasonLabel}</dd></div>
                <div><dt>내 업무 적용 한 줄</dt><dd>{form.workApplicationPoint}</dd></div>
              </dl>
            </div>}
          </div>
          <div className="job-wizard-actions">
            <button className="secondary" onClick={previousStep} disabled={step === 1}>이전</button>
            {step < 6 ? <button className="primary" onClick={nextStep}>다음</button> : <button className="primary" onClick={save}>오늘 회고 제출</button>}
          </div>
        </div>
      )}
    </section>
  );
}

function JobChoiceField({ number, title, options, value, onChange }) {
  return <fieldset className="job-choice-field"><legend>{number}. {title}</legend><div>{options.map((option) => <button type="button" key={option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></fieldset>;
}

function resizeImageFile(file, maxSize = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.onload = () => {
      const originalDataUrl = reader.result;
      const image = new Image();
      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      image.onload = () => {
        try {
          const { naturalWidth: width, naturalHeight: height } = image;
          if (!width || !height) return reject(new Error("이미지 크기를 확인하지 못했습니다."));
          if (Math.max(width, height) <= maxSize) return resolve(originalDataUrl);
          const ratio = maxSize / Math.max(width, height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("이미지 변환을 준비하지 못했습니다."));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (error) {
          reject(error);
        }
      };
      image.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function StudentBoardArea({ rounds, setCourse, student, notify }) {
  const participantId = student?.id || "student-demo";
  const classId = student?.classId || "class-1";
  const className = student?.className || "1반";
  const [teamNames, setTeamNames] = useState({});
  const upload = async (round, file) => {
    if (!file) return;
    const team = (teamNames[round.id] || "").trim();
    if (!team) return notify("팀명을 먼저 입력해주세요.");
    try {
      const imageUrl = await resizeImageFile(file);
      setCourse((current) => ({
        ...current,
        rounds: current.rounds.map((item) => item.id === round.id ? {
          ...item,
          items: [...item.items, {
            id: uid("board"),
            participantId,
            by: team,
            classId,
            className,
            imageUrl,
            text: `${team} 장표 업로드`,
            reactions: {},
            createdAt: now(),
          }],
        } : item),
      }));
      notify(`${round.prompt}에 ${team} 장표를 업로드했습니다.`);
    } catch {
      notify("이미지 저장 중 문제가 발생했습니다. 사진 크기를 줄이거나 다시 선택해주세요.");
    }
  };
  if (!rounds.length) return null;
  return (
    <section id="current-activity" className="student-board-area">
      <div className="section-title">
        <div><span className="eyebrow">팀 활동</span><h2>모듈별 장표 업로드</h2></div>
      </div>
      <div className="student-board-modules">
        {rounds.map((round) => {
          const mine = round.items.find((item) => item.participantId === participantId);
          return (
            <article key={round.id}>
              <div><span>{mine ? "✓ 업로드 완료" : "업로드 대기"}</span><h3>{round.prompt}</h3><p>{round.description || "팀 장표를 사진으로 촬영해 제출해주세요."}</p></div>
              {!mine ? <>
                <input value={teamNames[round.id] || ""} onChange={(e) => setTeamNames({ ...teamNames, [round.id]: e.target.value })} placeholder="팀명" />
                <label className="secondary board-file-button">장표 사진 선택<input type="file" accept="image/*" onChange={(e) => upload(round, e.target.files?.[0])} /></label>
              </> : mine.imageUrl && <img src={mine.imageUrl} alt={`${mine.by} 장표`} />}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PageBack({ onClick }) {
  return <button className="page-back" onClick={onClick} aria-label="이전 화면으로 돌아가기">← 바로 이전</button>;
}

function ProfessorApp({ course, setCourse, courses, ideologyStamps, setIdeologyStamps, onSelectCourse, onUpdateCourse, onDeleteCourse, initialTab, onExit, notify }) {
  const [tab, setTab] = useState(initialTab || "dashboard");
  const [selectedClassFilter, setSelectedClassFilter] = useState(course.classes?.[0]?.id || "class-1");
  const [analysis, setAnalysis] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(course.roleplayConfig?.scenario || "민원 발생 보고");
  const [difficulty, setDifficulty] = useState(course.roleplayConfig?.difficulty || "보통");
  const [pushStatus, setPushStatus] = useState("idle");
  const [questionDraft, setQuestionDraft] = useState({ type: "subjective", intent: "general", prompt: "", options: ["", ""], anonymous: false });
  const [boardModule, setBoardModule] = useState({ title: "" });
  const [selectedBoardRound, setSelectedBoardRound] = useState("");
  const [expandedBoard, setExpandedBoard] = useState(null);
  const [boardAnalysis, setBoardAnalysis] = useState(null);
  const [newCourse, setNewCourse] = useState({
    type: "ideology",
    name: "",
    leadershipGrade: "M급",
    classCount: 1,
    startDate: todayInKorea(),
    endDate: todayInKorea(),
  });
  const [issuedCode, setIssuedCode] = useState("");
  const pushTimer = useRef(null);
  const filteredCourse = filterCourseByClass(course, selectedClassFilter);
  const filteredParticipantCount = participantCountForClass(course, selectedClassFilter);
  const phase = getCoursePhase(course);
  const showProfessorOlympicsLink = course.type === "ideology"
    && phase === "active"
    && course.olympicActivityOpen === true
    && ["dashboard", "stamps"].includes(tab);

  useEffect(() => {
    if (course.type !== "newbie" && tab === "roleplay") setTab("dashboard");
  }, [course.type, tab]);

  useEffect(() => {
    setSelectedScenario(course.roleplayConfig?.scenario || "민원 발생 보고");
    setDifficulty(course.roleplayConfig?.difficulty || "보통");
  }, [course.code, course.roleplayConfig?.scenario, course.roleplayConfig?.difficulty]);

  useEffect(() => {
    setSelectedClassFilter(course.classes?.[0]?.id || "class-1");
    setAnalysis(null);
  }, [course.code]);
  const selectedClass = course.classes.find((item) => item.id === selectedClassFilter) || course.classes[0];

  const navigate = (target) => setTab(target);
  const runAnalysis = (kind = "all") => {
    setAnalysis(buildAnalysis(filteredCourse, kind));
    notify("제공된 응답만 근거로 AI 분석을 생성했습니다.");
  };

  const react = (roundId, itemId, key) => {
    setCourse((c) => ({
      ...c,
      rounds: c.rounds.map((round) => round.id === roundId ? {
        ...round,
        items: round.items.map((item) => item.id === itemId ? { ...item, reactions: { ...item.reactions, [key]: (item.reactions?.[key] || 0) + 1 } } : item),
      } : round),
    }));
  };

  const createQuestion = () => {
    if (!questionDraft.prompt.trim()) return notify("질문 내용을 입력해주세요.");
    const options = questionDraft.options.map((item) => item.trim()).filter(Boolean);
    if (questionDraft.type === "objective" && options.length < 2) return notify("객관식 항목을 2개 이상 입력해주세요.");
    setCourse((c) => ({
      ...c,
      rounds: [...c.rounds, {
        id: uid("poll"),
        kind: "poll",
        questionType: questionDraft.type,
        questionIntent: questionDraft.intent,
        prompt: questionDraft.prompt.trim(),
        options: questionDraft.type === "objective" ? options : [],
        anonymous: questionDraft.anonymous === true,
        courseId: c.code,
        scope: "class",
        classId: selectedClass.id,
        className: selectedClass.name,
        items: [],
        createdAt: now(),
      }],
    }));
    setQuestionDraft({ type: "subjective", intent: "general", prompt: "", options: ["", ""], anonymous: false });
    notify(`${selectedClass.name} 교육생에게 실시간 질문을 열었습니다.`);
  };

  const createBoardModule = () => {
    if (!boardModule.title.trim()) return notify("장표 업로드 모듈명을 입력해주세요.");
    const created = {
      id: uid("board"),
      courseId: course.code,
      kind: "board",
      prompt: boardModule.title.trim(),
      scope: "class",
      classId: selectedClass.id,
      className: selectedClass.name,
      items: [],
      createdAt: now(),
    };
    setCourse((current) => ({ ...current, rounds: [...current.rounds, created] }));
    setSelectedBoardRound(created.id);
    setBoardModule({ title: "" });
    notify(`${selectedClass.name} 장표 업로드 탭을 생성했습니다.`);
  };

  const analyzeBoards = (round, item) => {
    const targetItems = item ? [item] : round.items;
    if (!targetItems.length) return notify("분석할 장표가 아직 없습니다.");
    setBoardAnalysis({
      scope: item ? `${item.by} 팀 장표` : `${round.prompt} 전체 장표`,
      summary: item
        ? "핵심 주장과 실행 행동이 잘 연결되어 있습니다. 발표 시 실제 현장 사례를 한 가지 덧붙이면 메시지가 더 선명해집니다."
        : "전체 팀은 신뢰, 빠른 공유, 조합원 관점을 공통으로 강조했습니다. 팀별 차이는 실행 순서와 보고 방식의 구체성에서 나타납니다.",
      common: item ? ["문제 상황의 핵심이 명료함", "실천 행동 제시"] : ["조합원 관점", "신속한 공유", "정확한 설명"],
      action: item ? "발표 후 ‘실제 현장에서 가장 어려운 단계’를 질문하세요." : "공통점이 많은 팀부터 발표하고, 차별적 해결책을 제시한 팀을 마지막에 배치하세요.",
    });
  };

  const saveRoleplaySetting = (enabled = true) => {
    setCourse((current) => ({
      ...current,
      roleplayConfig: {
        enabled,
        scenario: selectedScenario,
        difficulty,
        courseId: current.code,
        scope: "class",
        classId: selectedClass.id,
        className: selectedClass.name,
      },
    }));
    notify(enabled ? `${selectedClass.name} 교육생에게 보고 훈련을 열었습니다.` : `${selectedClass.name} 보고 훈련을 종료했습니다.`);
  };

  const startPushDemo = () => {
    clearTimeout(pushTimer.current);
    setPushStatus("waiting");
    pushTimer.current = setTimeout(() => setPushStatus("arrived"), 10000);
    notify("10초 뒤 사후조사 알림이 도착합니다.");
  };

  const openFollowupSurveyDemo = () => {
    const participant = (course.participants || [])[0];
    const followupUrl = participant?.reentryToken
      ? `${personalFollowupLink(participant.reentryToken)}#survey`
      : `/?role=student&code=${encodeURIComponent(course.code)}#survey`;
    window.location.href = followupUrl;
  };

  const registerCourse = () => {
    if (!newCourse.name.trim()) return notify("연간 기수를 구분할 과정명을 입력해주세요.");
    if (!newCourse.startDate || !newCourse.endDate) return notify("교육 시작일과 종료일을 입력해주세요.");
    if (newCourse.endDate < newCourse.startDate) return notify("종료일은 시작일보다 빠를 수 없습니다.");
    let code;
    try {
      code = generateCourseCode(newCourse.type, courses);
    } catch (error) {
      return notify(error.message);
    }
    const created = {
      ...seedCourse,
      code,
      type: newCourse.type,
      name: newCourse.name.trim(),
      cohort: "",
      leadershipGrade: newCourse.type === "leader" ? newCourse.leadershipGrade : undefined,
      classCount: newCourse.classCount,
      classes: createClasses(newCourse.classCount),
      participants: [],
      startDate: newCourse.startDate,
      endDate: newCourse.endDate,
      transferDate: addMonthsToDate(newCourse.endDate, 2),
      createdAt: now(),
      templateId: `${newCourse.type}-v3`,
      goals: [],
      achievements: [],
      rounds: [],
      learningChecks: [],
      legacyJobChecks: [],
      jobSessions: [],
      jobReflections: [],
      roleplayConfig: { enabled: false, scenario: "민원 발생 보고", difficulty: "보통" },
      roleplaySessions: [],
      reportTrainings: [],
      surveys: [],
      missions: [],
      olympicActivityOpen: false,
    };
    setCourse(created);
    setIssuedCode(code);
    setNewCourse((current) => ({ ...current, name: "" }));
    notify(`${code} 과정 코드가 발급되었습니다.`);
  };

  const professorTabs = [
    ["dashboard", "관제판"], ["goals", "목표"], ["live", "실시간 질문"], ["board", course.type === "job" ? "직무강의 회고" : "팀 장표"],
    ...(course.type === "ideology" ? [["stamps", "스탬프 관리"]] : []),
    ...(course.type === "newbie" ? [["roleplay", "보고 훈련"]] : []),
    ["ai", "AI 분석"],
    ["transfer", "전이·리포트"],
  ];

  return (
    <>
      {tab !== "create" && <nav className="prof-nav">
        {professorTabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </nav>}
      <main className="page professor-page">
        <PageBack onClick={() => tab === "create" || tab === "dashboard" ? onExit() : setTab("dashboard")} />
        {tab !== "create" && <section className="prof-course-head">
          <div>
            <span className="eyebrow">교수요원 과정 운영</span>
            <div className="course-title-row">
              <h1>{course.name}</h1>
              {showProfessorOlympicsLink && <OlympicsLink />}
            </div>
            <p>{courseTypes[course.type]}{course.leadershipGrade ? ` · ${course.leadershipGrade}` : ""}{course.cohort ? ` · ${course.cohort}` : ""} · {course.startDate} ~ {course.endDate}</p>
          </div>
          <div className="course-head-actions"><span className={`phase-badge ${phase}`}>{({ before: "입교 전", active: "교육 중", completion: "수료일", followupWait: "현업 적용 대기", transfer: "교육 후" })[phase]}</span></div>
        </section>}
        {tab !== "create" && (course.classCount || 1) > 1 && <ClassFilterTabs classes={course.classes} value={selectedClassFilter} onChange={(value) => { setSelectedClassFilter(value); setAnalysis(null); }} />}
        {tab === "create" && <CourseRegistrationForm value={newCourse} onChange={setNewCourse} onSubmit={registerCourse} issuedCode={issuedCode} course={course} courses={courses} onSelectCourse={(selected) => { onSelectCourse(selected); setTab("dashboard"); }} onUpdateCourse={onUpdateCourse} onDeleteCourse={onDeleteCourse} notify={notify} />}
        {tab === "dashboard" && <>
          {course.type === "ideology" && phase === "active" && <OlympicActivityControl course={course} setCourse={setCourse} />}
          <OverallCourseSummary course={course} />
          <ProfessorDashboard course={{ ...filteredCourse, participantCount: filteredParticipantCount }} onNavigate={navigate} onAnalyze={() => { runAnalysis(); setTab("ai"); }} />
        </>}
        {tab === "goals" && <DataList title="입교 전 목표" items={filteredCourse.goals} onAnalyze={() => { runAnalysis("goals"); setTab("ai"); }} />}
        {tab === "live" && (
          <section className="content-card">
            <SectionTitle eyebrow="실시간 참여" title="교육생 질문 생성과 응답 현황" action={<button className="primary compact" onClick={() => { runAnalysis("poll"); setTab("ai"); }}>AI로 묶기</button>} />
            <CurrentClassNotice className={selectedClass.name} action="질문이 개설됩니다." />
            <QuestionComposer value={questionDraft} onChange={setQuestionDraft} onSubmit={createQuestion} />
            {filteredCourse.rounds.filter((r) => r.kind === "poll").map((round) => <RoundView key={round.id} round={round} onReact={react} />)}
          </section>
        )}
        {tab === "board" && (
          <section className="content-card">
            {course.type === "job" ? <ProfessorJobReflection course={course} setCourse={setCourse} notify={notify} classFilter={selectedClassFilter} participantCount={filteredParticipantCount} /> : <>
              <SectionTitle eyebrow="팀 학습" title="모듈별 장표 발표·AI 분석" />
              <CurrentClassNotice className={selectedClass.name} action="장표 모듈이 개설됩니다." />
              <BoardModuleCreator value={boardModule} onChange={setBoardModule} onSubmit={createBoardModule} />
              <ProfessorBoardGallery
                rounds={filteredCourse.rounds.filter((round) => round.kind === "board")}
                selectedId={selectedBoardRound}
                onSelect={setSelectedBoardRound}
                onExpand={setExpandedBoard}
                onAnalyze={analyzeBoards}
                analysis={boardAnalysis}
              />
            </>}
          </section>
        )}
        {tab === "stamps" && course.type === "ideology" && <ProfessorStampManager course={course} stamps={ideologyStamps.filter((item) => item.courseId === course.code)} setStamps={setIdeologyStamps} notify={notify} />}
        {tab === "ai" && (
          <section className="content-card">
            <SectionTitle eyebrow="근거 기반 분석" title={`AI 교육 분석 리포트 · ${selectedClass.name}`} action={<button className="primary compact" onClick={() => runAnalysis()}>분석 새로고침</button>} />
            <OverallCourseSummary course={course} compact />
            {analysis ? <AIEvidenceResult result={analysis} /> : <EmptyState title="아직 생성된 분석이 없습니다." action={`${selectedClass.name} 분석하기`} onClick={() => runAnalysis()} />}
          </section>
        )}
        {tab === "roleplay" && course.type === "newbie" && (
          <section className="content-card">
            <SectionTitle eyebrow="신규직원과정" title="교육생 AI 보고 훈련 설정" />
            <p className="section-desc">교수요원은 상황과 난이도를 정해 훈련을 열고, 실제 답변은 교육생이 자신의 화면에서 작성합니다.</p>
            <div className="scenario-grid">
              {["민원 발생 보고", "시재 차이 보고", "조합원 항의 보고", "경제사업 사고 위험 보고", "상사 부재 중 긴급 보고", "개인정보 관련 사고 우려", "농산물 출하 지연 보고", "조합원 민원 확산 가능 상황"].map((x) => <button className={selectedScenario === x ? "selected" : ""} key={x} onClick={() => setSelectedScenario(x)}>{x}</button>)}
            </div>
            <div className="difficulty-row">{[["쉬움", "친절한 팀장"], ["보통", "바쁜 팀장"], ["어려움", "꼬리질문 많은 팀장"]].map(([level, desc]) => <button className={difficulty === level ? "selected" : ""} onClick={() => setDifficulty(level)} key={level}><b>{level}</b><span>{desc}</span></button>)}</div>
            <CurrentClassNotice className={selectedClass.name} action="보고훈련이 운영됩니다." />
            <div className="roleplay-open-actions">
              <div><b>{selectedClass.name} 교육생 화면 상태</b><span>{course.roleplayConfig?.enabled && course.roleplayConfig.classId === selectedClass.id ? "훈련 열림" : "훈련 닫힘"}</span></div>
              <div>
                <button className="primary" onClick={() => saveRoleplaySetting(true)}>{course.roleplayConfig?.enabled && course.roleplayConfig.classId === selectedClass.id ? "설정 변경 반영" : `${selectedClass.name}에 훈련 열기`}</button>
                {course.roleplayConfig?.enabled && course.roleplayConfig.classId === selectedClass.id && <button className="secondary" onClick={() => saveRoleplaySetting(false)}>보고 훈련 종료</button>}
              </div>
            </div>
            <details className="roleplay-response-list mobile-details">
              <summary>교육생 훈련 결과 {(filteredCourse.reportTrainings || []).length}건 보기</summary>
              {(filteredCourse.reportTrainings || []).map((training) => <article key={training.id}><div><b>{training.name}</b><span>{training.className} · {training.scenario} · {training.difficulty}</span></div><p>{training.reportText}</p><small>첫 개선점 · {training.feedback?.firstFix}</small></article>)}
              {!(filteredCourse.reportTrainings || []).length && <div className="board-empty">아직 제출된 보고 훈련이 없습니다.</div>}
            </details>
          </section>
        )}
        {tab === "transfer" && (
          <section className="content-card">
            <SectionTitle eyebrow="교육 이후" title="현업 전이 관리와 성과 내보내기" />
            <div className="transfer-stats"><Stat label="수료 성찰" value={`${filteredCourse.achievements.length}/${filteredParticipantCount}`} /><Stat label="현업활용도 응답" value={`${filteredCourse.surveys.length}/${filteredParticipantCount}`} /><Stat label="평균 적용도" value={`${averageLikert(filteredCourse.surveys)}점`} /></div>
            <ClassSubmissionSummary course={course} />
            <TransferReportSummary course={filteredCourse} participantCount={filteredParticipantCount} />
            <FollowupPushDemo status={pushStatus} onStart={startPushDemo} onOpen={openFollowupSurveyDemo} />
            <div className="export-row">
              <div><h3>과정 성과 리포트</h3><p>목표·참여·성찰·현업 적용 데이터를 한 번에 내보냅니다.</p></div>
              <div><button className="secondary" onClick={() => downloadReport(course, "json", "all")}>전체 JSON</button><button className="secondary" onClick={() => downloadReport(course, "csv", "all")}>전체 CSV</button><button className="secondary" onClick={() => downloadReport(course, "json", selectedClassFilter)}>{selectedClass.name} JSON</button><button className="primary" onClick={() => downloadReport(course, "csv", selectedClassFilter)}>{selectedClass.name} CSV</button></div>
            </div>
          </section>
        )}
        <PrivacyFooter />
      </main>
      {expandedBoard && <BoardLightbox item={expandedBoard} onClose={() => setExpandedBoard(null)} />}
    </>
  );
}

function ProfessorDashboard({ course, onNavigate, onAnalyze }) {
  const questionCount = course.rounds.reduce((sum, r) => sum + r.items.length, 0);
  const clusters = buildAnalysis(course).clusters.length;
  const intervention = buildTeachingIntervention(course);
  const cards = [
    ["목표 제출", `${course.goals.length}/${course.participantCount}명`, "goals", "교육 시작 전 목표 수집"],
    ["수료 성찰", `${course.achievements.length}/${course.participantCount}명`, "goals", "목표 달성도 작성"],
    ["사후 적용도", `${course.surveys.length}/${course.participantCount}명`, "transfer", "현업 적용 응답"],
    ["질문·게시판", `${questionCount}건`, "live", "교육 중 참여 데이터"],
    ["AI 핵심 주제", `${clusters}개`, "ai", "응답 기반 주제 묶음"],
  ];
  return (
    <>
      <section className="dashboard-intro">
        <div><span className="live-dot">● LIVE</span><h2>지금 수업은 ‘참여 데이터 축적’ 단계입니다.</h2><p>목표 제출률을 높이고, 실수 보고에 관한 교육생의 실제 장벽을 짚어주세요.</p></div>
        <div className="dashboard-actions"><button className="primary" onClick={onAnalyze}>AI 분석 보기</button></div>
      </section>
      <section className="metric-grid">
        {cards.map(([label, value, target, desc]) => <button className="metric-card" key={label} onClick={() => onNavigate(target)}><span>{label}</span><strong>{value}</strong><p>{desc}</p><i>자세히 보기 →</i></button>)}
      </section>
      <section className="recommend-card">
        <div className="recommend-head"><div className="ai-symbol">AI</div><div><span className="eyebrow">지금 짚으면 좋은 질문</span><h2>강의 개입 추천</h2></div><ReviewBadge /></div>
        <ol>
          <li><b>“실수를 빨리 보고해야 한다고 알면서도, 실제 현장에서는 왜 숨기게 될까요?”</b><span>‘숨김’과 ‘신속한 공유’에 공감·현업 경험 반응이 집중되었습니다.</span></li>
          <li><b>“조합원 관점의 대응과 규정 준수가 충돌할 때, 무엇을 기준으로 판단해야 할까요?”</b><span>팀 게시판에서 조합원 실익과 정확한 절차가 함께 등장했습니다.</span></li>
        </ol>
      </section>
      <section className="teaching-intervention-card">
        <div className="recommend-head"><div className="ai-symbol">AI</div><div><span className="eyebrow">실제 응답 기반</span><h2>AI 수업 개입 제안</h2></div><ReviewBadge /></div>
        <blockquote><span>근거 응답 원문</span><p>“{intervention.evidence}”</p></blockquote>
        <div className="intervention-grid">
          <article><span>지금 설명이 부족한 개념</span><p>{intervention.insufficientConcept}</p></article>
          <article><span>교육생들이 헷갈리는 지점</span><p>{intervention.confusionPoint}</p></article>
          <article><span>바로 던질 후속 질문</span><p>{intervention.immediateQuestion}</p></article>
          <article><span>3분 보충 설명 추천</span><p>{intervention.miniLesson}</p></article>
          <article><span>토론으로 넘길 주제</span><p>{intervention.discussionTopic}</p></article>
        </div>
      </section>
      <section className="flow-card">
        <h3>교육 성과 데이터 흐름</h3>
        <div className="flow-steps">{["입교 전 목표", "교육 중 참여", "수료 성찰", "현업 미션", "2개월 후 적용"].map((x, i) => <React.Fragment key={x}><div><b>{i + 1}</b><span>{x}</span></div>{i < 4 && <i>→</i>}</React.Fragment>)}</div>
      </section>
    </>
  );
}

function FollowupPushDemo({ status, onStart, onOpen }) {
  return (
    <section className="followup-push-demo">
      <div>
        <span className="eyebrow">사후조사 알림 데모</span>
        <h3>현업활용도 조사 알림 시연</h3>
        <p className="demo-compression-note">실제 서비스에서는 교육종료일 +2개월에 예약 발송됩니다. 본 화면은 시연을 위해 10초로 압축한 데모입니다.</p>
        <p className="demo-compression-note">응답 내용은 실명으로 공개되지 않고, 제출 여부만 재안내와 중복 응답 방지를 위해 확인됩니다.</p>
      </div>
      <div className="followup-demo-actions">
        <button className="secondary compact" onClick={onStart}>{status === "waiting" ? "알림 대기 중" : "10초 데모 시작"}</button>
        {status === "arrived" && (
          <button className="primary compact followup-notification-card" onClick={onOpen}>
            [NH 농심튜터] 현업활용도 조사 알림 도착 · 클릭해서 설문 열기
          </button>
        )}
      </div>
    </section>
  );
}

function TransferReportSummary({ course, participantCount }) {
  const surveys = course.surveys || [];
  const achievements = course.achievements || [];
  const anonymousSurveys = anonymizeSurveyResponses(surveys);
  const appliedTexts = anonymousSurveys.filter((item) => item.applied).slice(0, 3);
  const supportTexts = anonymousSurveys.filter((item) => item.support).slice(0, 3);
  const barrierCounts = surveys.reduce((acc, survey) => {
    (survey.barriers || []).forEach((barrier) => {
      acc[barrier] = (acc[barrier] || 0) + 1;
    });
    return acc;
  }, {});
  const topBarriers = Object.entries(barrierCounts).sort((a, b) => b[1] - a[1]);
  const supportBarrierRatio = surveys.length ? (barrierCounts["상사·동료의 지원 부족"] || 0) / surveys.length : 0;
  const likertSum = (survey) => (survey.likert || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const withApplied = surveys.filter((item) => (item.applied || "").trim());
  const withSupport = surveys.filter((item) => (item.support || "").trim());
  // 8월 API 연동 시: 사례 선정을 AI 응답 스키마(successCase/blockedCase)로 대체
  const bestCase = withApplied.length
    ? [...withApplied].sort((a, b) => likertSum(b) - likertSum(a))[0].applied
    : "아직 구체적인 적용 사례가 충분히 수집되지 않았습니다.";
  const blockedCase = withSupport.length
    ? [...withSupport].sort((a, b) => likertSum(a) - likertSum(b))[0].support
    : topBarriers[0]?.[0] || "아직 적용을 막은 요인이 충분히 수집되지 않았습니다.";
  if (!surveys.length) {
    return (
      <section className="transfer-report-summary">
        <div className="board-empty">아직 현업활용도 조사 응답이 없습니다. 교육 후 응답이 수집되면 이곳에서 전이 리포트를 확인할 수 있습니다.</div>
      </section>
    );
  }
  return (
    <section className="transfer-report-summary">
      <div className="report-summary">
        <div className="ai-symbol">AI</div>
        <div>
          <div className="summary-head"><span>전이 리포트 요약</span><ReviewBadge /></div>
          <p>현업활용도 응답은 {surveys.length}/{participantCount}명 제출되었습니다. 평균 적용도는 {averageLikert(surveys)}점이며, 개인 평가가 아니라 다음 교육과 현업 지원을 개선하기 위한 집계 참고자료로 활용합니다.</p>
        </div>
      </div>
      <div className="transfer-case-grid">
        <article><h3>✅ 가장 잘 적용된 사례</h3><p>“{bestCase}”</p></article>
        <article><h3>⛔ 가장 막힌 사례</h3><p>“{blockedCase}”</p></article>
      </div>
      <div className="transfer-insight-grid">
        <article>
          <h3>현업 적용 응답 요약</h3>
          {appliedTexts.length ? appliedTexts.map((item) => <p key={item.label}><b>{item.label}</b> “{item.applied}”</p>) : <p>아직 구체적인 현업 적용 사례가 없습니다.</p>}
        </article>
        <article>
          <h3>과정 개선 포인트</h3>
          {supportTexts.length ? supportTexts.map((item) => <p key={item.label}><b>{item.label}</b> “{item.support}”</p>) : <p>추가 지원 요구가 수집되면 이곳에 표시됩니다.</p>}
        </article>
      </div>
      <div className="barrier-summary">
        <h3>장애요인 빈도</h3>
        {topBarriers.length ? topBarriers.map(([barrier, count]) => <div key={barrier}><span>{barrier}</span><b>{count}명</b></div>) : <p>아직 장애요인 응답이 없습니다.</p>}
      </div>
      {supportBarrierRatio >= 0.3 && (
        <div className="manager-action-warning">
          ⚠ 적용 장애의 상당수가 '환경(상사·동료 지원)'에 있습니다. 교육 추가보다 관리자 대상 안내·지원이 효과적일 수 있습니다.
        </div>
      )}
      <p className="transfer-report-footnote">※ 행동 변화에는 교육 외 요인(상사 지원, 업무 환경 등)이 함께 작용할 수 있어, 본 리포트는 성과의 인과를 단정하지 않습니다.</p>
    </section>
  );
}

function OlympicsLink() {
  return (
    <a
      className="olympics-link"
      href="https://nh-olympic.netlify.app/"
      target="_blank"
      rel="noreferrer"
      title="농협올림픽 앱 열기"
      aria-label="농협올림픽 앱 열기"
    >
      농협올림픽 <span>↗</span>
    </a>
  );
}

function OlympicActivityControl({ course, setCourse }) {
  const isOpen = course.olympicActivityOpen === true;
  return (
    <section className="content-card olympic-control-card">
      <SectionTitle
        eyebrow="통합 농협이념과정 운영"
        title={<span className="olympic-title-inline">농협올림픽 활동 링크 <em>{isOpen ? "열림" : "닫힘"}</em></span>}
        action={<OlympicsLink />}
      />
      <p className="section-desc">농협올림픽은 교육 중 특정 활동 시간에만 안내합니다. 활동을 열면 교육생 화면에 참여 카드가 표시됩니다.</p>
      <div className="olympic-control-actions">
        <button
          className={isOpen ? "secondary" : "primary"}
          onClick={() => setCourse((current) => ({ ...current, olympicActivityOpen: !isOpen }))}
        >
          {isOpen ? "활동 닫기" : "활동 열기"}
        </button>
      </div>
    </section>
  );
}

function CourseRegistrationForm({ value, onChange, onSubmit, issuedCode, course, courses, onSelectCourse, onUpdateCourse, onDeleteCourse, notify }) {
  const [listTab, setListTab] = useState("active");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingCourse, setEditingCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const pageSize = 10;
  const years = useMemo(() => [...new Set(courses.map((item) => item.startDate?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [courses]);
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...courses]
      .filter((item) => listTab === "archive" ? isCourseEnded(item) : !isCourseEnded(item))
      .filter((item) => !query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query))
      .filter((item) => yearFilter === "all" || item.startDate?.startsWith(yearFilter))
      .filter((item) => typeFilter === "all" || item.type === typeFilter)
      .filter((item) => statusFilter === "all" || getCoursePhase(item) === statusFilter)
      .sort((a, b) => {
        const phaseOrder = { active: 0, completion: 1, before: 2, followupWait: 3, transfer: 4 };
        return phaseOrder[getCoursePhase(a)] - phaseOrder[getCoursePhase(b)]
          || b.startDate.localeCompare(a.startDate)
          || b.createdAt.localeCompare(a.createdAt);
      });
  }, [courses, listTab, search, yearFilter, typeFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const pagedCourses = filteredCourses.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [listTab, search, yearFilter, typeFilter, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(course.code);
      notify("발급된 과정 코드를 복사했습니다.");
    } catch {
      notify(`발급 코드: ${course.code}`);
    }
  };

  const saveEditedCourse = () => {
    if (!editingCourse.name.trim()) return notify("과정명을 입력해주세요.");
    if (!editingCourse.startDate || !editingCourse.endDate) return notify("교육기간을 입력해주세요.");
    if (editingCourse.endDate < editingCourse.startDate) return notify("종료일은 시작일보다 빠를 수 없습니다.");
    onUpdateCourse({
      ...editingCourse,
      name: editingCourse.name.trim(),
      leadershipGrade: editingCourse.type === "leader" ? editingCourse.leadershipGrade : undefined,
      transferDate: addMonthsToDate(editingCourse.endDate, 2),
      classCount: Number(editingCourse.classCount) || 1,
      classes: createClasses(editingCourse.classCount),
      updatedAt: now(),
    });
    setEditingCourse(null);
    notify(`${editingCourse.code} 과정 정보를 수정했습니다.`);
  };

  const confirmDelete = () => {
    if (courses.length === 1) {
      setDeleteTarget(null);
      return notify("마지막 남은 과정은 삭제할 수 없습니다. 새 과정을 등록한 뒤 삭제해주세요.");
    }
    onDeleteCourse(deleteTarget.code);
    notify(`${deleteTarget.code} 과정을 삭제했습니다.`);
    setDeleteTarget(null);
  };
  return (
    <section className="content-card course-create-card">
      <SectionTitle eyebrow="과정 개설" title="새 과정 등록 및 코드 발급" />
      <p className="section-desc">교육유형, 대상 직급, 과정명과 교육기간을 지정하면 교육생 입장 코드가 즉시 발급됩니다.</p>
      <div className="code-rule-note">
        코드 규칙 · 통합이념 NH-1001~ · 직급별이념 NH-2001~ · 신규직원 NH-3001~ · 직무 NH-4001~
      </div>
      <div className="form-label">1. 교육 유형 선택</div>
      <div className="course-type-grid">
        {Object.entries(courseTypes).map(([id, label]) => (
          <button key={id} className={value.type === id ? "selected" : ""} onClick={() => onChange({ ...value, type: id })}>
            <span>{id === "ideology" ? "🌱" : id === "leader" ? "◆" : id === "newbie" ? "◎" : "▣"}</span>
            <b>{label}</b>
            {id === "ideology" && <small>농협올림픽 앱 연계</small>}
          </button>
        ))}
      </div>
      {value.type === "leader" && (
        <div className="leadership-grade-field">
          <span>2. 대상 직급</span>
          <div>
            {["M급", "3급", "4급", "5급"].map((grade) => (
              <button key={grade} className={value.leadershipGrade === grade ? "selected" : ""} onClick={() => onChange({ ...value, leadershipGrade: grade })}>{grade}</button>
            ))}
          </div>
        </div>
      )}
      <label className="field course-name-field">
        <span>{value.type === "leader" ? "3. 과정명 입력" : "2. 과정명 입력"}</span>
        <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder={value.type === "leader" ? "예: 2026년 5급 농협이념과정 1기" : "예: 2026년 통합 농협이념과정 1기"} />
        <small>연간 여러 기수를 쉽게 구분할 수 있도록 연도·직급·기수를 함께 적어주세요.</small>
      </label>
      <div className="date-range-grid">
        <label className="field"><span>교육 시작일</span><input type="date" value={value.startDate} onChange={(e) => onChange({ ...value, startDate: e.target.value })} /></label>
        <div className="date-arrow">→</div>
        <label className="field"><span>교육 종료일</span><input type="date" value={value.endDate} min={value.startDate} onChange={(e) => onChange({ ...value, endDate: e.target.value })} /></label>
      </div>
      <div className="class-count-field">
        <span>반 수</span>
        <div>{[1, 2, 3, 4].map((count) => <button type="button" key={count} className={Number(value.classCount) === count ? "selected" : ""} onClick={() => onChange({ ...value, classCount: count })}>{count}반</button>)}</div>
        <small>과정은 하나로 유지되고 교육생 데이터만 반별로 구분됩니다.</small>
      </div>
      <div className="transfer-date-preview">→ 현업활용도 발송: <b>{addMonthsToDate(value.endDate, 2)}</b></div>
      <button className="primary create-course-button" onClick={onSubmit}>과정 등록 및 코드 발급</button>
      {issuedCode && (
        <div className="issued-code-card">
          <div><span>발급 완료</span><h3>{course.code}</h3><p>{courseTypes[course.type]} · {course.startDate} ~ {course.endDate}</p></div>
          <div>
            <button className="secondary" onClick={copyCode}>코드 복사</button>
          </div>
        </div>
      )}
      <div className="registered-courses">
        <div className="registered-heading">
          <div><h3>등록된 과정</h3><p>운영 중·예정 과정만 기본 표시하며 종료 과정은 보관함에서 확인합니다.</p></div>
          <span>전체 {courses.length}개</span>
        </div>
        <div className="course-list-tabs">
          <button className={listTab === "active" ? "active" : ""} onClick={() => setListTab("active")}>운영·예정 <b>{courses.filter((item) => !isCourseEnded(item)).length}</b></button>
          <button className={listTab === "archive" ? "active" : ""} onClick={() => setListTab("archive")}>종료 과정 보관함 <b>{courses.filter(isCourseEnded).length}</b></button>
        </div>
        <div className="course-list-controls">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="과정명 또는 코드 검색" aria-label="과정명 또는 코드 검색" />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="all">전체 연도</option>
            {years.map((year) => <option key={year} value={year}>{year}년</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">전체 유형</option>
            {Object.entries(courseTypes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="before">예정</option>
            <option value="active">운영 중</option>
            {listTab === "archive" && <option value="transfer">종료</option>}
          </select>
        </div>
        <div className="course-list-summary">
          <span>검색 결과 {filteredCourses.length}개</span>
          {(search || yearFilter !== "all" || typeFilter !== "all" || statusFilter !== "all") && <button onClick={() => { setSearch(""); setYearFilter("all"); setTypeFilter("all"); setStatusFilter("all"); }}>필터 초기화</button>}
        </div>
        <div className="course-list-items">
          {pagedCourses.map((item) => (
            <article key={item.code} className={item.code === course.code ? "active" : ""}>
              <button className="course-list-main" onClick={() => onSelectCourse(item)}>
                <span><b>{item.name}</b><small>{courseTypes[item.type]}{item.leadershipGrade ? ` · ${item.leadershipGrade}` : ""} · {item.classCount || 1}개 반 · {item.startDate} ~ {item.endDate}</small></span>
                <div><em className={`course-status ${getCoursePhase(item)}`}>{({ before: "예정", active: "운영 중", completion: "수료일", followupWait: "2개월 후 조사 대기", transfer: "현업활용도 조사" })[getCoursePhase(item)]}</em><strong>{item.code}</strong></div>
              </button>
              <div className="course-row-actions">
                <button onClick={() => setEditingCourse({ ...item })}>수정</button>
                <button className="delete" onClick={() => setDeleteTarget(item)}>삭제</button>
              </div>
            </article>
          ))}
          {!pagedCourses.length && <div className="course-list-empty">조건에 맞는 과정이 없습니다.</div>}
        </div>
        {totalPages > 1 && (
          <div className="course-pagination">
            <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>← 이전</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>다음 →</button>
          </div>
        )}
      </div>
      {editingCourse && (
        <div className="course-modal" role="dialog" aria-modal="true">
          <div className="course-modal-card">
            <div className="modal-head"><div><span className="eyebrow">과정 정보 수정</span><h3>{editingCourse.code}</h3></div><button onClick={() => setEditingCourse(null)} aria-label="과정 정보 수정 닫기">×</button></div>
            <label className="field"><span>과정명</span><input value={editingCourse.name} onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })} /></label>
            <div className="readonly-course-type"><span>과정 유형</span><b>{courseTypes[editingCourse.type]}</b><small>코드 체계 유지를 위해 과정 유형은 변경할 수 없습니다.</small></div>
            {editingCourse.type === "leader" && <div className="leadership-grade-field"><span>대상 직급</span><div>{["M급", "3급", "4급", "5급"].map((grade) => <button key={grade} className={editingCourse.leadershipGrade === grade ? "selected" : ""} onClick={() => setEditingCourse({ ...editingCourse, leadershipGrade: grade })}>{grade}</button>)}</div></div>}
            <div className="class-count-field"><span>반 수</span><div>{[1, 2, 3, 4].map((count) => <button type="button" key={count} className={Number(editingCourse.classCount || 1) === count ? "selected" : ""} onClick={() => setEditingCourse({ ...editingCourse, classCount: count })}>{count}반</button>)}</div></div>
            <div className="date-range-grid">
              <label className="field"><span>교육 시작일</span><input type="date" value={editingCourse.startDate} onChange={(e) => setEditingCourse({ ...editingCourse, startDate: e.target.value })} /></label>
              <div className="date-arrow">→</div>
              <label className="field"><span>교육 종료일</span><input type="date" min={editingCourse.startDate} value={editingCourse.endDate} onChange={(e) => setEditingCourse({ ...editingCourse, endDate: e.target.value })} /></label>
            </div>
            <div className="transfer-date-preview">→ 현업활용도 발송: <b>{addMonthsToDate(editingCourse.endDate, 2)}</b></div>
            <div className="modal-actions"><button className="secondary" onClick={() => setEditingCourse(null)}>취소</button><button className="primary" onClick={saveEditedCourse}>수정사항 저장</button></div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="course-modal" role="alertdialog" aria-modal="true">
          <div className="course-modal-card delete-confirm">
            <div className="delete-symbol">!</div>
            <h3>이 과정을 삭제할까요?</h3>
            <p>삭제된 과정과 교육생 응답은 복구할 수 없습니다.</p>
            <div><b>{deleteTarget.name}</b><span>{deleteTarget.code} · {deleteTarget.startDate} ~ {deleteTarget.endDate}</span></div>
            <div className="modal-actions"><button className="secondary" onClick={() => setDeleteTarget(null)}>취소</button><button className="danger-button" onClick={confirmDelete}>확인하고 삭제</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionComposer({ value, onChange, onSubmit }) {
  const updateOption = (index, text) => onChange({ ...value, options: value.options.map((item, i) => i === index ? text : item) });
  return (
    <div className="question-composer">
      <div className="composer-type">
        <button className={value.type === "subjective" ? "selected" : ""} onClick={() => onChange({ ...value, type: "subjective" })}>주관식</button>
        <button className={value.type === "objective" ? "selected" : ""} onClick={() => onChange({ ...value, type: "objective" })}>객관식</button>
      </div>
      <textarea value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} placeholder="교육생에게 실시간으로 제시할 질문을 입력하세요." aria-label="실시간 질문 내용 입력" />
      <label className="anonymous-toggle">
        <input type="checkbox" checked={value.anonymous === true} onChange={(e) => onChange({ ...value, anonymous: e.target.checked })} />
        <span>🙈 익명으로 받기</span>
      </label>
      {value.type === "objective" && (
        <div className="option-editor">
          {value.options.map((option, index) => <input key={index} value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`답변 항목 ${index + 1}`} aria-label={`객관식 답변 항목 ${index + 1}`} />)}
          <button className="ghost" onClick={() => onChange({ ...value, options: [...value.options, ""] })}>＋ 항목 추가</button>
        </div>
      )}
      <button className="primary" onClick={onSubmit}>질문 열기</button>
    </div>
  );
}

function BoardModuleCreator({ value, onChange, onSubmit }) {
  return (
    <div className="board-module-creator">
      <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="모듈명 예: 2모듈 신뢰받는 농협인" aria-label="신규 장표 업로드 탭 모듈명" />
      <button className="primary" onClick={onSubmit}>＋ 신규 장표 업로드 탭</button>
    </div>
  );
}

function ProfessorJobReflection({ course, setCourse, notify, classFilter = "class-1", participantCount }) {
  const [selectedDate, setSelectedDate] = useState(todayInKorea());
  const [form, setForm] = useState({ title: "", instructor: "", date: todayInKorea(), startTime: "09:00", endTime: "10:00" });
  const [pasteText, setPasteText] = useState("");
  const [editing, setEditing] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showAllBest, setShowAllBest] = useState(false);
  const [showAllImprovement, setShowAllImprovement] = useState(false);
  const [visibleRawCount, setVisibleRawCount] = useState(5);
  const selectedClassName = course.classes.find((item) => item.id === classFilter)?.name || "1반";
  const sessions = (course.jobSessions || []).filter((session) => session.date === selectedDate && session.classId === classFilter).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const reflections = (course.jobReflections || []).filter((reflection) => reflection.date === selectedDate && reflection.classId === classFilter);
  const summary = summarizeJobReflections(sessions, reflections, participantCount);
  const applicationKeyword = summary.applicationPoints[0] ? `${summary.applicationPoints[0].slice(0, 20)}${summary.applicationPoints[0].length > 20 ? "…" : ""}` : "-";

  const addSession = () => {
    if (!form.title.trim() || !form.instructor.trim() || !form.date || !form.startTime || !form.endTime) return notify("강의명, 강사명, 일자와 시간을 모두 입력해주세요.");
    if (form.endTime <= form.startTime) return notify("종료시간은 시작시간보다 늦어야 합니다.");
    const session = { id: uid("job-session"), courseId: course.code, classId: classFilter, className: selectedClassName, date: form.date, title: form.title.trim(), instructor: form.instructor.trim(), startTime: form.startTime, endTime: form.endTime };
    setCourse((current) => ({ ...current, jobSessions: [...(current.jobSessions || []), session] }));
    setSelectedDate(form.date);
    setForm((current) => ({ ...current, title: "", instructor: "" }));
    setShowAddForm(false);
    notify("직무강의 목록에 추가했습니다.");
  };

  const addPastedSessions = () => {
    const parsed = parseJobSchedule(pasteText, selectedDate, course.code, uid);
    const errors = parsed.filter((item) => item.error);
    const valid = parsed.filter((item) => !item.error).map((item) => ({ ...item, classId: classFilter, className: selectedClassName }));
    if (!valid.length) return notify("붙여넣기 형식을 확인해주세요. 예: 09:00~10:00 계약실무 / 김OO");
    setCourse((current) => ({ ...current, jobSessions: [...(current.jobSessions || []), ...valid] }));
    setPasteText(errors.map((item) => item.error).join("\n"));
    if (!errors.length) setShowPaste(false);
    notify(errors.length ? `${valid.length}개를 추가했습니다. 형식이 맞지 않는 ${errors.length}개 줄은 입력창에 남겼습니다.` : `${valid.length}개 강의를 추가했습니다.`);
  };

  const saveEdit = () => {
    if (!editing.title.trim() || !editing.instructor.trim()) return notify("강의명과 강사명을 입력해주세요.");
    setCourse((current) => ({ ...current, jobSessions: current.jobSessions.map((session) => session.id === editing.id ? { ...editing, title: editing.title.trim(), instructor: editing.instructor.trim() } : session) }));
    setEditing(null);
    notify("강의 정보를 수정했습니다.");
  };

  const removeSession = (session) => {
    if (!window.confirm(`‘${session.title}’ 강의를 목록에서 삭제할까요?`)) return;
    setCourse((current) => ({ ...current, jobSessions: current.jobSessions.filter((item) => item.id !== session.id) }));
    notify("강의 목록에서 삭제했습니다.");
  };

  return (
    <div className="prof-job-reflection">
      <SectionTitle eyebrow="과정 개선을 위한 회고" title="오늘의 직무강의 회고" />
      <CurrentClassNotice className={selectedClassName} action="강의 목록과 회고가 운영됩니다." />
      <p className="section-desc">하루 강의 목록을 한 번 등록하면 교육생은 교육 종료 시 한 번만 회고합니다. 개별 자료 요청이 아니라 다음 기수와 과정 개선을 위한 데이터입니다.</p>

      <section className="job-reflection-summary">
        <div className="job-summary-stats">
          <Stat label="회고 제출 인원" value={`${summary.submitted}/${summary.participantCount}명`} />
          <Stat label="현업에 가장 도움 된 강의 1위" value={summary.bestRanking[0]?.title || "-"} />
          <Stat label="보완이 필요한 강의 1위" value={summary.improvementRanking[0]?.title || "-"} />
          <Stat label="주요 현업 적용 키워드" value={applicationKeyword} />
        </div>
        <div className="job-ranking-grid">
          <JobRanking title="현업에 가장 도움이 된 강의 순위" items={summary.bestRanking} expanded={showAllBest} onToggle={() => setShowAllBest((value) => !value)} />
          <JobRanking title="보완이 필요한 강의 순위" items={summary.improvementRanking} emptyLabel="보완 필요 선택 없음" expanded={showAllImprovement} onToggle={() => setShowAllImprovement((value) => !value)} />
        </div>
        <div className="job-distribution-grid"><JobDistribution title="도움이 된 이유 분포" counts={summary.bestReasons} /><JobDistribution title="보완 필요 이유 분포" counts={summary.improvementReasons} /></div>
        <details className="job-application-points">
          <summary>교육생들이 작성한 ‘내 업무에 가져갈 한 가지’ 보기</summary>
          {summary.applicationPoints.slice(0, 12).map((text, index) => <blockquote key={`${text}-${index}`}>“{text}”</blockquote>)}
          {!summary.applicationPoints.length && <div className="board-empty">아직 작성된 현업 적용 문장이 없습니다.</div>}
        </details>
        <div className="job-summary-cards"><article><span>AI 시연용 분석 요약</span><p>{summary.analysis}</p></article><article><span>본부 과정 담당자용 개선 요약</span><p>{summary.headquartersSummary}</p></article><article><span>교육원 운영 담당자용 요약</span><p>{summary.operationsSummary}</p></article></div>
        <details className="job-raw-responses" onToggle={(event) => { if (!event.currentTarget.open) setVisibleRawCount(5); }}>
          <summary>교육생 원문 보기 <span>{reflections.length}건</span></summary>
          {reflections.slice(0, visibleRawCount).map((reflection) => <article key={reflection.id}><b>{reflection.studentName} <em className="class-tag">{reflection.className || "1반"}</em></b><p>{reflection.workApplicationPoint}</p><small>도움 이유: {reflection.bestReason}{reflection.bestReasonEtc ? ` · ${reflection.bestReasonEtc}` : ""}</small></article>)}
          {visibleRawCount < reflections.length && <button className="secondary job-raw-more" onClick={() => setVisibleRawCount((count) => count + 5)}>더 보기</button>}
        </details>
      </section>

      <section className="job-session-manager">
        <div className="job-manager-head"><div><span className="eyebrow">오늘 강의 목록 등록</span><h3>{selectedDate} 강의 목록 {sessions.length}개</h3></div><label>관리 일자<input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setForm({ ...form, date: e.target.value }); setVisibleRawCount(5); }} /></label></div>
        <div className="job-session-list">
          {!sessions.length ? <div className="board-empty">등록된 강의가 없습니다.</div> : sessions.map((session) => editing?.id === session.id ? <article className="editing" key={session.id}>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="강의명 수정" />
            <input value={editing.instructor} onChange={(e) => setEditing({ ...editing, instructor: e.target.value })} aria-label="강사명 수정" />
            <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} aria-label="강의일자 수정" />
            <input type="time" value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} aria-label="강의 시작시간 수정" />
            <input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} aria-label="강의 종료시간 수정" />
            <div><button className="primary compact" onClick={saveEdit}>저장</button><button className="secondary compact" onClick={() => setEditing(null)}>취소</button></div>
          </article> : <article key={session.id}><div><b>{session.startTime}~{session.endTime}</b><span>{session.title}</span><small>{session.instructor}</small></div><div><button onClick={() => setEditing({ ...session })}>수정</button><button className="delete" onClick={() => removeSession(session)}>삭제</button></div></article>)}
        </div>
        <div className="job-manager-actions">
          <button className="primary" aria-expanded={showAddForm} onClick={() => setShowAddForm((value) => !value)}>{showAddForm ? "강의 추가 닫기" : "＋ 강의 추가"}</button>
          <button className="secondary" aria-expanded={showPaste} onClick={() => setShowPaste((value) => !value)}>{showPaste ? "빠른 붙여넣기 닫기" : "빠른 붙여넣기 열기"}</button>
        </div>
        {showAddForm && <div className="job-session-form">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="강의명" aria-label="강의명 입력" />
          <input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="강사명" aria-label="강사명 입력" />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="강의일자 입력" />
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} aria-label="강의 시작시간 입력" />
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} aria-label="강의 종료시간 입력" />
          <button className="primary" onClick={addSession}>강의 추가</button>
        </div>}
        {showPaste && <div className="job-paste-box"><div><b>빠른 붙여넣기</b><small>예: 09:00~10:00 계약실무 / 김OO</small></div><textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"09:00~10:00 계약실무 / 김OO\n10:00~12:00 사고예방 사례 / 박OO"} aria-label="강의 목록 빠른 붙여넣기" /><button className="secondary" onClick={addPastedSessions}>여러 강의 자동 등록</button></div>}
      </section>
    </div>
  );
}

function JobRanking({ title, items, emptyLabel = "아직 선택 결과가 없습니다.", expanded = false, onToggle }) {
  const visibleItems = expanded ? items : items.slice(0, 3);
  return <div className="job-ranking"><h3>{title}</h3>{visibleItems.length ? visibleItems.map((item, index) => <div key={item.id}><b>{index + 1}</b><span>{item.title}</span><strong>{item.count}명</strong></div>) : <p>{emptyLabel}</p>}{items.length > 3 && <button className="job-ranking-toggle" aria-expanded={expanded} onClick={onToggle}>{expanded ? "접기" : `전체 보기 (${items.length})`}</button>}</div>;
}

function JobDistribution({ title, counts }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return <div className="job-distribution"><h3>{title}</h3>{entries.length ? entries.map(([label, count]) => <div key={label}><span>{label}</span><b>{count}명</b><i><em style={{ width: `${count / max * 100}%` }} /></i></div>) : <p>아직 집계 결과가 없습니다.</p>}</div>;
}

function ProfessorBoardGallery({ rounds, selectedId, onSelect, onExpand, onAnalyze, analysis }) {
  const selected = rounds.find((round) => round.id === selectedId) || rounds[0];
  if (!rounds.length) return <EmptyState title="아직 생성된 장표 모듈이 없습니다." action="위에서 모듈명을 입력하세요" onClick={() => {}} />;
  return (
    <div className="prof-board-gallery">
      <div className="board-module-tabs">
        {rounds.map((round) => <button key={round.id} className={selected?.id === round.id ? "active" : ""} onClick={() => onSelect(round.id)}>{round.prompt}<span>{round.items.length}</span></button>)}
      </div>
      <div className="board-gallery-head">
        <div><h3>{selected.prompt}</h3><p>{selected.description || "교육생이 올린 팀별 장표를 발표하고 분석합니다."}</p></div>
        <button className="secondary" onClick={() => onAnalyze(selected)}>전체 장표 AI 분석</button>
      </div>
      {!selected.items.length ? <div className="board-empty">교육생 장표 업로드를 기다리고 있습니다.</div> : (
        <details className="mobile-details board-list-details"><summary>팀 장표 {selected.items.length}개 보기</summary><div className="board-card-grid">
          {selected.items.map((item) => (
            <article key={item.id}>
              <button className="board-image-button" onClick={() => onExpand(item)} aria-label={`${item.by} 팀 장표 전체화면으로 보기`}>
                {item.imageUrl ? <img src={item.imageUrl} alt={`${item.by} 장표`} /> : <div>이미지 없음</div>}
                <span>전체화면 발표 ↗</span>
              </button>
              <div><h4>{item.by} <em className="class-tag">{item.className || "1반"}</em></h4><p>{new Date(item.createdAt).toLocaleString("ko-KR")}</p><button className="ghost" onClick={() => onAnalyze(selected, item)}>이 팀 장표 AI 분석</button></div>
            </article>
          ))}
        </div></details>
      )}
      {analysis && (
        <div className="board-ai-analysis">
          <div className="recommend-head"><div className="ai-symbol">AI</div><div><span className="eyebrow">장표 분석</span><h3>{analysis.scope}</h3></div><ReviewBadge /></div>
          <p>{analysis.summary}</p>
          <div>{analysis.common.map((item) => <span key={item}>{item}</span>)}</div>
          <strong>수업 활용 제안</strong><p>{analysis.action}</p>
        </div>
      )}
    </div>
  );
}

function BoardLightbox({ item, onClose }) {
  return (
    <div className="board-lightbox" onClick={onClose}>
      <button onClick={onClose} aria-label="장표 전체화면 닫기">× 닫기</button>
      <div><h2>{item.by} 팀 장표</h2>{item.imageUrl && <img src={item.imageUrl} alt={`${item.by} 장표 전체화면`} />}</div>
    </div>
  );
}

function RoundView({ round, onReact }) {
  const participantLabel = (item) => round.anonymous ? "익명" : item.by;
  const typeBadge = round.anonymous ? " · 🙈 익명" : "";
  if (round.questionType === "objective") {
    const counts = (round.options || []).map((option) => ({
      option,
      count: round.items.filter((item) => item.choice === option || item.text === option).length,
    }));
    const max = Math.max(1, ...counts.map((item) => item.count));
    const diagnosis = analyzeQuestionResponses(round);
    const questionTypeLabel = "객관식";
    return (
      <div className="round objective-round">
        <div className="round-title"><span>{questionTypeLabel}{round.scope === "class" ? ` · ${round.classId?.replace("class-", "")}반` : " · 전체 반"}{typeBadge}</span><h3>{round.prompt}</h3><b>응답 {round.items.length}명</b></div>
        <details className="mobile-details"><summary>전체 응답과 분석 보기</summary>
        <div className="choice-results">{counts.map((item) => <div key={item.option}><div><span>{item.option}</span><b>{item.count}명</b></div><i><em style={{ width: `${item.count / max * 100}%` }} /></i></div>)}</div>
        <div className="question-diagnosis">
          <div className="diagnosis-stats"><Stat label="이해 양호 응답" value={`${diagnosis.good}건`} /><Stat label="오개념 가능 응답" value={`${diagnosis.misconception}건`} /><Stat label="추가 설명 필요" value={`${diagnosis.needHelp}건`} /></div>
          <div className="diagnosis-guidance"><span className="eyebrow">AI 추천 개입 문장</span><p>{diagnosis.intervention}</p><b>강사가 던질 후속 질문</b>{diagnosis.followups.map((question) => <div key={question}>“{question}”</div>)}</div>
        </div>
        </details>
      </div>
    );
  }
  const visibleItems = [...round.items].sort((a, b) => reactionScore(b) - reactionScore(a)).slice(0, 30);
  const diagnosis = analyzeQuestionResponses(round);
  const questionTypeLabel = "주관식";
  return (
    <div className="round">
      <div className="round-title"><span>{questionTypeLabel}{round.scope === "class" ? ` · ${round.classId?.replace("class-", "")}반` : " · 전체 반"}{typeBadge}</span><h3>{round.prompt}</h3><b>응답 {round.items.length}명</b></div>
      <details className="mobile-details"><summary>전체 응답 {round.items.length}건 보기</summary>
      <div className="response-wall-head"><b>전체 답변판</b><span>최대 30명의 답변을 한 화면에서 함께 봅니다.</span></div>
      <div className="response-wall">{visibleItems.map((item, index) => (
        <article className="response-wall-item" key={item.id}>
          <div className="response-meta"><b>{participantLabel(item)}</b><span>{new Date(item.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{index === 0 && reactionScore(item) > 0 && <em>공감 1위</em>}</div>
          <p>{item.text}</p>
          <button className="like-button" onClick={() => onReact(round.id, item.id, "agree")} aria-label={`${participantLabel(item)} 답변에 공감`}>
            <span>👍</span> 공감 <b>{item.reactions?.agree || 0}</b>
          </button>
        </article>
      ))}</div>
      {!visibleItems.length && <div className="board-empty">교육생 답변을 기다리고 있습니다.</div>}
      {round.items.length > 30 && <p className="response-limit-note">최근 공감순 30개를 표시하고 있습니다. 전체 응답 수는 {round.items.length}명입니다.</p>}
      <div className="question-diagnosis">
        <div className="diagnosis-stats"><Stat label="이해 양호 응답" value={`${diagnosis.good}건`} /><Stat label="오개념 가능 응답" value={`${diagnosis.misconception}건`} /><Stat label="추가 설명 필요" value={`${diagnosis.needHelp}건`} /></div>
        <div className="diagnosis-guidance"><span className="eyebrow">AI 추천 개입 문장</span><p>{diagnosis.intervention}</p><b>강사가 던질 후속 질문</b>{diagnosis.followups.map((question) => <div key={question}>“{question}”</div>)}</div>
      </div>
      </details>
    </div>
  );
}

function AIEvidenceResult({ result }) {
  return (
    <div className="ai-report">
      <div className="report-summary"><div className="ai-symbol">AI</div><div><div className="summary-head"><span>AI 요약</span><ReviewBadge /></div><p>{result.summary}</p></div></div>
      <div className="report-section"><h3>핵심 주제 묶음</h3><div className="cluster-grid">{result.clusters.map((c) => <article key={c.title}><div><b>{c.title}</b><span>{c.count}개 응답</span></div><p>{c.insight}</p></article>)}</div></div>
      <div className="report-section"><h3>근거 원문</h3><p className="section-desc">아래 원문 안에서만 분석했습니다.</p><div className="evidence-list">{result.evidence.map((e, i) => <blockquote key={i}><span>{sourceLabel(e.source)} · {e.by || "익명"}</span><p>“{e.quote}”</p></blockquote>)}</div></div>
      <div className="report-section actions-section"><h3>교수요원 행동 제안</h3><ol>{result.recommendedActions.map((x, i) => <li key={x}><b>{i + 1}</b><span>{x}</span></li>)}</ol></div>
      <div className="report-section followup-section"><h3>지금 던지면 좋은 후속 질문</h3>{result.followupQuestions.map((x) => <div key={x}>“{x}”</div>)}</div>
    </div>
  );
}

function DataList({ title, items, onAnalyze }) {
  return (
    <section className="content-card">
      <SectionTitle eyebrow="성과 데이터" title={`${title} ${items.length}건`} action={<button className="primary compact" onClick={onAnalyze}>AI 목표 분석</button>} />
      <details className="mobile-details data-list-details"><summary>교육생 응답 {items.length}건 보기</summary><div className="data-list">{items.map((x) => <article key={x.id}><div className="avatar">{(x.name || "익").slice(0, 1)}</div><div><b>{x.name || x.participantId} <em className="class-tag">{x.className || "1반"}</em></b><p>{x.text}</p><span>{new Date(x.createdAt).toLocaleString("ko-KR")}</span></div></article>)}</div></details>
    </section>
  );
}

function ClassFilterTabs({ classes, value, onChange }) {
  return (
    <div className="class-filter-tabs" aria-label="반별 데이터 필터">
      {classes.map((item) => <button key={item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}>{item.name}</button>)}
    </div>
  );
}

function CurrentClassNotice({ className, action }) {
  return <div className="current-class-notice"><b>{className}</b><span>현재 {className} 대상으로 {action}</span></div>;
}

function OverallCourseSummary({ course, compact = false }) {
  const questionResponses = course.rounds.filter((round) => round.kind === "poll").reduce((sum, round) => sum + round.items.length, 0);
  const boardUploads = course.rounds.filter((round) => round.kind === "board").reduce((sum, round) => sum + round.items.length, 0);
  return (
    <section className={`overall-course-summary ${compact ? "compact" : ""}`}>
      <div><span className="eyebrow">조회용 전체 요약</span><h3>과정 전체 현황</h3></div>
      <div className="overall-summary-grid">
        <Stat label="전체 목표 제출" value={`${course.goals.length}/${course.participantCount}명`} />
        <Stat label="전체 질문 응답" value={`${questionResponses}건`} />
        <Stat label="전체 장표 제출" value={`${boardUploads}건`} />
        <Stat label="전체 직무 회고" value={`${course.jobReflections.length}건`} />
      </div>
    </section>
  );
}

function ClassSubmissionSummary({ course }) {
  if ((course.classCount || 1) <= 1) return null;
  return (
    <div className="class-submission-summary">
      <h3>반별 제출 현황</h3>
      <div>{course.classes.map((item) => {
        const filtered = filterCourseByClass(course, item.id);
        const questionResponses = filtered.rounds.filter((round) => round.kind === "poll").reduce((sum, round) => sum + round.items.length, 0);
        const boardUploads = filtered.rounds.filter((round) => round.kind === "board").reduce((sum, round) => sum + round.items.length, 0);
        return <article key={item.id}><b>{item.name}</b><span>질문 {questionResponses}건</span><span>장표 {boardUploads}건</span><span>회고 {filtered.jobReflections.length}건</span><span>사후 {filtered.surveys.length}건</span></article>;
      })}</div>
    </div>
  );
}

function OCRResult({ result }) {
  return (
    <div className="ocr-result">
      <div className="ocr-head"><div className="ai-symbol">AI</div><div><span className="eyebrow">Mock OCR adapter</span><h3>{result.team} 분석 결과</h3></div><ReviewBadge /></div>
      <dl><div><dt>핵심 주장</dt><dd>{result.claim}</dd></div><div><dt>좋은 점</dt><dd>{result.strengths}</dd></div><div><dt>보완할 점</dt><dd>{result.improvements}</dd></div><div><dt>다른 팀과 공통점</dt><dd>{result.commonality}</dd></div><div><dt>발표 추천 순서</dt><dd>{result.order}</dd></div></dl>
    </div>
  );
}

function ReportFeedback({ feedback }) {
  const scoreLabels = {
    conclusionFirst: "결론 먼저",
    accuracy: "사실 정확성",
    cause: "원인 파악",
    actionPlan: "조치 계획",
    requestClarity: "요청사항 명확성",
    attitude: "태도와 표현",
  };
  return <div className="structured-feedback">
    <div className="recommend-head"><div className="ai-symbol">AI</div><div><span className="eyebrow">보고 피드백</span><h3>6개 기준 진단</h3></div><ReviewBadge /></div>
    <p>{feedback.summary}</p>
    <div className="report-score-grid">{Object.entries(feedback.scores).map(([key, score]) => <div key={key}><span>{scoreLabels[key]}</span><b>{score}/5</b><i><em style={{ width: `${score * 20}%` }} /></i></div>)}</div>
    <div className="first-fix"><b>가장 먼저 고칠 한 가지</b><p>{feedback.firstFix}</p></div>
  </div>;
}

function Progress({ steps }) {
  const complete = steps.filter(Boolean).length;
  return <div className="progress"><div><span>성과 여정</span><b>{complete}/4</b></div><div className="progress-track"><i style={{ width: `${complete * 25}%` }} /></div></div>;
}
function ActionPanel({ title, eyebrow, children }) { return <section className="action-panel"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{children}</section>; }
function PanelActions({ onBack, onSave, saveLabel }) { return <div className="panel-actions"><button className="ghost" onClick={onBack}>← 돌아가기</button>{onSave && <button className="primary" onClick={onSave}>{saveLabel}</button>}</div>; }
function SectionTitle({ eyebrow, title, action }) { return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>; }
function Stat({ label, value }) { return <div className="stat"><span>{label}</span><b>{value}</b></div>; }
function ReviewBadge() { return <span className="review-badge">교수요원 검토 필요</span>; }
function EmptyState({ title, action, onClick }) { return <div className="empty"><div>AI</div><h3>{title}</h3><button className="primary" onClick={onClick}>{action}</button></div>; }
function Toast({ children }) { return <div className="toast">{children}</div>; }
function PrivacyFooter() { return <footer className="privacy-footer">입장용 이름 외 고객정보·계좌정보·회사기밀 입력 금지 · AI 결과는 교수요원의 검토 후 활용하세요.</footer>; }
createRoot(document.getElementById("root")).render(<App />);
