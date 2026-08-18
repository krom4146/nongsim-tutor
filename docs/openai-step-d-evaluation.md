# OpenAI STEP D 평가·운영 점검 기록

평가일: 2026-08-18
대상: Production `https://nongsim-tutor.vercel.app`, `gpt-5.4-mini`, reasoning effort `medium`

## 1. 평가 기준

- 문장이 서로 달라졌는지는 합격 기준으로 사용하지 않는다.
- 모델 출력 스키마, 허용된 `sourceId`, 서버가 투영한 근거 원문의 정확한 일치 여부를 먼저 검사한다.
- 입력에 없는 지점·매출·성과·인원·징계 같은 고위험 사실과 교육 효과의 단정적 인과를 금지한다.
- 프롬프트 주입 문장은 지시로 실행하거나 모델 서술에 재사용하지 않아야 한다.
- 자동 검사는 의미론적 사실성을 완전히 증명하지 못하므로, 실제 장표와 고위험 결과는 교수요원 검토를 유지한다.

## 2. 고정 평가 세트

`docs/fixtures/openai-task-inputs.json`에는 현재 운영 task 7개의 고정 fixture 22건이 있다.

| task | 건수 | 주요 경계 사례 |
|---|---:|---|
| `goalCohort` | 3 | 일반, 응답 1건, 프롬프트 주입 문장 |
| `goalCompose` | 3 | 일반, 한국어 오탈자·구어체, 프롬프트 주입 문장 |
| `pollCluster` | 4 | 일반, 응답 1건, 상충 관점, 유사 응답만 존재 |
| `boardAnalysis` | 3 | 일반, 작은 글자, 판독 불가 |
| `transferReport` | 3 | 일반, 응답 1건, 조직 지원 장애 집중 |
| `missionDraft` | 3 | 목표+성찰, 목표만, 직무 회고 포함 |
| `reportFeedback` | 3 | 완전한 보고, 요청 누락, 지나치게 짧은 보고 |

추가 장애 fixture는 빈 데이터, 항목/전체/HTTP body 상한, 잘못된 이미지 URL, 이름·사번·이메일·전화·식별번호, 잘못된 method·Content-Type·JSON·Origin, 임시 429, 할당량 도달, SDK timeout/abort, 잘못된 모델·키, refusal, incomplete, 저장 실패를 포함한다.

## 3. 검증 결과

### 로컬 결정적 평가

- STEP D 전용 테스트: 10/10 통과
- 전체 AI 테스트: 56/56 통과
- 수료 성찰·미션 회귀 테스트: 4/4 통과
- `npm run build`: 성공(기존 500 kB 초과 chunk 경고만 유지)
- 22개 fixture 모두 요청·출력 스키마와 sourceId 검증 통과
- 근거형 task의 화면 근거는 입력 원문과 완전히 일치
- 원본에 없는 사실을 넣은 음성 대조군은 grounding 평가에서 의도대로 실패
- 식별자 제거 fixture는 7개 task 모두 통과
- `store:false`, task별 Structured Output, 캐시 hash, 토큰·지연 로그, 저장 실패 경고 확인

### Production 실제 모델 평가

- 텍스트 fixture 19/19 통과, 모두 첫 호출 `source=live`, `persisted=true`
- 같은 입력을 다시 호출한 task별 표본 6/6은 `source=cache`, `persisted=true`
- 실제 장표 2건은 서로 다른 `input_hash`를 사용했고, 저장된 분석의 핵심 내용이 각 이미지 원문과 일치했다. 두 분석에 이미지에 없는 사실 단정은 없었다.
- 판독 불가 장표는 로컬 출력 계약과 UI 경로까지만 검증했다. Production에서 실제 저화질 이미지를 새로 업로드하는 시험은 하지 않았다.

### 지연·토큰·저장

- 실제 텍스트 19건 클라이언트 지연: 최소 3.763초, 중앙값 5.836초, 평균 7.168초, 최대 14.376초
- 캐시 표본 6건: 0.762~1.266초
- 이번 Production 평가 신규 저장: 19행
- 이번 평가 토큰: 입력 9,544, 출력 11,297
- 전체 `ai_analyses`: 38행, 중복 unique key 그룹 0건
- `ai_analyses`에는 원문 prompt/payload 컬럼이 없고, 저장 결과의 이메일·전화·주민번호 패턴 일치 0건
- `anon` SELECT는 실제 `42501 permission denied`, RLS 활성, `anon`·`authenticated` table privilege 없음
- 평가 시간대 Vercel `/api/ai` 5xx/4xx runtime error 0건

통화 기준 실제 비용은 코드에 가격을 고정하지 않고 OpenAI Usage Dashboard의 같은 UTC 구간과 프로젝트 필터로 확인한다.

## 4. 반영한 안정화

1. SDK timeout용 AbortSignal이 `APIUserAbortError`로 끝나는 경우를 `TIMEOUT`(504)으로 분류한다.
2. 잘못된 API key·권한·모델 ID는 내부 원문 없이 `SERVER_MISCONFIGURED`로 분류한다.
3. 자유 입력에서 명시적으로 라벨된 이름·성명·실명과 사번·직원번호를 모델 호출 전에 제거한다.
4. STEP D 평가기가 실제 응답 본문이나 원문을 출력하지 않고 task·fixture·status·live/cache·저장·지연·평가 오류만 기록한다.

## 5. 잔여 위험

- 자동 fixture는 알려진 고위험 사실, 숫자, sourceId와 근거 일치를 검사하지만 모든 한국어 의미의 사실성을 수학적으로 보장하지 못한다. `교수요원 검토 필요` 절차를 유지한다.
- 라벨 없는 자유문장 속 한국어 실명은 정규식만으로 오탐 없이 완전 제거할 수 없다. 구조화된 이름·참여자 ID 제외, 입력 안내, 교수요원 검토를 함께 유지한다.
- 실제 저화질/판독 불가 장표의 live 모델 반응은 발표 전 비식별 테스트 이미지로 1회 수동 확인한다.
- WAF 게시 상태, Vercel 환경변수 scope, OpenAI Usage 실제 비용·예산 알림은 Dashboard 권한이 있어야 확인할 수 있다.
- Project monthly budget의 강제 차단 여부는 Dashboard에서 별도로 확인한다. OpenAI 공식 안내상 일반 Project monthly budget은 알림용 soft threshold이며 초과 후에도 요청이 계속될 수 있다.
- reasoning effort를 바꿔 비교할 때 현재 캐시는 effort를 unique key에 포함하지 않는다. 같은 입력 비교는 별도 평가 입력이나 prompt version을 사용해야 한다.

## 6. 재실행

로컬 결정적 평가:

```text
npm run test:ai-step-d
```

Production 실제 텍스트 fixture 평가:

```text
npm run eval:ai-step-d -- --base-url=https://nongsim-tutor.vercel.app
```

WAF 한도에 영향을 주지 않도록 기본 호출 간격은 7초다. `boardAnalysis`는 실제 Storage 장표와 눈으로 대조해야 하므로 자동 텍스트 평가에서 제외한다.
