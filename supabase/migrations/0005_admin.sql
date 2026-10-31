-- Stage 7: admin panel and research export.
-- Run once in Supabase Dashboard -> SQL Editor, after 0004_points.sql.

-- Verdict of each graded answer, for the attempts log.
alter table public.submissions
  add column ai_status text check (ai_status in ('solved', 'needs_work')),
  add column criteria_met smallint[];

-- Last time each student wrote to the mentor or sent an answer.
create function public.student_last_activity()
returns table (user_id uuid, last_activity timestamptz)
language sql
stable
set search_path = ''
as $$
  select activity.user_id, max(activity.created_at)
  from (
    select user_id, created_at from public.chat_history where role = 'user'
    union all
    select user_id, created_at from public.submissions
  ) as activity
  group by activity.user_id;
$$;

revoke execute on function public.student_last_activity() from public, anon, authenticated;
grant execute on function public.student_last_activity() to service_role;
