-- Stage 5: AI usage accounting for limits and the monthly budget.
-- Run once in Supabase Dashboard -> SQL Editor, after 0002_content.sql.

-- What the call was for, and its cost computed by the server at insert time.
alter table public.ai_usage
  add column kind text not null default 'chat' check (kind in ('chat', 'grading')),
  add column cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0);

-- Total AI spend since a moment (e.g. the start of the month).
-- PostgREST cannot sum on its own, so the server calls this with the service role.
create function public.ai_spend_since(since timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage where created_at >= since;
$$;

revoke execute on function public.ai_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_since(timestamptz) to service_role;
