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
  public.missions
to anon, authenticated;

grant select, insert
on table public.surveys
to anon, authenticated;

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