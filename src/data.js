export const COURSE_CODE = "NH-2480";

// TODO: 로컬 시연 전용 값입니다. 실제 배포에서는 서버 인증으로 교체하고 클라이언트 코드에 비밀번호를 두지 않습니다.
export const ADMIN_PASSWORD = "nh1234";

export const courseTypes = {
  ideology: "통합 농협이념과정",
  leader: "직급별 이념과정",
  newbie: "신규직원과정",
  job: "직무과정",
};

export const courseCodeRanges = {
  ideology: 1000,
  leader: 2000,
  newbie: 3000,
  job: 4000,
};

export const reactionLabels = { agree: "공감" };

export const questionIntents = [
  { id: "general", label: "일반 의견형" },
  { id: "understanding", label: "이해 확인형" },
  { id: "misconception", label: "오개념 확인형" },
  { id: "application", label: "현장 적용형" },
  { id: "dilemma", label: "선택 갈등형" },
  { id: "emotion", label: "감정 반응형" },
];

export const goalQuestions = [
  "이번 교육에 참여하게 된 가장 큰 계기나 기대는 무엇인가요?",
  "현재 현업에서 가장 어렵거나 아쉽다고 느끼는 점은 무엇인가요?",
  "교육이 끝났을 때, 어떤 모습이 되어 있으면 ‘성공’이라고 느낄까요?",
];

export const achievementQuestions = [
  "입교 때 세운 목표를 떠올리면, 가장 크게 달라진 점은 무엇인가요?",
  "아직 부족하거나 더 연습이 필요한 부분은 무엇인가요?",
  "현업에 돌아가서 가장 먼저 시도해 볼 것은 무엇인가요?",
];

export const transferQuestions = [
  "교육에서 배운 내용을 실제 업무에 적용하고 있다.",
  "배운 내용을 업무에 적용하는 빈도가 높은 편이다.",
  "교육 내용이 실제 업무 성과(효율·정확성·고객응대 등) 향상에 도움이 되었다.",
  "앞으로도 배운 내용을 지속적으로 활용할 의향이 있다.",
  "배운 내용을 동료나 부서에 공유·전파한 적이 있다.",
];

export const transferBarriers = [
  "업무량·시간 부족",
  "상사·동료의 지원 부족",
  "적용 기회 부족",
  "교육 내용의 현업 적합성 부족",
  "추가 자료·도구 부족",
  "해당 없음(잘 적용함)",
];

export const promptTemplates = {
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

export const seedCourse = {
  schemaVersion: 1,
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
    { id: "s1", participantId: "s01", likert: [4, 4, 5], barriers: ["업무시간 부족"], applied: "민원 접수 후 처리 예상 시간을 먼저 안내했습니다.", support: "상황별 보고 문장 예시가 더 필요합니다.", createdAt: "2026-08-26T01:00:00.000Z" },
  ],
  missions: [
    { id: "m1", participantId: "s01", goalId: "g1", missionText: "조합원 응대 후 ‘가치 연결 메모’를 주 1회 남기기", dueDate: "2026-08-26", status: "assigned" },
  ],
  olympicActivityOpen: false,
};
