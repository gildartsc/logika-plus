-- Stage 6: awarding points (XP) for a solved task.
-- Run once in Supabase Dashboard -> SQL Editor, after 0003_ai_usage.sql.

-- Marks the task solved and adds the points in one transaction, but only the
-- first time: a repeated or concurrent correct answer awards nothing.
-- The points value is computed by the application (SPEC: "points are counted
-- by code, not by the model") and passed in.
create function public.award_task_points(p_user_id uuid, p_task_id uuid, p_points integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  awarded boolean;
begin
  if p_points < 0 then
    raise exception 'points must be non-negative';
  end if;

  insert into public.user_progress (user_id, task_id)
  values (p_user_id, p_task_id)
  on conflict (user_id, task_id) do nothing;

  -- A concurrent call waits on the row lock and then sees status = 'solved'.
  update public.user_progress
  set status = 'solved', completed_at = now(), points_earned = p_points
  where user_id = p_user_id and task_id = p_task_id and status <> 'solved';
  awarded := found;

  if awarded then
    update public.users set total_points = total_points + p_points where id = p_user_id;
  end if;
  return awarded;
end;
$$;

revoke execute on function public.award_task_points(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.award_task_points(uuid, uuid, integer) to service_role;
