-- =====================================================================
-- 농심튜터 Supabase 스키마
-- 이 파일은 현재 DB 구조의 원본 기록입니다.
-- 프로젝트를 새로 만들 경우 이 파일 전체를 SQL Editor에 붙여넣어 실행하면
-- 동일한 구조가 복원됩니다.
-- 최종 수정: 2026-08-13
-- =====================================================================

-- ---------- 1. 테이블 ----------

create table if not exists courses (
  code text primary key,
  type text,
  name text,
  cohort text,
  start_date date,
  end_date date,
  transfer_date date,
  classes jsonb default '[]'::jsonb,
  participants jsonb default '[]'::jsonb,
  data jsonb default '{}'::jsonb,          -- 과정 설정만 보관. 목표/활동/설문은 개별 테이블이 원본
  schema_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists rounds (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  kind text,                               -- 'poll' | 'board'
  prompt text,
  anonymous boolean default false,
  question_intent text,
  created_at timestamptz default now()
);

create table if not exists round_items (
  id text primary key,
  round_id text references rounds(id) on delete cascade,
  course_code text,
  by_name text,                            -- 익명 활동인 경우 실명을 저장하지 않는다
  text text,
  url text,                                -- 장표 이미지 주소
  reactions jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists goals (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  participant_id text,
  name text,
  class_id text,
  class_name text,
  text text,
  created_at timestamptz default now()
);

-- 현업적용도 설문: 익명 원칙. 이름 없음.
-- ※ participant_id는 역추적 가능성 때문에 앱 연동 시 저장하지 않는 방향으로 정리 예정
create table if not exists surveys (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  participant_id text,
  class_id text,
  class_name text,
  likert jsonb default '[]'::jsonb,
  barriers jsonb default '[]'::jsonb,
  applied text,
  support text,
  submitted_at timestamptz default now()
);

create table if not exists missions (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  participant_id text,
  text text,
  elements jsonb default '{}'::jsonb,      -- {when, what, how}
  checkpoints jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ---------- 2. 인덱스 ----------

create index if not exists idx_rounds_course on rounds(course_code);
create index if not exists idx_items_round on round_items(round_id);
create index if not exists idx_goals_course on goals(course_code);
create index if not exists idx_surveys_course on surveys(course_code);
create index if not exists idx_missions_course on missions(course_code);

-- ---------- 3. RLS 활성화 ----------

alter table courses     enable row level security;
alter table rounds      enable row level security;
alter table round_items enable row level security;
alter table goals       enable row level security;
alter table surveys     enable row level security;
alter table missions    enable row level security;

-- ---------- 4. 접근 정책 (심사 데모 단계) ----------
-- 읽기·추가·수정은 허용하되 삭제는 차단하여 사고를 방지한다.
-- ※ 실서비스 전환 시 사번·SSO 인증 기반 최소권한 정책으로 교체 예정
-- ※ 교수요원 과정 삭제 기능이 필요해지면 별도 삭제 정책을 추가해야 한다

drop policy if exists "demo_all_courses" on courses;
drop policy if exists "demo_all_rounds" on rounds;
drop policy if exists "demo_all_round_items" on round_items;
drop policy if exists "demo_all_goals" on goals;
drop policy if exists "demo_all_surveys" on surveys;
drop policy if exists "demo_all_missions" on missions;

create policy "demo_select_courses" on courses for select using (true);
create policy "demo_insert_courses" on courses for insert with check (true);
create policy "demo_update_courses" on courses for update using (true) with check (true);

create policy "demo_select_rounds" on rounds for select using (true);
create policy "demo_insert_rounds" on rounds for insert with check (true);
create policy "demo_update_rounds" on rounds for update using (true) with check (true);

create policy "demo_select_items" on round_items for select using (true);
create policy "demo_insert_items" on round_items for insert with check (true);
create policy "demo_update_items" on round_items for update using (true) with check (true);

create policy "demo_select_goals" on goals for select using (true);
create policy "demo_insert_goals" on goals for insert with check (true);

create policy "demo_select_surveys" on surveys for select using (true);
create policy "demo_insert_surveys" on surveys for insert with check (true);

create policy "demo_select_missions" on missions for select using (true);
create policy "demo_insert_missions" on missions for insert with check (true);
create policy "demo_update_missions" on missions for update using (true) with check (true);

-- ---------- 5. 실시간(Realtime) 등록 ----------
-- 이미 등록된 경우 "already member of publication" 오류가 나며, 무시해도 된다.

alter publication supabase_realtime add table courses;
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table round_items;