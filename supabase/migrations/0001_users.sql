-- Stage 2: user profiles and roles.
-- Run once in Supabase Dashboard -> SQL Editor.

create type public.user_role as enum ('student', 'admin');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  email text not null,
  role public.user_role not null default 'student',
  class text not null default '' check (char_length(class) <= 10),
  total_points integer not null default 0 check (total_points >= 0),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Clients get read access only. Role, points and blocking are changed
-- by the server (service role) or manually by the project owner.
revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;

-- A user sees only their own profile row.
create policy users_select_own
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Create a profile for every new auth user.
-- Signup metadata comes from the client (the anon key is public), so it is
-- trimmed and length-limited here, and the role is always 'student'.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, email, class)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'name'), 50), ''), 'Ученик'),
    coalesce(new.email, ''),
    coalesce(left(btrim(new.raw_user_meta_data ->> 'class'), 10), '')
  );
  return new;
end;
$$;

-- Not callable through the API, only as a trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
