# 농심튜터 v3 Codex 작업지시서

## 0. 목표
현재 `농심튜터_프로토타입.jsx`를 심사용 v3 프로토타입으로 고도화한다. 핵심 방향은 “교육용 참여 앱”이 아니라 “농협 교육의 성과를 데이터로 증명하는 AI 평가·전이 관리 에이전트”로 보이게 만드는 것이다.

## 1. 현재 앱에서 유지할 것
- 과정 코드 입장 구조: `NH-2480` 같은 과정 코드로 교수요원/교육생이 같은 과정에 접근한다.
- 과정 유형: 통합 농협이념과정, 책임자·리더십과정, 신규직원과정, 직무과정.
- 공통 목표 루프: 입교 전 목표 작성 → 수료 시 목표 달성도 → 교육 2개월 후 현업 적용도.
- AI 프롬프트 구조: goalCompose, achCompose, goalAnalysis, pollCluster, transfer, reportSys, reportFb, olympicsSys.
- 농협 색상 체계: green `#009A44`, deep `#163D24`, gold `#C49A3F`.

## 2. 가장 먼저 구현할 v3 기능
### P0-1. 교육생 “오늘의 미션” 카드
교육생 홈에 현재 단계 기준으로 다음 행동을 큰 카드로 보여준다.

필수 UX:
- “오늘 할 일” 제목
- 완료/미완료 상태 표시
- 큰 CTA 버튼 1개: 예) “나의 교육 목표 작성하기”, “강사 질문에 답하기”, “목표 달성도 작성하기”, “현업 적용도 응답하기”
- 상단에 `나의 이번 교육 목표` 카드를 고정 표시

Acceptance criteria:
- 교육생은 메뉴를 탐색하지 않아도 다음 행동으로 이동할 수 있다.
- 목표 작성 완료 후 카드 상태가 즉시 완료로 바뀐다.

### P0-2. 교수요원 관제판
교수요원 과정 상세 첫 화면에 실시간 지표 카드를 추가한다.

표시 지표:
- 목표 제출 인원 / 전체 인원
- 수료 성찰 제출 인원
- 사후 적용도 응답 인원
- 실시간 질문/팀게시판 제출 수
- AI가 묶은 핵심 주제 수
- 강사가 지금 짚어야 할 추천 질문 1~2개

Acceptance criteria:
- 교수요원이 “지금 수업이 어디까지 진행됐는지” 한눈에 볼 수 있다.
- 각 지표를 누르면 관련 탭으로 이동한다.

### P0-3. AI 근거 리포트
AI 분석 결과에 반드시 근거 원문을 함께 표시한다.

데이터 구조 예시:
```ts
type AIAnalysisResult = {
  summary: string;
  clusters: { title: string; count: number; insight: string }[];
  evidence: { quote: string; by?: string; source: 'goal' | 'poll' | 'board' | 'survey' }[];
  recommendedActions: string[];
};
```

UI:
- AI 요약
- 주제별 묶음
- 근거 원문 2~3개
- 교수요원 행동 제안

### P0-4. QR 입장
과정 코드 옆에 QR 입장 버튼을 추가한다.

구현 방식:
- 외부 라이브러리 사용 가능: `qrcode.react` 또는 직접 SVG 생성.
- QR 링크는 `?role=student&code=NH-2480` 형태로 만든다.
- 라이브러리 추가가 어렵다면 우선 QR 모양의 mock 카드와 “링크 복사” 기능을 구현한다.

Acceptance criteria:
- 교수요원 화면에서 교육생 입장 링크를 복사할 수 있다.
- 링크 접속 시 교육생 화면으로 이동하고 코드가 자동 입력된다.

## 3. P1 기능
### P1-1. 답변 반응 버튼
실시간 답변마다 다음 반응을 누를 수 있게 한다.
- 공감해요
- 저도 궁금해요
- 현업에서 겪었어요
- 강사님 설명 필요

AI 분석 시 반응 수를 반영해 우선순위를 표시한다.

### P1-2. AI 후속질문 추천
`pollCluster` 분석 후 “지금 던지면 좋은 후속 질문”을 2개 생성한다.
예: “실수를 빨리 보고해야 한다고 했는데, 실제 현장에서는 왜 숨기게 될까요?”

### P1-3. 팀 장표 사진 OCR/요약
팀 게시판에 사진 업로드 후 AI가 다음을 요약한다.
- 팀명
- 핵심 주장
- 좋은 점
- 보완할 점
- 다른 팀과의 공통점
- 발표 추천 순서

현 단계에서는 실제 OCR API가 없어도 mock OCR 함수를 만들고, 추후 API 연결용 adapter를 분리한다.

### P1-4. 보고 롤플레잉 난이도/상황 카드
신규직원과정에 다음 상황 카드를 추가한다.
- 민원 발생 보고
- 시재 차이 보고
- 조합원 항의 보고
- 경제사업 사고 위험 보고
- 상사 부재 중 긴급 보고

난이도:
- 쉬움: 친절한 팀장
- 보통: 바쁜 팀장
- 어려움: 꼬리질문 많은 팀장

## 4. P2 기능
### P2-1. 예약 푸시 데모
실제 푸시 구현 전에는 데모 모드로 `교육 종료 후 10초 뒤 사후조사 알림 도착`을 보여준다.

### P2-2. 리포트 내보내기
우선 JSON/CSV 다운로드를 구현하고, PDF는 후순위로 둔다.
리포트 구성:
- 과정명/기수/기간
- 입교 전 목표 분석
- 교육 중 질문/팀 결과물 분석
- 수료 시 달성도 분석
- 2개월 후 현업 적용도 분석
- 개선 제안

## 5. 데이터 모델 초안
```ts
type Course = {
  code: string;
  type: 'ideology' | 'leader' | 'newbie' | 'job';
  name: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  templateId?: string;
  privacyNoticeAccepted?: boolean;
  goals: Goal[];
  achievements: Achievement[];
  rounds: Round[];
  surveys: TransferSurvey[];
  missions: FieldMission[];
};

type Goal = { id: string; participantId: string; name: string; text: string; createdAt: string };
type Achievement = { id: string; participantId: string; text: string; createdAt: string };
type Round = { id: string; kind: 'poll' | 'board' | 'qa'; prompt: string; items: RoundItem[]; createdAt: string };
type RoundItem = { id: string; by: string; text?: string; imageUrl?: string; reactions?: Record<string, number>; createdAt: string };
type TransferSurvey = { id: string; participantId: string; likert: number[]; barriers: string[]; applied: string; support: string; createdAt: string };
type FieldMission = { id: string; participantId: string; goalId: string; missionText: string; dueDate: string; status: 'assigned' | 'done' | 'not_done' };
```

## 6. AI 프롬프트 개선 원칙
- 결과는 가능하면 JSON 형태로 반환하게 한다.
- 분석 결과에는 반드시 evidence를 포함한다.
- 개인을 특정하지 않고 집계 관점으로 표현한다.
- 농협이념/협동조합 가치와 연결하되 설교조는 피한다.
- 환각 방지를 위해 “제공된 응답 안에서만 근거를 제시하라”는 문장을 추가한다.

예시 시스템 프롬프트:
```txt
당신은 농협 교육원의 AI 교육분석 조교입니다. 제공된 교육생 응답만 근거로 분석하세요. 없는 사실을 추정하지 마세요. 분석 결과는 교수요원이 바로 강의 진행과 과정 개선에 쓸 수 있어야 합니다. 결과는 JSON으로 반환하세요: summary, clusters, evidence, recommendedActions. evidence에는 실제 원문을 짧게 인용하고, 개인 평가는 하지 마세요.
```

## 7. 구현 제약
- API 키를 프론트엔드에 직접 넣지 않는다. 현재 프로토타입은 데모용이므로 실제 배포 전에는 서버 프록시 또는 환경변수 구조로 분리한다.
- 개인정보/회사기밀 입력 금지 안내를 첫 진입 화면 또는 과정 입장 직후에 표시한다.
- 모든 AI 결과는 “교수요원 검토 필요” 뱃지를 붙인다.
- 모바일 화면을 우선한다. 주요 CTA는 엄지로 누르기 쉬운 크기로 만든다.

## 8. Codex에 맡길 작업 순서
1. 현재 파일을 분석하고 컴파일 오류가 있으면 먼저 수정한다.
2. `StudentMissionCard`, `StudentGoalCard`, `ProfessorDashboard`, `QRJoinCard`, `AIEvidenceResult` 컴포넌트를 추가한다.
3. store 구조에 reactions, missions, createdAt 필드를 추가하고 seed 데이터를 보강한다.
4. 교육생 화면의 첫 진입을 “오늘의 미션” 중심으로 재구성한다.
5. 교수요원 과정 상세의 첫 탭을 “관제판”으로 재구성한다.
6. AI 분석 결과를 기존 텍스트 출력에서 `summary + evidence + recommendedActions` 형식으로 표시한다. 실제 AI가 JSON을 반환하지 않으면 fallback parser를 둔다.
7. 보고 롤플레잉에 상황 카드와 난이도 선택을 추가한다.
8. 리포트 JSON/CSV 내보내기 버튼을 추가한다.
9. 모바일 390px 폭에서 깨지지 않도록 반응형 스타일을 점검한다.

## 9. 테스트 시나리오
- 교육생이 QR 링크 또는 코드 `NH-2480`으로 입장한다.
- 오늘의 미션에서 목표 작성을 완료한다.
- 교수요원 관제판에서 목표 제출 수가 증가한다.
- 교수요원이 실시간 질문을 열고 교육생이 답변한다.
- 다른 교육생이 반응 버튼을 누른다.
- AI 분석을 실행하면 요약, 근거 원문, 후속질문이 표시된다.
- 팀 게시판에 사진 또는 텍스트를 올리고 AI 요약을 확인한다.
- 신규직원과정에서 보고 롤플레잉 상황/난이도를 선택하고 피드백을 받는다.
- 수료 시 현업 미션이 생성된다.
- 사후 설문 응답 후 교수요원 리포트를 JSON/CSV로 내보낸다.

## 10. 최종 산출물
- 수정된 React 프로토타입 파일
- 기능별 변경 요약
- 시연용 테스트 데이터
- 본선 발표용 시연 흐름 5단계
