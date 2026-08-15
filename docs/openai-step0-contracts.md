# OpenAI STEP 0 — 현재 화면 계약과 평가 fixture

작성일: 2026-08-15
범위: 작업지시서 v2의 STEP 0만 해당한다. 화면 동작, `/api/ai`, OpenAI 호출, mock 교체는 이 단계에서 변경하지 않는다.

## 1. 조사 결론

현재 AI 관련 mock은 별도 서비스 파일이 아니라 대부분 `src/main.jsx`에 인라인되어 있다.

| task | 현재 생성 로직 | 실제 소비 화면 | 조사 결과 |
|---|---|---|---|
| `goalCohort` | `buildAnalysis(course, "goals")` | `AIEvidenceResult` | 공통 분석 카드 계약을 그대로 읽는다. |
| `pollCluster` | `buildAnalysis(course, "poll")`, `buildTeachingIntervention(course)` | `AIEvidenceResult`, 교수 대시보드 개입 추천 | 두 반환 객체가 서로 분리되어 있어 향후 한 task 응답 안에서 함께 다룰 필요가 있다. |
| `boardAnalysis` | `analyzeBoards(round, item)` 안의 고정 객체 | `ProfessorBoardGallery` | `scope`, `summary`, `common`, `action`만 실제로 읽는다. |
| `transferReport` | `TransferReportSummary` 내부 규칙 계산 | 전이 리포트 | 현재 별도 반환 객체가 없고 설문 배열에서 화면 값을 바로 파생한다. |
| `missionDraft` | `buildPersonalizedTransferMission`, `missionElementSummary` | 수료 성찰·현업 미션 카드 | 화면은 문장형 `missionText`와 `{when, what, how}` 표시값을 필요로 한다. |
| `reportFeedback` | `buildStructuredReportFeedback` | `ReportFeedback` | 요약, 6개 고정 점수, 첫 개선점만 읽는다. |

### 후속 질문 task 결정

- 독립적인 **“AI 후속질문 추천” 버튼은 없다.** 실시간 질문 화면에는 `AI로 묶기` 버튼만 있고(`src/main.jsx:3019`), 그 결과 카드가 같은 객체의 `followupQuestions`를 표시한다(`src/main.jsx:3832`).
- 따라서 일반 후속 질문 추천은 별도 `followupQuestion` task로 만들지 않고 `pollCluster` 결과에 포함한다.
- 목표 분석 화면도 현재 공통 카드 때문에 `followupQuestions`를 읽는다. `goalCohort` 계약에도 이 배열을 유지해 기존 화면을 깨지 않게 한다.
- 보고훈련의 `AI 팀장 꼬리질문`(`src/main.jsx:2068`)은 일반 응답 군집의 후속 질문 버튼이 아니다. 이 질문과 답변은 순서를 보존해 `reportFeedback` 입력 대화에 포함한다.

### 새 API 계약에서 제외할 현재 코드

| 코드 | 제외 이유 |
|---|---|
| `analyzeQuestionResponses()`의 `good`, `misconception`, `needHelp`, `intervention`, `followups` | 함수 호출부가 없다. 화면이 읽지 않는다. |
| `OCRResult`의 `team`, `claim`, `strengths`, `improvements`, `commonality`, `order` | 컴포넌트 호출부가 없다. 실제 장표 화면은 다른 네 필드만 읽는다. |
| `buildRoleplayFeedback()`의 문자열 | 함수 호출부가 없다. 실제 피드백은 `buildStructuredReportFeedback()`을 사용한다. |
| `buildAnalysis().mode` | mock은 반환하지만 현재 분석 화면은 읽지 않는다. 향후 `mode`는 task 데이터가 아니라 서버 응답 `meta`에 둔다. |

## 2. 공통 계약 원칙

1. 모든 요청은 `courseCode`와 아래 6개 task 중 하나를 가진다.
2. 실명, 연락처, 사번, `participantId`, 재입장 토큰은 모델 입력에서 제외한다.
3. 설문에는 기존 원칙대로 참여자 연결 식별자를 추가하지 않는다. `classId`, `className`은 반별 분석 범위로 사용할 수 있다.
4. 텍스트 입력 항목은 서버에서 `{sourceId, text}`로 정규화한다. 모델은 원문 인용을 만들지 않고 `sourceIds`만 반환한다.
5. 서버가 `sourceIds`를 검증한 뒤 현재 화면용 `evidence` 또는 사례 원문을 구성한다. 존재하지 않는 ID가 하나라도 있으면 결과를 거부한다.
6. `mode`, `source`, `persisted`, `model`, `promptVersion`, `requestId`는 모델 출력이 아니라 서버 `meta`다.
7. 아래에서 `필수`로 표시한 배열은 현재 화면이 바로 `.map()`을 호출하므로 빈 배열일 수는 있어도 생략할 수 없다.

## 3. task별 입력·출력 계약표

### `goalCohort`

현재 경로: `runAnalysis("goals")` → `buildAnalysis(filteredCourse, "goals")` → `AIEvidenceResult`.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 서버에서 활성 과정 존재 여부 확인 |
| 입력 | `classId`, `className` | `string \| null`, 선택 | 현재 반 필터 범위; 개인 식별자가 아님 |
| 입력 | `goals` | `{sourceId:string, text:string}[]`, 필수 | 현재 mock은 `goal.text`, `goal.name`을 읽지만 이름은 향후 제거 |
| 모델 결과 | `summary` | `string`, 필수 | 화면이 직접 표시 |
| 모델 결과 | `summarySourceIds` | `string[]`, 필수 | 요약 근거 검증 |
| 모델 결과 | `clusters` | `{title:string, count:number, insight:string, sourceIds:string[]}[]`, 필수 | 화면은 `title`, `count`, `insight`를 직접 읽음 |
| 모델 결과 | `recommendedActions` | `string[]`, 필수 | 화면이 순서 목록으로 표시 |
| 모델 결과 | `followupQuestions` | `string[]`, 필수 | 공통 분석 카드가 직접 표시 |
| 모델 결과 | `sampleSize` | `number`, 필수 | 표본 수 검증·데이터 부족 판단 |
| 모델 결과 | `dataWarning` | `string \| null`, 필수 | 표본 부족 시 억지 군집 방지 |
| 서버 투영 | `evidence` | `{source:"goal", by?:string, quote:string}[]`, 필수 | 검증된 `sourceIds`를 원문으로 치환한 현재 화면용 배열 |
| 서버 투영 | `evidenceCount` | `number`, 선택 | 없으면 화면이 `evidence.length` 사용 |
| 서버 투영 | `generatedAt` | ISO 문자열, 선택 | 없으면 화면이 “생성 시각 없음” 표시 |

### `pollCluster`

현재 경로: `runAnalysis("poll")` → `buildAnalysis(filteredCourse, "poll")` → `AIEvidenceResult`. 교수 대시보드는 별도로 `buildTeachingIntervention(course)` 결과를 읽는다.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 활성 과정 확인 |
| 입력 | `round` | `{sourceId, prompt, questionType, questionIntent, anonymous}`, 필수 | 현재 분석 품질에 필요한 질문 문맥 |
| 입력 | `responses` | `{sourceId:string, text:string, agree:number}[]`, 필수 | 이름·참여자 ID 없이 응답과 `agree` 수만 전달 |
| 모델 결과 | `summary`, `summarySourceIds` | `string`, `string[]`, 필수 | 공통 분석 카드 |
| 모델 결과 | `clusters` | `{title, count, insight, sourceIds}[]`, 필수 | 의미가 비슷한 응답 묶음; 표본이 적으면 개수 축소 |
| 모델 결과 | `recommendedActions` | `string[]`, 필수 | 교수요원 행동 제안 |
| 모델 결과 | `followupQuestions` | `string[]`, 필수 | **별도 task 없이 이 응답에 통합** |
| 모델 결과 | `teachingIntervention` | 아래 6개 문자열, 필수 | 현재 대시보드 보조 mock을 같은 task로 교체하기 위한 묶음 |
| 모델 결과 | `sampleSize`, `dataWarning` | `number`, `string \| null`, 필수 | 데이터 부족 처리 |
| 서버 투영 | `evidence` | `{source:"poll", by?:string, quote:string}[]`, 필수 | 검증된 원문. 익명 질문은 `by`를 “익명”으로 처리 |
| 서버 투영 | `evidenceCount`, `generatedAt` | `number`, ISO 문자열, 선택 | 현재 공통 카드 메타 |

`teachingIntervention`의 필수 키는 `insufficientConcept`, `confusionPoint`, `immediateQuestion`, `miniLesson`, `discussionTopic`, `evidence`다. 현재 화면은 여섯 필드를 모두 직접 읽는다(`src/main.jsx:3144`~`3148`). 모델이 만든 인용문은 허용하지 않으므로 향후 `evidence`는 서버가 검증된 `sourceId`로 치환한다.

### `boardAnalysis`

현재 경로: `analyzeBoards(round, item)` → `ProfessorBoardGallery`.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 활성 과정 확인 |
| 입력 | `classId`, `className` | `string \| null`, 선택 | 반 범위 표시 |
| 입력 | `moduleTitle`, `scopeLabel` | `string`, 필수 | 화면의 분석 범위 라벨을 서버가 구성 |
| 입력 | `imageUrl` | `string`, 필수 | 검증된 현재 프로젝트 `board-images` 공개 URL 한 장만 허용 |
| 결과 | `status` | `"ok" \| "unreadable"`, 필수 | 읽을 수 없는 텍스트를 추정하지 않기 위한 상태 |
| 결과 | `scope` | `string`, 필수 | 화면 제목 |
| 결과 | `summary` | `string`, 필수 | 핵심 내용 요약 |
| 결과 | `common` | `string[]`, 필수 | 현재 화면의 공통점/잘된 점 태그 |
| 결과 | `action` | `string`, 필수 | 보완점과 다음 수업 행동을 합친 현재 화면 필드 |

현재 화면에는 “전체 장표 AI 분석”과 “이 팀 장표 AI 분석” 버튼이 모두 있지만, 서버 입력 제한은 이미지 1장이다. STEP C에서 전체 분석을 연결할 때 여러 이미지 URL을 한 요청에 넣지 말고, 개별 분석 결과를 제한된 수로 집계하거나 UX를 별도로 결정해야 한다. STEP 0에서는 버튼 동작을 바꾸지 않는다.

### `transferReport`

현재 경로: `TransferReportSummary`가 `course.surveys`를 직접 집계한다. 현재 AI 반환 객체는 없다.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 현재 보고 있는 과정 고정 |
| 입력 | `classId`, `className` | `string \| null`, 선택 | 전체/반별 필터 |
| 입력 | `participantCount` | `number`, 필수 | 제출 현황 문구 |
| 입력 | `surveys` | `{sourceId, likert:number[5], barriers:string[], applied:string, support:string}[]`, 필수 | 참여자 연결 ID 없이 실제 설문 내용 전달 |
| 결과 | `summary` | `string`, 필수 | 전이 리포트 요약 |
| 결과 | `successCase` | `{sourceIds:string[]}`, 필수 | 서버가 검증 후 `quote`를 붙여 “가장 잘 적용된 사례”에 투영 |
| 결과 | `blockedCase` | `{sourceIds:string[]}`, 필수 | 서버가 검증 후 “가장 막힌 사례”에 투영 |
| 결과 | `appliedHighlights` | `{sourceIds:string[]}[]`, 필수 | 화면의 현업 적용 응답 요약 |
| 결과 | `supportHighlights` | `{sourceIds:string[]}[]`, 필수 | 화면의 과정 개선 포인트 |
| 결과 | `barriers` | `{label:string, count:number}[]`, 필수 | 실제 선택값의 빈도 집계; 모델이 새 장애요인을 만들지 않음 |
| 결과 | `recommendedActions` | `string[]`, 필수 | 교육·관리자 지원 제안 |
| 결과 | `dataWarning` | `string \| null`, 필수 | 응답 부족 경고와 인과 단정 방지 |

화면 투영 시 사례·하이라이트에는 서버가 `응답자 N` 라벨과 검증된 원문을 붙인다. 실명과 참여자 연결 식별자는 추가하지 않는다.

### `missionDraft`

현재 경로: `buildPersonalizedTransferMission(...)` → 문장형 미션 → `missionElementSummary(...)` → `MissionElementBadges`.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 활성 과정 확인 |
| 입력 | `goal` | `{sourceId, text} \| null`, 선택 | 교육 전 목표 |
| 입력 | `achievementResponses` | `{sourceId, text}[]`, 필수 | 수료 성찰 답변; 빈 배열 허용 |
| 입력 | `jobReflection` | `{sourceId, text} \| null`, 선택 | 직무 회고 적용 포인트 |
| 모델 결과 | `when` | `string`, 필수·비어 있지 않음 | 실행 시점 |
| 모델 결과 | `what` | `string`, 필수·비어 있지 않음 | 실행 행동 |
| 모델 결과 | `how` | `string`, 필수·비어 있지 않음 | 실행 방법/기록 방식 |
| 서버 투영 | `missionText` | `string`, 필수 | 세 요소를 보존해 현재 편집 textarea와 카드에 표시 |
| 서버 투영 | `elements` | `{when, what, how}`, 필수 | DB 저장용 구조 |

현재 helper의 `studentName`은 일반 fallback 문구에만 쓰이며 모델 입력에서는 제거한다. 입력에 없는 직무·성과 수치를 만들지 않는다.

### `reportFeedback`

현재 경로: `createFollowupQuestions`로 꼬리질문 표시 → 답변 수집 → `buildStructuredReportFeedback(reportText, followupAnswer)` → `ReportFeedback`.

| 구분 | 필드 | 타입·필수 여부 | 현재/향후 사용 |
|---|---|---|---|
| 입력 | `courseCode` | `string`, 필수 | 활성 과정 확인 |
| 입력 | `scenario`, `difficulty` | `string`, 필수 | 훈련 문맥 |
| 입력 | `turns` | `{speaker:"learner" \| "manager", text:string}[]`, 필수 | 현재 보고·꼬리질문·추가 답변 순서 보존; 이름/참여자 ID 제외 |
| 결과 | `summary` | `string`, 필수 | 화면 설명 |
| 결과 | `scores.conclusionFirst` | `1..5`, 필수 | 결론 먼저 |
| 결과 | `scores.accuracy` | `1..5`, 필수 | 사실 정확성 |
| 결과 | `scores.cause` | `1..5`, 필수 | 원인 파악 |
| 결과 | `scores.actionPlan` | `1..5`, 필수 | 조치 계획 |
| 결과 | `scores.requestClarity` | `1..5`, 필수 | 요청사항 명확성 |
| 결과 | `scores.attitude` | `1..5`, 필수 | 태도와 표현 |
| 결과 | `firstFix` | `string`, 필수 | 가장 먼저 고칠 한 가지 |

점수 키는 화면 라벨과 1:1로 연결되어 있으므로 이름을 바꾸거나 임의 항목을 추가하지 않는다.

## 4. 비식별 입력 fixture

fixture 원본은 `docs/fixtures/openai-task-inputs.json`이다.

| task | fixture 수 | 포함 사례 |
|---|---:|---|
| `goalCohort` | 3 | 일반 코호트, 1건 표본, 입력 속 명령문 |
| `pollCluster` | 3 | 다중 군집, 1건 표본, 관점 혼합·오개념 |
| `boardAnalysis` | 3 | 일반, 작은 글자, 판독 불가 |
| `transferReport` | 3 | 일반, 1건 표본, 조직 지원 장애 집중 |
| `missionDraft` | 3 | 목표+성찰, 목표만, 직무 회고 포함 |
| `reportFeedback` | 3 | 완전한 보고, 요청 누락, 지나치게 짧은 보고 |

장표 URL은 비밀값이 없는 계약용 예시다. live 평가 전 얼굴·실명·연락처가 없는 실제 `board-images` 업로드 URL로 교체한다.

## 5. STEP 0 운영 확인 항목

- 저장소에는 값이 비어 있는 `.env.example`만 둔다. 실제 키는 `.env.local`과 Vercel Dashboard에만 둔다.
- Production·Preview·Development에 서버 전용 `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `OPENAI_IMAGE_DETAIL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AI_ALLOWED_ORIGINS`를 확인한다.
- 공개 설정 `VITE_AI_MODE`는 Production·Preview에서 `live`, 명시적 로컬 데모에서만 `mock`으로 설정한다.
- Vercel WAF에서 `/api/ai`에 IP당 60초 10회 Fixed Window 제한을 설정한다.
- OpenAI Project에 hard spend limit과 50%·80%·100% 알림을 설정한다.
- 공식 모델 목록에는 2026-08-15 기준 `gpt-5.6-terra`가 표시되지만, 실제 프로젝트의 모델 접근 권한은 Dashboard/API에서 별도로 확인한다.

참고: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI 모델 목록](https://developers.openai.com/api/docs/models), [Supabase Data API 보안](https://supabase.com/docs/guides/api/securing-your-api)
