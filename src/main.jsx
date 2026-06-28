import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const COURSE_CODE = "NH-2480";
const STUDENT_ID = "student-demo";
const ADMIN_PASSWORD = "nh1234";
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const courseTypes = {
  ideology: "통합 농협이념과정",
  leader: "직급별 리더십과정",
  newbie: "신규직원과정",
  job: "직무과정",
};
const courseCodeRanges = {
  ideology: 1000,
  leader: 2000,
  newbie: 3000,
  job: 4000,
};

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCoursePhase(course) {
  const today = todayInKorea();
  if (today < course.startDate) return "before";
  if (today > course.endDate) return "after";
  return "during";
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

const reactionLabels = {
  agree: "공감해요",
  curious: "저도 궁금해요",
  experienced: "현업에서 겪었어요",
  explain: "강사님 설명 필요",
};

const seedCourse = {
  code: COURSE_CODE,
  type: "newbie",
  name: "2026 신규직원 농협이념·현장실무 과정",
  cohort: "제24기",
  startDate: "2026-06-24",
  endDate: "2026-06-26",
  createdAt: "2026-06-01T09:00:00.000Z",
  templateId: "newbie-v3",
  privacyNoticeAccepted: true,
  participantCount: 24,
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
  rounds: [
    {
      id: "r1",
      kind: "poll",
      prompt: "현장에서 실수를 발견했을 때 가장 먼저 해야 할 행동은 무엇인가요?",
      createdAt: "2026-06-24T01:00:00.000Z",
      items: [
        { id: "ri1", by: "교육생 03", text: "사실관계를 빠르게 확인하고 바로 상급자에게 보고합니다.", reactions: { agree: 7, curious: 1, experienced: 3, explain: 0 }, createdAt: "2026-06-24T01:02:00.000Z" },
        { id: "ri2", by: "교육생 11", text: "혼날까 봐 숨기기보다 영향 범위를 먼저 공유해야 합니다.", reactions: { agree: 9, curious: 2, experienced: 6, explain: 2 }, createdAt: "2026-06-24T01:03:00.000Z" },
        { id: "ri3", by: "교육생 17", text: "고객이나 조합원에게 피해가 있는지 확인하고 조치 순서를 정합니다.", reactions: { agree: 5, curious: 4, experienced: 2, explain: 1 }, createdAt: "2026-06-24T01:04:00.000Z" },
      ],
    },
    {
      id: "r2",
      kind: "board",
      prompt: "우리 팀이 정의한 ‘신뢰받는 농협인’의 행동 원칙",
      createdAt: "2026-06-24T02:00:00.000Z",
      items: [
        { id: "bi1", by: "초록팀", text: "모르면 확인하고, 실수는 즉시 공유하며, 조합원에게 처리 과정을 설명한다.", reactions: { agree: 6, curious: 1, experienced: 2, explain: 0 }, createdAt: "2026-06-24T02:12:00.000Z" },
        { id: "bi2", by: "한마음팀", text: "규정을 지키는 데서 멈추지 않고 조합원에게 실제 도움이 되었는지 확인한다.", reactions: { agree: 8, curious: 3, experienced: 4, explain: 1 }, createdAt: "2026-06-24T02:15:00.000Z" },
      ],
    },
  ],
  surveys: [
    { id: "s1", participantId: "s01", likert: [4, 4, 5], barriers: ["업무시간 부족"], applied: "민원 접수 후 처리 예상 시간을 먼저 안내했습니다.", support: "상황별 보고 문장 예시가 더 필요합니다.", createdAt: "2026-08-26T01:00:00.000Z" },
  ],
  missions: [
    { id: "m1", participantId: "s01", goalId: "g1", missionText: "조합원 응대 후 ‘가치 연결 메모’를 주 1회 남기기", dueDate: "2026-08-26", status: "assigned" },
  ],
};

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

function loadCourse() {
  try {
    const saved = localStorage.getItem("nongsim-course-v3");
    return saved ? { ...seedCourse, ...JSON.parse(saved) } : seedCourse;
  } catch {
    return seedCourse;
  }
}

function loadCourses() {
  try {
    const saved = localStorage.getItem("nongsim-courses-v3");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    return [loadCourse()];
  } catch {
    return [seedCourse];
  }
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const presetRole = params.get("role");
  const presetCode = params.get("code") || "";
  const [courses, setCourses] = useState(loadCourses);
  const [course, setCourseState] = useState(() => {
    const savedCourses = loadCourses();
    return savedCourses.find((item) => item.code === presetCode.toUpperCase()) || savedCourses[0];
  });
  const [role, setRole] = useState(() => {
    const matched = loadCourses().some((item) => item.code === presetCode.toUpperCase());
    return presetRole === "student" && matched ? "student" : presetRole === "professor" && matched ? "professor" : null;
  });
  const [code, setCode] = useState(presetCode);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [toast, setToast] = useState("");
  const [showProfessorLogin, setShowProfessorLogin] = useState(false);
  const [professorPassword, setProfessorPassword] = useState("");
  const [professorStartTab, setProfessorStartTab] = useState("dashboard");

  useEffect(() => {
    localStorage.setItem("nongsim-course-v3", JSON.stringify(course));
  }, [course]);

  useEffect(() => {
    localStorage.setItem("nongsim-courses-v3", JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    const syncCourses = (event) => {
      if (event.key !== "nongsim-courses-v3" || !event.newValue) return;
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

  const enter = (nextRole) => {
    const enteredCode = code.trim().toUpperCase();
    if (nextRole === "professor" && !enteredCode) {
      setShowProfessorLogin(true);
      return;
    }
    if (!privacyAccepted) {
      setToast("개인정보·회사기밀 입력 금지 안내를 확인해주세요.");
      return;
    }
    const matchedCourse = courses.find((item) => item.code === enteredCode);
    if (!matchedCourse) {
      setToast("해당 과정 코드를 찾을 수 없습니다. 발급받은 코드를 다시 확인해주세요.");
      return;
    }
    selectCourse(matchedCourse);
    setProfessorStartTab("dashboard");
    setRole(nextRole);
  };

  const enterProfessorAdmin = () => {
    if (!privacyAccepted) {
      setToast("개인정보·회사기밀 입력 금지 안내를 확인해주세요.");
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

  if (!role) {
    return (
      <div className="entry-shell">
        <main className="entry-card">
          <Brand />
          <a className="academy-link" href="https://nh-gurye-edu.vercel.app/" target="_blank" rel="noreferrer">
            농협교육원 통합관리앱 <span>↗</span>
          </a>
          <div className="entry-copy">
            <span className="eyebrow">AI 교육 평가·전이 관리 에이전트</span>
            <h1>교육의 순간을<br />현장의 변화로 연결합니다.</h1>
            <p>목표부터 수료 성찰, 2개월 후 현업 적용까지 하나의 데이터 흐름으로 확인하세요.</p>
          </div>
          <label className="field">
            <span>과정 코드</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NH-2480" />
          </label>
          <label className="privacy-check">
            <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
            <span><b>입력 전 확인</b><br />개인정보, 고객정보, 계좌정보 및 회사기밀은 입력하지 않습니다.</span>
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
        ? <StudentApp course={course} setCourse={setCourse} onExit={() => setRole(null)} notify={setToast} />
        : <ProfessorApp course={course} setCourse={setCourse} courses={courses} onSelectCourse={selectCourse} onUpdateCourse={updateRegisteredCourse} onDeleteCourse={deleteRegisteredCourse} initialTab={professorStartTab} onExit={() => setRole(null)} notify={setToast} />}
      {toast && <Toast>{toast}</Toast>}
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

function StudentApp({ course, setCourse, onExit, notify }) {
  const myGoal = course.goals.find((goal) => goal.participantId === STUDENT_ID);
  const myAchievement = course.achievements.find((item) => item.participantId === STUDENT_ID);
  const mySurvey = course.surveys.find((item) => item.participantId === STUDENT_ID);
  const activeRound = course.rounds.find((round) => round.kind === "poll" && !round.items.some((item) => item.participantId === STUDENT_ID));
  const boardRounds = course.rounds.filter((round) => round.kind === "board");
  const [view, setView] = useState("home");
  const [goalDraft, setGoalDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [reflection, setReflection] = useState("");
  const [survey, setSurvey] = useState({ applied: "", support: "", likert: 4 });
  const [goalJustCompleted, setGoalJustCompleted] = useState(false);
  const phase = getCoursePhase(course);
  const [phaseTab, setPhaseTab] = useState(phase);

  useEffect(() => {
    setPhaseTab(phase);
    setView("home");
  }, [phase, course.code]);

  const stage = phase === "before"
    ? (!myGoal ? "goal" : "done")
    : phase === "during"
      ? (activeRound && !activeRound.items.some((x) => x.by === "나") ? "poll" : "done")
      : (!myAchievement ? "achievement" : !mySurvey ? "survey" : "done");
  const nextMission = {
    goal: { title: "나의 교육 목표를 세워주세요", desc: "AI가 구체적인 실천 목표로 다듬어 드립니다.", cta: "나의 교육 목표 작성하기", target: "goal" },
    poll: { title: "강사의 실시간 질문에 답해주세요", desc: activeRound?.prompt, cta: "강사 질문에 답하기", target: "poll" },
    achievement: { title: "배움과 목표 달성도를 돌아보세요", desc: "교육 전 목표와 연결해 수료 성찰을 남겨주세요.", cta: "목표 달성도 작성하기", target: "achievement" },
    survey: { title: "현업 적용 경험을 알려주세요", desc: "교육이 실제 업무 행동으로 이어졌는지 확인합니다.", cta: "현업 적용도 응답하기", target: "survey" },
    done: { title: "이번 과정의 응답을 모두 완료했어요", desc: "남은 현업 미션을 꾸준히 실천해보세요.", cta: "나의 현업 미션 보기", target: "mission" },
  }[stage];
  const mission = goalJustCompleted
    ? { title: "교육 목표 작성을 완료했어요", desc: "목표가 상단 카드에 저장되었습니다. 이제 강사의 실시간 질문에 참여해보세요.", cta: "다음 미션 확인하기", target: "home" }
    : nextMission;

  const saveGoal = () => {
    if (goalDraft.trim().length < 8) return notify("목표를 조금 더 구체적으로 작성해주세요.");
    const refined = goalDraft.trim().endsWith("겠습니다.") ? goalDraft.trim() : `${goalDraft.trim().replace(/[.!]$/, "")}하겠습니다.`;
    setCourse((c) => ({ ...c, goals: [...c.goals, { id: uid("goal"), participantId: STUDENT_ID, name: "나", text: refined, createdAt: now() }] }));
    setGoalDraft("");
    setGoalJustCompleted(true);
    setView("home");
    notify("교육 목표가 저장되었습니다. 오늘의 미션도 완료 처리됐어요.");
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
          participantId: STUDENT_ID,
          by: "나",
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
    if (reflection.trim().length < 8) return notify("배운 점과 달라진 행동을 작성해주세요.");
    const achievement = { id: uid("ach"), participantId: STUDENT_ID, text: reflection.trim(), createdAt: now() };
    const missionItem = { id: uid("mission"), participantId: STUDENT_ID, goalId: myGoal.id, missionText: `${myGoal.text.replace("하겠습니다.", "")} 실천 사례를 주 1회 기록하기`, dueDate: "2026-08-26", status: "assigned" };
    setCourse((c) => ({ ...c, achievements: [...c.achievements, achievement], missions: [...c.missions, missionItem] }));
    setReflection("");
    setView("home");
    notify("수료 성찰과 현업 미션이 생성되었습니다.");
  };

  const saveSurvey = () => {
    if (!survey.applied.trim()) return notify("현업 적용 사례를 작성해주세요.");
    setCourse((c) => ({ ...c, surveys: [...c.surveys, { id: uid("survey"), participantId: STUDENT_ID, likert: [survey.likert, survey.likert, survey.likert], barriers: [], applied: survey.applied, support: survey.support, createdAt: now() }] }));
    setView("home");
    notify("현업 적용도 응답을 완료했습니다.");
  };

  return (
    <main className="page student-page">
      <PageBack onClick={() => view === "home" ? onExit() : setView("home")} />
      <section className="course-hero">
        <div>
          <span className="eyebrow">오늘의 학습 여정</span>
          <div className="course-title-row">
            <h1>{course.name}</h1>
            {course.type === "ideology" && <OlympicsLink />}
          </div>
          <p>{courseTypes[course.type]}{course.leadershipGrade ? ` · ${course.leadershipGrade}` : ""} · {course.cohort} · {course.startDate} ~ {course.endDate}</p>
        </div>
        <Progress steps={[!!myGoal, course.rounds.some((round) => round.kind === "poll" && round.items.some((item) => item.participantId === STUDENT_ID)), !!myAchievement, !!mySurvey]} />
      </section>
      <StudentPhaseTabs phase={phase} selected={phaseTab} onSelect={(next) => {
        if (next !== phase) return notify("현재 교육기간에 해당하는 단계만 이용할 수 있습니다.");
        setPhaseTab(next);
        setView("home");
      }} />
      <StudentGoalCard goal={myGoal} onWrite={() => setView("goal")} />
      {view === "home" && <StudentMissionCard mission={mission} completed={goalJustCompleted || stage === "done"} onAction={() => {
        if (goalJustCompleted) setGoalJustCompleted(false);
        else setView(mission.target);
      }} />}
      {view === "goal" && (
        <ActionPanel title="나의 교육 목표" eyebrow="입교 전 목표">
          <p className="helper">이번 교육을 통해 현업에서 어떤 행동을 달라지게 만들고 싶은가요?</p>
          <textarea value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} placeholder="예: 민원 상황에서도 사실과 조치 계획을 빠르게 보고..." />
          <div className="ai-suggestion"><span>AI 작성 도움</span><p>행동, 적용 장면, 기대 결과가 드러나도록 작성하면 좋아요.</p></div>
          <PanelActions onBack={() => setView("home")} onSave={saveGoal} saveLabel="목표 저장하기" />
        </ActionPanel>
      )}
      {view === "poll" && (
        <ActionPanel title="강사 질문에 답하기" eyebrow="실시간 참여">
          <div className="question-box">{activeRound.prompt}</div>
          {activeRound.questionType === "objective"
            ? <div className="student-choice-list">{activeRound.options.map((option) => <button key={option} className={selectedChoice === option ? "selected" : ""} onClick={() => setSelectedChoice(option)}>{option}</button>)}</div>
            : <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="정답보다 현장의 생각을 솔직하게 적어주세요." />}
          <PanelActions onBack={() => setView("home")} onSave={submitAnswer} saveLabel="답변 제출하기" />
        </ActionPanel>
      )}
      {phase === "during" && view === "home" && (
        <StudentBoardArea rounds={boardRounds} course={course} setCourse={setCourse} notify={notify} />
      )}
      {view === "achievement" && (
        <ActionPanel title="목표 달성도 작성" eyebrow="수료 성찰">
          <div className="linked-goal"><span>교육 전 나의 목표</span><p>{myGoal?.text}</p></div>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="교육을 통해 이해하거나 연습한 것, 앞으로 실천할 행동..." />
          <PanelActions onBack={() => setView("home")} onSave={saveAchievement} saveLabel="성찰 저장하기" />
        </ActionPanel>
      )}
      {view === "survey" && (
        <ActionPanel title="현업 적용도 응답" eyebrow="교육 2개월 후">
          <label className="field"><span>교육 내용이 업무에 얼마나 적용됐나요? <b>{survey.likert}점</b></span><input type="range" min="1" max="5" value={survey.likert} onChange={(e) => setSurvey({ ...survey, likert: Number(e.target.value) })} /></label>
          <label className="field"><span>실제 적용 사례</span><textarea value={survey.applied} onChange={(e) => setSurvey({ ...survey, applied: e.target.value })} placeholder="어떤 상황에서 무엇을 다르게 했나요?" /></label>
          <label className="field"><span>추가로 필요한 지원</span><textarea value={survey.support} onChange={(e) => setSurvey({ ...survey, support: e.target.value })} placeholder="자료, 코칭, 제도 등 필요한 지원" /></label>
          <PanelActions onBack={() => setView("home")} onSave={saveSurvey} saveLabel="응답 완료하기" />
        </ActionPanel>
      )}
      {view === "mission" && (
        <ActionPanel title="나의 현업 미션" eyebrow="전이 관리">
          {course.missions.filter((m) => m.participantId === STUDENT_ID).map((m) => <div className="mission-item" key={m.id}><span>{m.status === "done" ? "완료" : "진행 중"}</span><h3>{m.missionText}</h3><p>완료 예정일 {m.dueDate}</p></div>)}
          <PanelActions onBack={() => setView("home")} />
        </ActionPanel>
      )}
      <PrivacyFooter />
    </main>
  );
}

function StudentGoalCard({ goal, onWrite }) {
  return (
    <section className="goal-card">
      <div className="goal-icon">◎</div>
      <div><span>나의 이번 교육 목표</span>{goal ? <p>{goal.text}</p> : <p className="muted">아직 목표를 작성하지 않았어요.</p>}</div>
      {!goal && <button onClick={onWrite}>작성</button>}
    </section>
  );
}

function StudentMissionCard({ mission, completed, onAction }) {
  return (
    <section className={`mission-card ${completed ? "complete" : ""}`}>
      <div className="mission-top"><span className="eyebrow">오늘 할 일</span><span className="status-pill">{completed ? "✓ 완료" : "● 미완료"}</span></div>
      <div className="mission-orb">{completed ? "✓" : "01"}</div>
      <h2>{mission.title}</h2>
      <p>{mission.desc}</p>
      <button className="primary large" onClick={onAction}>{mission.cta}<span>→</span></button>
    </section>
  );
}

function StudentPhaseTabs({ phase, selected, onSelect }) {
  const tabs = [
    ["before", "입교 전", "교육 시작일 이전"],
    ["during", "교육 중", "교육 시작일~종료일"],
    ["after", "교육 후", "교육 종료일 이후"],
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

function StudentBoardArea({ rounds, setCourse, notify }) {
  const [teamNames, setTeamNames] = useState({});
  const upload = (round, file) => {
    if (!file) return;
    const team = (teamNames[round.id] || "").trim();
    if (!team) return notify("팀명을 먼저 입력해주세요.");
    const reader = new FileReader();
    reader.onload = () => {
      setCourse((current) => ({
        ...current,
        rounds: current.rounds.map((item) => item.id === round.id ? {
          ...item,
          items: [...item.items, {
            id: uid("board"),
            participantId: STUDENT_ID,
            by: team,
            imageUrl: reader.result,
            text: `${team} 장표 업로드`,
            reactions: {},
            createdAt: now(),
          }],
        } : item),
      }));
      notify(`${round.prompt}에 ${team} 장표를 업로드했습니다.`);
    };
    reader.readAsDataURL(file);
  };
  if (!rounds.length) return null;
  return (
    <section className="student-board-area">
      <div className="section-title">
        <div><span className="eyebrow">팀 활동</span><h2>모듈별 장표 업로드</h2></div>
      </div>
      <div className="student-board-modules">
        {rounds.map((round) => {
          const mine = round.items.find((item) => item.participantId === STUDENT_ID);
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
  return <button className="page-back" onClick={onClick}>← 바로 이전</button>;
}

function ProfessorApp({ course, setCourse, courses, onSelectCourse, onUpdateCourse, onDeleteCourse, initialTab, onExit, notify }) {
  const [tab, setTab] = useState(initialTab || "dashboard");
  const [analysis, setAnalysis] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState("민원 발생 보고");
  const [difficulty, setDifficulty] = useState("보통");
  const [roleplayText, setRoleplayText] = useState("");
  const [roleplayFeedback, setRoleplayFeedback] = useState("");
  const [pushStatus, setPushStatus] = useState("idle");
  const [questionDraft, setQuestionDraft] = useState({ type: "subjective", prompt: "", options: ["", ""] });
  const [boardModule, setBoardModule] = useState({ title: "", description: "" });
  const [selectedBoardRound, setSelectedBoardRound] = useState("");
  const [expandedBoard, setExpandedBoard] = useState(null);
  const [boardAnalysis, setBoardAnalysis] = useState(null);
  const [newCourse, setNewCourse] = useState({
    type: "ideology",
    name: "",
    leadershipGrade: "M급",
    startDate: todayInKorea(),
    endDate: todayInKorea(),
  });
  const [issuedCode, setIssuedCode] = useState("");
  const pushTimer = useRef(null);

  useEffect(() => {
    if (course.type !== "newbie" && tab === "roleplay") setTab("dashboard");
  }, [course.type, tab]);

  const navigate = (target) => setTab(target);
  const runAnalysis = (kind = "all") => {
    setAnalysis(buildAnalysis(course, kind));
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
        prompt: questionDraft.prompt.trim(),
        options: questionDraft.type === "objective" ? options : [],
        items: [],
        createdAt: now(),
      }],
    }));
    setQuestionDraft({ type: "subjective", prompt: "", options: ["", ""] });
    notify("교육생에게 실시간 질문을 열었습니다.");
  };

  const createBoardModule = () => {
    if (!boardModule.title.trim()) return notify("장표 업로드 모듈명을 입력해주세요.");
    const created = {
      id: uid("board"),
      kind: "board",
      prompt: boardModule.title.trim(),
      description: boardModule.description.trim(),
      items: [],
      createdAt: now(),
    };
    setCourse((current) => ({ ...current, rounds: [...current.rounds, created] }));
    setSelectedBoardRound(created.id);
    setBoardModule({ title: "", description: "" });
    notify("교육생 장표 업로드 탭을 생성했습니다.");
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

  const runRoleplay = () => {
    if (!roleplayText.trim()) return notify("보고 내용을 먼저 입력해주세요.");
    const tone = difficulty === "어려움" ? "꼬리질문에 대비해 수치와 영향 범위를 더 명확히 하세요." : difficulty === "보통" ? "바쁜 상사가 바로 판단할 수 있게 첫 문장을 더 짧게 만드세요." : "핵심 구조가 좋습니다. 조치 완료 시점까지 덧붙여보세요.";
    setRoleplayFeedback(`상황: ${selectedScenario}. 사실 → 영향 → 현재 조치 → 요청 순서로 재구성하면 좋습니다. ${tone}`);
  };

  const startPushDemo = () => {
    clearTimeout(pushTimer.current);
    setPushStatus("waiting");
    pushTimer.current = setTimeout(() => setPushStatus("arrived"), 10000);
    notify("10초 뒤 사후조사 알림이 도착합니다.");
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
      cohort: "신규 과정",
      leadershipGrade: newCourse.type === "leader" ? newCourse.leadershipGrade : undefined,
      startDate: newCourse.startDate,
      endDate: newCourse.endDate,
      createdAt: now(),
      templateId: `${newCourse.type}-v3`,
      goals: [],
      achievements: [],
      rounds: seedCourse.rounds.map((round) => ({ ...round, items: [] })),
      surveys: [],
      missions: [],
    };
    setCourse(created);
    setIssuedCode(code);
    setNewCourse((current) => ({ ...current, name: "" }));
    notify(`${code} 과정 코드가 발급되었습니다.`);
  };

  const professorTabs = [
    ["dashboard", "관제판"], ["goals", "목표"], ["live", "실시간 질문"], ["board", "팀 장표"],
    ["ai", "AI 분석"],
    ...(course.type === "newbie" ? [["roleplay", "보고 훈련"]] : []),
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
              {course.type === "ideology" && <OlympicsLink />}
            </div>
            <p>{courseTypes[course.type]}{course.leadershipGrade ? ` · ${course.leadershipGrade}` : ""} · {course.cohort} · {course.startDate} ~ {course.endDate}</p>
          </div>
          <div className="course-head-actions"><span className={`phase-badge ${getCoursePhase(course)}`}>{({ before: "입교 전", during: "교육 중", after: "교육 후" })[getCoursePhase(course)]}</span><QRJoinCard code={course.code} notify={notify} /></div>
        </section>}
        {tab === "create" && <CourseRegistrationForm value={newCourse} onChange={setNewCourse} onSubmit={registerCourse} issuedCode={issuedCode} course={course} courses={courses} onSelectCourse={(selected) => { onSelectCourse(selected); setTab("dashboard"); }} onUpdateCourse={onUpdateCourse} onDeleteCourse={onDeleteCourse} notify={notify} />}
        {tab === "dashboard" && <ProfessorDashboard course={course} onNavigate={navigate} onAnalyze={() => { runAnalysis(); setTab("ai"); }} />}
        {tab === "goals" && <DataList title="입교 전 목표" items={course.goals} onAnalyze={() => { runAnalysis("goals"); setTab("ai"); }} />}
        {tab === "live" && (
          <section className="content-card">
            <SectionTitle eyebrow="실시간 참여" title="교육생 질문 생성과 응답 현황" action={<button className="primary compact" onClick={() => { runAnalysis("poll"); setTab("ai"); }}>AI로 묶기</button>} />
            <QuestionComposer value={questionDraft} onChange={setQuestionDraft} onSubmit={createQuestion} />
            {course.rounds.filter((r) => r.kind === "poll").map((round) => <RoundView key={round.id} round={round} onReact={react} />)}
          </section>
        )}
        {tab === "board" && (
          <section className="content-card">
            <SectionTitle eyebrow="팀 학습" title="모듈별 장표 발표·AI 분석" />
            <BoardModuleCreator value={boardModule} onChange={setBoardModule} onSubmit={createBoardModule} />
            <ProfessorBoardGallery
              rounds={course.rounds.filter((round) => round.kind === "board")}
              selectedId={selectedBoardRound}
              onSelect={setSelectedBoardRound}
              onExpand={setExpandedBoard}
              onAnalyze={analyzeBoards}
              analysis={boardAnalysis}
            />
          </section>
        )}
        {tab === "ai" && (
          <section className="content-card">
            <SectionTitle eyebrow="근거 기반 분석" title="AI 교육 분석 리포트" action={<button className="primary compact" onClick={() => runAnalysis()}>분석 새로고침</button>} />
            {analysis ? <AIEvidenceResult result={analysis} /> : <EmptyState title="아직 생성된 분석이 없습니다." action="전체 응답 분석하기" onClick={() => runAnalysis()} />}
          </section>
        )}
        {tab === "roleplay" && course.type === "newbie" && (
          <section className="content-card">
            <SectionTitle eyebrow="신규직원과정" title="AI 보고 롤플레잉" />
            <div className="scenario-grid">
              {["민원 발생 보고", "시재 차이 보고", "조합원 항의 보고", "경제사업 사고 위험 보고", "상사 부재 중 긴급 보고"].map((x) => <button className={selectedScenario === x ? "selected" : ""} key={x} onClick={() => setSelectedScenario(x)}>{x}</button>)}
            </div>
            <div className="difficulty-row">{[["쉬움", "친절한 팀장"], ["보통", "바쁜 팀장"], ["어려움", "꼬리질문 많은 팀장"]].map(([level, desc]) => <button className={difficulty === level ? "selected" : ""} onClick={() => setDifficulty(level)} key={level}><b>{level}</b><span>{desc}</span></button>)}</div>
            <div className="roleplay-box">
              <div className="manager-bubble"><b>{difficulty} 팀장</b><p>{selectedScenario} 상황이군요. 지금 무슨 일이 있었고 제가 무엇을 결정해야 합니까?</p></div>
              <textarea value={roleplayText} onChange={(e) => setRoleplayText(e.target.value)} placeholder="30초 안에 보고한다는 마음으로 작성하세요." />
              <button className="primary" onClick={runRoleplay}>AI 팀장에게 보고하기</button>
            </div>
            {roleplayFeedback && <div className="feedback-box"><ReviewBadge /><h3>코칭 피드백</h3><p>{roleplayFeedback}</p></div>}
          </section>
        )}
        {tab === "transfer" && (
          <section className="content-card">
            <SectionTitle eyebrow="교육 이후" title="현업 전이 관리와 성과 내보내기" />
            <div className="transfer-stats"><Stat label="현업 미션" value={`${course.missions.length}건`} /><Stat label="사후 응답" value={`${course.surveys.length}/${course.participantCount}`} /><Stat label="평균 적용도" value={`${averageLikert(course.surveys)}점`} /></div>
            <div className="push-demo">
              <div><span className="eyebrow">예약 푸시 데모</span><h3>교육 종료 후 사후조사 알림</h3><p>버튼을 누르면 10초 뒤 교육생에게 알림이 도착합니다.</p></div>
              <button className="secondary" disabled={pushStatus === "waiting"} onClick={startPushDemo}>{pushStatus === "waiting" ? "알림 예약됨…" : "10초 데모 시작"}</button>
            </div>
            {pushStatus === "arrived" && <div className="notification"><span>농심튜터</span><b>교육 후 현업 적용 경험을 들려주세요</b><p>2개월 전 세운 목표가 업무에서 어떻게 이어졌나요?</p></div>}
            <div className="export-row">
              <div><h3>과정 성과 리포트</h3><p>목표·참여·성찰·현업 적용 데이터를 한 번에 내보냅니다.</p></div>
              <div><button className="secondary" onClick={() => downloadReport(course, "json")}>JSON 다운로드</button><button className="primary" onClick={() => downloadReport(course, "csv")}>CSV 다운로드</button></div>
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
        <button className="primary" onClick={onAnalyze}>AI 전체 분석 보기</button>
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
      <section className="flow-card">
        <h3>교육 성과 데이터 흐름</h3>
        <div className="flow-steps">{["입교 전 목표", "교육 중 참여", "수료 성찰", "현업 미션", "2개월 후 적용"].map((x, i) => <React.Fragment key={x}><div><b>{i + 1}</b><span>{x}</span></div>{i < 4 && <i>→</i>}</React.Fragment>)}</div>
      </section>
    </>
  );
}

function QRJoinCard({ code, notify }) {
  const [open, setOpen] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?role=student&code=${code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); notify("교육생 입장 링크를 복사했습니다."); }
    catch { notify(`링크: ${link}`); }
  };
  return (
    <div className="qr-wrap">
      <button className="qr-button" onClick={() => setOpen(!open)}><span>▦</span> QR 입장</button>
      {open && <div className="qr-popover"><MockQR value={link} /><b>교육생 바로 입장</b><p>{code}</p><button className="primary compact" onClick={copy}>링크 복사</button></div>}
    </div>
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
      .filter((item) => listTab === "archive" ? getCoursePhase(item) === "after" : getCoursePhase(item) !== "after")
      .filter((item) => !query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query))
      .filter((item) => yearFilter === "all" || item.startDate?.startsWith(yearFilter))
      .filter((item) => typeFilter === "all" || item.type === typeFilter)
      .filter((item) => statusFilter === "all" || getCoursePhase(item) === statusFilter)
      .sort((a, b) => {
        const phaseOrder = { during: 0, before: 1, after: 2 };
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
      <p className="section-desc">과정명, 유형과 교육기간을 지정하면 교육생 입장 코드가 즉시 발급됩니다.</p>
      <div className="code-rule-note">
        코드 규칙 · 농협이념 NH-1001~ · 리더십 NH-2001~ · 신규직원 NH-3001~ · 직무 NH-4001~
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
      <label className="field course-name-field">
        <span>2. 과정명</span>
        <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="예: 2026 직급별 리더십과정 3급 2기" />
        <small>연간 여러 기수를 쉽게 구분할 수 있도록 연도·직급·기수를 함께 적어주세요.</small>
      </label>
      {value.type === "leader" && (
        <div className="leadership-grade-field">
          <span>리더십 대상 직급</span>
          <div>
            {["M급", "3급", "4급", "5급"].map((grade) => (
              <button key={grade} className={value.leadershipGrade === grade ? "selected" : ""} onClick={() => onChange({ ...value, leadershipGrade: grade })}>{grade}</button>
            ))}
          </div>
        </div>
      )}
      <div className="date-range-grid">
        <label className="field"><span>교육 시작일</span><input type="date" value={value.startDate} onChange={(e) => onChange({ ...value, startDate: e.target.value })} /></label>
        <div className="date-arrow">→</div>
        <label className="field"><span>교육 종료일</span><input type="date" value={value.endDate} min={value.startDate} onChange={(e) => onChange({ ...value, endDate: e.target.value })} /></label>
      </div>
      <button className="primary create-course-button" onClick={onSubmit}>과정 등록 및 코드 발급</button>
      {issuedCode && (
        <div className="issued-code-card">
          <div><span>발급 완료</span><h3>{course.code}</h3><p>{courseTypes[course.type]} · {course.startDate} ~ {course.endDate}</p></div>
          <div>
            <button className="secondary" onClick={copyCode}>코드 복사</button>
            {course.type === "ideology" && <OlympicsLink />}
          </div>
        </div>
      )}
      <div className="registered-courses">
        <div className="registered-heading">
          <div><h3>등록된 과정</h3><p>운영 중·예정 과정만 기본 표시하며 종료 과정은 보관함에서 확인합니다.</p></div>
          <span>전체 {courses.length}개</span>
        </div>
        <div className="course-list-tabs">
          <button className={listTab === "active" ? "active" : ""} onClick={() => setListTab("active")}>운영·예정 <b>{courses.filter((item) => getCoursePhase(item) !== "after").length}</b></button>
          <button className={listTab === "archive" ? "active" : ""} onClick={() => setListTab("archive")}>종료 과정 보관함 <b>{courses.filter((item) => getCoursePhase(item) === "after").length}</b></button>
        </div>
        <div className="course-list-controls">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="과정명 또는 코드 검색" />
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
            <option value="during">운영 중</option>
            {listTab === "archive" && <option value="after">종료</option>}
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
                <span><b>{item.name}</b><small>{courseTypes[item.type]}{item.leadershipGrade ? ` · ${item.leadershipGrade}` : ""} · {item.startDate} ~ {item.endDate}</small></span>
                <div><em className={`course-status ${getCoursePhase(item)}`}>{({ before: "예정", during: "운영 중", after: "종료" })[getCoursePhase(item)]}</em><strong>{item.code}</strong></div>
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
            <div className="modal-head"><div><span className="eyebrow">과정 정보 수정</span><h3>{editingCourse.code}</h3></div><button onClick={() => setEditingCourse(null)}>×</button></div>
            <label className="field"><span>과정명</span><input value={editingCourse.name} onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })} /></label>
            <div className="readonly-course-type"><span>과정 유형</span><b>{courseTypes[editingCourse.type]}</b><small>코드 체계 유지를 위해 과정 유형은 변경할 수 없습니다.</small></div>
            {editingCourse.type === "leader" && <div className="leadership-grade-field"><span>리더십 대상 직급</span><div>{["M급", "3급", "4급", "5급"].map((grade) => <button key={grade} className={editingCourse.leadershipGrade === grade ? "selected" : ""} onClick={() => setEditingCourse({ ...editingCourse, leadershipGrade: grade })}>{grade}</button>)}</div></div>}
            <div className="date-range-grid">
              <label className="field"><span>교육 시작일</span><input type="date" value={editingCourse.startDate} onChange={(e) => setEditingCourse({ ...editingCourse, startDate: e.target.value })} /></label>
              <div className="date-arrow">→</div>
              <label className="field"><span>교육 종료일</span><input type="date" min={editingCourse.startDate} value={editingCourse.endDate} onChange={(e) => setEditingCourse({ ...editingCourse, endDate: e.target.value })} /></label>
            </div>
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

function MockQR({ value }) {
  const size = 21;
  const bits = useMemo(() => Array.from({ length: size * size }, (_, i) => {
    const x = i % size, y = Math.floor(i / size);
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (finder) return x % 6 !== 1 && y % 6 !== 1 || (x % 6 >= 2 && x % 6 <= 4 && y % 6 >= 2 && y % 6 <= 4);
    const char = value.charCodeAt(i % value.length);
    return (char + x * 3 + y * 5 + x * y) % 3 === 0;
  }), [value]);
  return <svg className="mock-qr" viewBox={`0 0 ${size} ${size}`} aria-label="교육생 입장 QR 코드">{bits.map((on, i) => on ? <rect key={i} x={i % size} y={Math.floor(i / size)} width="1" height="1" /> : null)}</svg>;
}

function QuestionComposer({ value, onChange, onSubmit }) {
  const updateOption = (index, text) => onChange({ ...value, options: value.options.map((item, i) => i === index ? text : item) });
  return (
    <div className="question-composer">
      <div className="composer-type">
        <button className={value.type === "subjective" ? "selected" : ""} onClick={() => onChange({ ...value, type: "subjective" })}>주관식</button>
        <button className={value.type === "objective" ? "selected" : ""} onClick={() => onChange({ ...value, type: "objective" })}>객관식</button>
      </div>
      <textarea value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} placeholder="교육생에게 실시간으로 제시할 질문을 입력하세요." />
      {value.type === "objective" && (
        <div className="option-editor">
          {value.options.map((option, index) => <input key={index} value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`답변 항목 ${index + 1}`} />)}
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
      <div><input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="모듈명 예: 2모듈 신뢰받는 농협인" /><input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} placeholder="교육생 업로드 안내 (선택)" /></div>
      <button className="primary" onClick={onSubmit}>＋ 신규 장표 업로드 탭</button>
    </div>
  );
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
        <div className="board-card-grid">
          {selected.items.map((item) => (
            <article key={item.id}>
              <button className="board-image-button" onClick={() => onExpand(item)}>
                {item.imageUrl ? <img src={item.imageUrl} alt={`${item.by} 장표`} /> : <div>이미지 없음</div>}
                <span>전체화면 발표 ↗</span>
              </button>
              <div><h4>{item.by}</h4><p>{new Date(item.createdAt).toLocaleString("ko-KR")}</p><button className="ghost" onClick={() => onAnalyze(selected, item)}>이 팀 장표 AI 분석</button></div>
            </article>
          ))}
        </div>
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
      <button onClick={onClose}>× 닫기</button>
      <div><h2>{item.by} 팀 장표</h2>{item.imageUrl && <img src={item.imageUrl} alt={`${item.by} 장표 전체화면`} />}</div>
    </div>
  );
}

function RoundView({ round, onReact }) {
  if (round.questionType === "objective") {
    const counts = (round.options || []).map((option) => ({
      option,
      count: round.items.filter((item) => item.choice === option || item.text === option).length,
    }));
    const max = Math.max(1, ...counts.map((item) => item.count));
    return (
      <div className="round objective-round">
        <div className="round-title"><span>객관식</span><h3>{round.prompt}</h3><b>응답 {round.items.length}명</b></div>
        <div className="choice-results">{counts.map((item) => <div key={item.option}><div><span>{item.option}</span><b>{item.count}명</b></div><i><em style={{ width: `${item.count / max * 100}%` }} /></i></div>)}</div>
      </div>
    );
  }
  return (
    <div className="round">
      <div className="round-title"><span>주관식</span><h3>{round.prompt}</h3><b>응답 {round.items.length}명</b></div>
      <div className="response-list">{[...round.items].sort((a, b) => reactionScore(b) - reactionScore(a)).map((item, index) => (
        <article className="response-item" key={item.id}>
          <div className="response-rank">{index + 1}</div>
          <div className="response-body"><div className="response-meta"><b>{item.by}</b><span>{new Date(item.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{index === 0 && <em>높은 우선순위</em>}</div><p>{item.text}</p>
            <div className="reaction-row">{Object.entries(reactionLabels).map(([key, label]) => <button key={key} onClick={() => onReact(round.id, item.id, key)}>{label} <b>{item.reactions?.[key] || 0}</b></button>)}</div>
          </div>
        </article>
      ))}</div>
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

function buildAnalysis(course, kind = "all") {
  const pollItems = course.rounds.filter((r) => r.kind === "poll").flatMap((r) => r.items);
  const boardItems = course.rounds.filter((r) => r.kind === "board").flatMap((r) => r.items);
  const evidencePool = kind === "goals" ? course.goals.map((g) => ({ quote: g.text, by: g.name, source: "goal" }))
    : kind === "poll" ? pollItems.map((x) => ({ quote: x.text, by: x.by, source: "poll", score: reactionScore(x) }))
    : [
      ...course.goals.slice(0, 2).map((g) => ({ quote: g.text, by: g.name, source: "goal" })),
      ...pollItems.map((x) => ({ quote: x.text, by: x.by, source: "poll", score: reactionScore(x) })).sort((a, b) => b.score - a.score).slice(0, 2),
      ...boardItems.slice(0, 1).map((x) => ({ quote: x.text, by: x.by, source: "board" })),
      ...course.surveys.slice(0, 1).map((x) => ({ quote: x.applied, source: "survey" })),
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

function DataList({ title, items, onAnalyze }) {
  return (
    <section className="content-card">
      <SectionTitle eyebrow="성과 데이터" title={`${title} ${items.length}건`} action={<button className="primary compact" onClick={onAnalyze}>AI 목표 분석</button>} />
      <div className="data-list">{items.map((x) => <article key={x.id}><div className="avatar">{(x.name || "익").slice(0, 1)}</div><div><b>{x.name || x.participantId}</b><p>{x.text}</p><span>{new Date(x.createdAt).toLocaleString("ko-KR")}</span></div></article>)}</div>
    </section>
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
function PrivacyFooter() { return <footer className="privacy-footer">개인정보·고객정보·회사기밀 입력 금지 · AI 결과는 교수요원의 검토 후 활용하세요.</footer>; }
function reactionScore(item) { return Object.values(item.reactions || {}).reduce((a, b) => a + b, 0); }
function sourceLabel(source) { return ({ goal: "교육 목표", poll: "실시간 답변", board: "팀게시판", survey: "사후 설문" }[source] || source); }
function averageLikert(surveys) {
  const values = surveys.flatMap((s) => s.likert || []);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "0.0";
}

function reportData(course) {
  return {
    course: { name: course.name, cohort: course.cohort, code: course.code, period: `${course.startDate} ~ ${course.endDate}` },
    generatedAt: now(),
    preCourseGoalAnalysis: buildAnalysis(course, "goals"),
    inCourseParticipationAnalysis: buildAnalysis(course, "poll"),
    completionReflection: { submitted: course.achievements.length, responses: course.achievements },
    transferAfterTwoMonths: { submitted: course.surveys.length, averageLikert: averageLikert(course.surveys), responses: course.surveys, missions: course.missions },
    improvementSuggestions: buildAnalysis(course).recommendedActions,
    notice: "AI 분석 결과는 제공된 응답 안에서 생성되었으며 교수요원 검토가 필요합니다.",
  };
}

function downloadReport(course, format) {
  const report = reportData(course);
  let content, type, ext;
  if (format === "json") {
    content = JSON.stringify(report, null, 2);
    type = "application/json;charset=utf-8";
    ext = "json";
  } else {
    const rows = [
      ["구분", "지표", "값"],
      ["과정", "과정명", course.name],
      ["과정", "기수", course.cohort],
      ["입교 전", "목표 제출", course.goals.length],
      ["교육 중", "질문/게시판 응답", course.rounds.reduce((s, r) => s + r.items.length, 0)],
      ["수료 시", "성찰 제출", course.achievements.length],
      ["2개월 후", "적용도 응답", course.surveys.length],
      ["2개월 후", "평균 적용도", averageLikert(course.surveys)],
      ...report.improvementSuggestions.map((x, i) => ["개선 제안", `${i + 1}`, x]),
    ];
    content = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    type = "text/csv;charset=utf-8";
    ext = "csv";
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `농심튜터_${course.code}_성과리포트.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

createRoot(document.getElementById("root")).render(<App />);
