-- =====================================================================
-- 농심튜터 Supabase 스키마
-- 이 파일은 현재 DB 구조의 원본 기록입니다.
-- 프로젝트를 새로 만들 경우 이 파일 전체를 SQL Editor에 붙여넣어 실행하면
-- 동일한 구조가 복원됩니다.
-- 최종 수정: 2026-08-20 (이념과정 스탬프 저장·조회 및 실시간 반영)
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

-- 현업적용도 설문: 익명 원칙. 이름·참여자 연결 식별자 없음.
create table if not exists surveys (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  class_id text,
  class_name text,
  likert jsonb default '[]'::jsonb,
  barriers jsonb default '[]'::jsonb,
  applied text,
  support text,
  submitted_at timestamptz default now()
);

-- 기존 초기 스키마에 남아 있던 연결 식별자 열을 제거한다.
alter table public.surveys drop column if exists participant_id;

create table if not exists missions (
  id text primary key,
  course_code text references courses(code) on delete cascade,
  participant_id text,
  text text,
  elements jsonb default '{}'::jsonb,      -- {when, what, how}
  checkpoints jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- 수료 성찰: 과정·참여자별 1건을 저장하고 재제출 시 같은 행을 갱신한다.
create table if not exists achievements (
  id text primary key,
  course_code text not null references courses(code) on delete cascade,
  participant_id text not null,
  name text,
  class_id text,
  class_name text,
  text text not null,
  answers jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint achievements_course_participant_key unique (course_code, participant_id)
);

-- 통합 농협이념과정 스탬프: 지급·취소 이력을 보존하고 교육생 화면에 실시간 반영한다.
create table if not exists ideology_stamps (
  id text primary key,
  course_code text not null references courses(code) on delete cascade,
  participant_id text not null,
  class_id text not null,
  class_name text not null,
  student_name text not null,
  stamp_type text not null check (
    stamp_type in ('participation', 'cooperation', 'consideration', 'reflection', 'olympic', 'action')
  ),
  stamp_label text not null,
  stamp_icon text not null,
  count smallint not null check (count between 1 and 3),
  memo text,
  given_by text not null default '교수요원',
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- 직무강의 회고: 과정·참여자·강의일별 1건. 교육생의 동시 제출은 전용 행으로 분리한다.
create table if not exists job_reflections (
  id text primary key,
  course_code text not null references courses(code) on delete cascade,
  participant_key text not null,            -- 서버 HMAC. 원본 참여자 식별자는 저장하지 않는다.
  class_id text not null,
  class_name text not null,
  reflection_date date not null,
  best_session_id text not null,
  best_reason text not null,
  best_reason_etc text,
  improvement_session_id text,
  improvement_reason text,
  improvement_reason_etc text,
  work_application_point text not null,
  created_at timestamptz not null default now(),
  constraint job_reflections_course_participant_date_key
    unique (course_code, participant_key, reflection_date)
);

-- AI 분석 결과·사용량 메타데이터. 원본 프롬프트와 전체 입력 payload는 저장하지 않는다.
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses(code),
  task text not null constraint ai_analyses_task_check check (
    task in (
      'goalCohort',
      'goalCompose',
      'pollCluster',
      'boardAnalysis',
      'transferReport',
      'jobReflectionAnalysis',
      'completionReflectionAnalysis',
      'missionDraft',
      'reportFeedback'
    )
  ),
  input_hash text not null,
  result jsonb not null,
  prompt_version text not null,
  model text not null,
  reasoning_effort text,
  input_tokens integer,
  output_tokens integer,
  openai_request_id text,
  created_at timestamptz not null default now(),
  unique (course_code, task, input_hash, prompt_version, model)
);

-- 기존 설치에도 최신 AI task 허용목록을 반영한다. 행과 권한은 변경하지 않는다.
do $$
begin
  alter table public.ai_analyses drop constraint if exists ai_analyses_task_check;
  alter table public.ai_analyses
    add constraint ai_analyses_task_check check (
      task in (
        'goalCohort',
        'goalCompose',
        'pollCluster',
        'boardAnalysis',
        'transferReport',
        'jobReflectionAnalysis',
        'completionReflectionAnalysis',
        'missionDraft',
        'reportFeedback'
      )
    );
end $$;

-- ---------- 2. 인덱스 ----------

create index if not exists idx_rounds_course on rounds(course_code);
create index if not exists idx_items_round on round_items(round_id);
create index if not exists idx_goals_course on goals(course_code);
create index if not exists idx_surveys_course on surveys(course_code);
create index if not exists idx_missions_course on missions(course_code);
create index if not exists idx_ideology_stamps_course_created
  on ideology_stamps(course_code, created_at desc);
create index if not exists idx_job_reflections_course_date_class
  on job_reflections(course_code, reflection_date, class_id);
create index if not exists ai_analyses_course_created_idx
  on public.ai_analyses (course_code, created_at desc);

-- ---------- 3. RLS 활성화 ----------

alter table courses     enable row level security;
alter table rounds      enable row level security;
alter table round_items enable row level security;
alter table goals       enable row level security;
alter table achievements enable row level security;
alter table surveys     enable row level security;
alter table missions    enable row level security;
alter table ideology_stamps enable row level security;
alter table job_reflections enable row level security;
alter table public.ai_analyses enable row level security;

-- ---------- 4. 접근 정책 (심사 데모 단계) ----------
-- 읽기·추가·수정은 허용하되 삭제는 차단하여 사고를 방지한다.
-- ※ 실서비스 전환 시 사번·SSO 인증 기반 최소권한 정책으로 교체 예정
-- ※ 교수요원 과정 삭제 기능이 필요해지면 별도 삭제 정책을 추가해야 한다

drop policy if exists "demo_all_courses" on courses;
drop policy if exists "demo_all_rounds" on rounds;
drop policy if exists "demo_all_round_items" on round_items;
drop policy if exists "demo_all_goals" on goals;
drop policy if exists "demo_all_achievements" on achievements;
drop policy if exists "demo_all_surveys" on surveys;
drop policy if exists "demo_all_missions" on missions;
drop policy if exists "demo_all_ideology_stamps" on ideology_stamps;
drop policy if exists "demo_all_job_reflections" on job_reflections;

drop policy if exists "demo_select_courses" on courses;
drop policy if exists "demo_insert_courses" on courses;
drop policy if exists "demo_update_courses" on courses;
drop policy if exists "demo_select_rounds" on rounds;
drop policy if exists "demo_insert_rounds" on rounds;
drop policy if exists "demo_update_rounds" on rounds;
drop policy if exists "demo_select_items" on round_items;
drop policy if exists "demo_insert_items" on round_items;
drop policy if exists "demo_update_items" on round_items;
drop policy if exists "demo_select_goals" on goals;
drop policy if exists "demo_insert_goals" on goals;
drop policy if exists "demo_select_achievements" on achievements;
drop policy if exists "demo_insert_achievements" on achievements;
drop policy if exists "demo_update_achievements" on achievements;
drop policy if exists "demo_select_surveys" on surveys;
drop policy if exists "demo_insert_surveys" on surveys;
drop policy if exists "demo_select_missions" on missions;
drop policy if exists "demo_insert_missions" on missions;
drop policy if exists "demo_update_missions" on missions;
drop policy if exists "demo_select_ideology_stamps" on ideology_stamps;
drop policy if exists "demo_insert_ideology_stamps" on ideology_stamps;
drop policy if exists "demo_update_ideology_stamps" on ideology_stamps;
drop policy if exists "demo_select_job_reflections" on job_reflections;
drop policy if exists "demo_insert_job_reflections" on job_reflections;
drop policy if exists "demo_update_job_reflections" on job_reflections;

create policy "demo_select_courses" on courses for select to anon, authenticated using (true);
create policy "demo_insert_courses" on courses for insert to anon, authenticated with check (true);
create policy "demo_update_courses" on courses for update to anon, authenticated using (true) with check (true);

create policy "demo_select_rounds" on rounds for select to anon, authenticated using (true);
create policy "demo_insert_rounds" on rounds for insert to anon, authenticated with check (true);
create policy "demo_update_rounds" on rounds for update to anon, authenticated using (true) with check (true);

create policy "demo_select_items" on round_items for select to anon, authenticated using (true);
create policy "demo_insert_items" on round_items for insert to anon, authenticated with check (true);
create policy "demo_update_items" on round_items for update to anon, authenticated using (true) with check (true);

create policy "demo_select_goals" on goals for select to anon, authenticated using (true);
create policy "demo_insert_goals" on goals for insert to anon, authenticated with check (true);

create policy "demo_select_achievements" on achievements for select to anon, authenticated using (true);
create policy "demo_insert_achievements" on achievements for insert to anon, authenticated with check (true);
create policy "demo_update_achievements" on achievements for update to anon, authenticated using (true) with check (true);

create policy "demo_select_surveys" on surveys for select to anon, authenticated using (true);
create policy "demo_insert_surveys" on surveys for insert to anon, authenticated with check (true);

create policy "demo_select_missions" on missions for select to anon, authenticated using (true);
create policy "demo_insert_missions" on missions for insert to anon, authenticated with check (true);
create policy "demo_update_missions" on missions for update to anon, authenticated using (true) with check (true);

-- ---------- 5. 실시간(Realtime) 등록 ----------
-- 이미 등록된 테이블은 건너뛰어 전체 스키마를 다시 실행해도 중단되지 않는다.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courses'
  ) then
    alter publication supabase_realtime add table public.courses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'round_items'
  ) then
    alter publication supabase_realtime add table public.round_items;
  end if;
end
$$;


-- 1) 과정 숨김 처리
alter table public.courses
  add column if not exists archived_at timestamptz;

-- 2) 공개 클라이언트 권한 회수 후 필요한 것만 재부여
revoke all privileges on all tables in schema public
from anon, authenticated;

grant select, insert, update
on table
  public.courses,
  public.rounds,
  public.round_items,
  public.goals,
  public.achievements,
  public.missions
to anon, authenticated;

grant select, insert
on table public.surveys
to anon, authenticated;

-- 자유서술식 회고는 공개 키에서 직접 접근하지 않고 서버 프록시만 사용한다.
revoke all on table public.job_reflections from anon, authenticated;
grant select, insert, update on table public.job_reflections to service_role;

-- 스탬프 지급 이력은 교수요원 서버 프록시와 검증된 교육생 조회만 사용한다.
revoke all on table public.ideology_stamps from anon, authenticated;
revoke all on table public.ideology_stamps from service_role;
grant select, insert, update on table public.ideology_stamps to service_role;

-- AI 분석은 서버 전용 secret key가 사용하는 service_role만 접근한다.
revoke all on table public.ai_analyses from anon, authenticated;
grant select, insert on table public.ai_analyses to service_role;

drop policy if exists "demo_update_goals" on public.goals;
create policy "demo_update_goals"
on public.goals
for update
to anon, authenticated
using (true)
with check (true);

-- 3) 동시 반응 덮어쓰기를 막는 원자적 증감 함수 (반응 키: agree)
create or replace function public.bump_reaction(
  p_item_id text,
  p_kind text,
  p_delta integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_reactions jsonb;
begin
  if p_kind not in ('agree') then
    raise exception using
      errcode = '22023',
      message = 'invalid reaction kind';
  end if;

  if p_delta not in (-1, 1) then
    raise exception using
      errcode = '22023',
      message = 'reaction delta must be -1 or 1';
  end if;

  update public.round_items
  set reactions = jsonb_set(
    coalesce(reactions, '{}'::jsonb),
    array[p_kind],
    to_jsonb(
      greatest(
        coalesce((reactions ->> p_kind)::integer, 0) + p_delta,
        0
      )
    ),
    true
  )
  where id = p_item_id
  returning reactions into v_reactions;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'round item not found';
  end if;

  return v_reactions;
end;
$$;

revoke all on function public.bump_reaction(text, text, integer) from public;
grant execute on function public.bump_reaction(text, text, integer)
to anon, authenticated;

-- 4) courses.updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_courses_touch on public.courses;
create trigger trg_courses_touch
before update on public.courses
for each row execute function public.touch_updated_at();

-- 5) 장표 이미지 공개 버킷과 신규 업로드 전용 정책
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'board-images',
  'board-images',
  true,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public URL 조회는 공개 버킷 자체로 허용하고 목록 SELECT 정책은 만들지 않는다.
drop policy if exists "board_images_read" on storage.objects;
drop policy if exists "board_images_insert" on storage.objects;

create policy "board_images_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'board-images'
  and lower(storage.extension(name)) = 'jpg'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] ~ '^NH-[0-9]+$'
);

-- UPDATE·DELETE 정책은 의도적으로 만들지 않는다. 업로드는 새 UUID 경로만 사용한다.
