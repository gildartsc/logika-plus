-- Stage 3: course content, progress, logs and AI usage.
-- Run once in Supabase Dashboard -> SQL Editor, after 0001_users.sql.

create type public.task_type as enum ('critical', 'analytical');
create type public.progress_status as enum ('not_started', 'in_progress', 'solved');
create type public.chat_role as enum ('user', 'ai');

-- Content ------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  order_number smallint not null unique check (order_number between 1 and 34),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  type public.task_type not null,
  public_text text not null check (char_length(public_text) between 1 and 10000),
  -- Hidden from students: only the server reads these columns.
  ai_context text not null default '' check (char_length(ai_context) <= 2000),
  grading_criteria text not null check (char_length(grading_criteria) between 1 and 4000),
  common_mistakes text not null default '' check (char_length(common_mistakes) <= 4000),
  hint_1 text not null check (char_length(hint_1) between 1 and 1000),
  hint_2 text not null check (char_length(hint_2) between 1 and 1000),
  hint_3 text not null check (char_length(hint_3) between 1 and 1000),
  -- One critical and one analytical task per topic.
  unique (topic_id, type)
);

-- Student data ---------------------------------------------------------------

create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  status public.progress_status not null default 'not_started',
  attempts_count integer not null default 0 check (attempts_count >= 0),
  hints_used smallint not null default 0 check (hints_used between 0 and 3),
  ai_messages_count integer not null default 0 check (ai_messages_count >= 0),
  points_earned integer not null default 0 check (points_earned >= 0),
  completed_at timestamptz,
  unique (user_id, task_id)
);
create index user_progress_task_id_idx on public.user_progress (task_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  answer_text text not null check (char_length(answer_text) between 1 and 5000),
  ai_feedback text check (char_length(ai_feedback) <= 4000),
  created_at timestamptz not null default now()
);
create index submissions_user_task_idx on public.submissions (user_id, task_id, created_at);

create table public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  role public.chat_role not null,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
-- History window for one task, and the per-user daily limit.
create index chat_history_user_task_idx on public.chat_history (user_id, task_id, created_at);
create index chat_history_user_created_idx on public.chat_history (user_id, created_at);

-- Kept when a student is deleted, so the monthly budget stays correct.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

-- Privileges -------------------------------------------------------------------
-- RLS filters rows, not columns, so hidden task fields are closed with
-- column privileges. Students never write directly: points, counters and
-- logs are written by the server (service role) after its own checks.

alter table public.topics enable row level security;
alter table public.tasks enable row level security;
alter table public.user_progress enable row level security;
alter table public.submissions enable row level security;
alter table public.chat_history enable row level security;
alter table public.ai_usage enable row level security;

revoke all on table
  public.topics, public.tasks, public.user_progress,
  public.submissions, public.chat_history, public.ai_usage
from anon, authenticated;

grant all on table
  public.users, public.topics, public.tasks, public.user_progress,
  public.submissions, public.chat_history, public.ai_usage
to service_role;

grant select on table public.topics to authenticated;
-- Hints are opened through the server so hints_used stays meaningful.
grant select (id, topic_id, type, public_text) on table public.tasks to authenticated;
grant select on table public.user_progress, public.submissions, public.chat_history to authenticated;
-- ai_usage: no client access at all.

create policy topics_select_all
  on public.topics for select to authenticated
  using (true);

create policy tasks_select_all
  on public.tasks for select to authenticated
  using (true);

create policy user_progress_select_own
  on public.user_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy submissions_select_own
  on public.submissions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy chat_history_select_own
  on public.chat_history for select to authenticated
  using ((select auth.uid()) = user_id);
