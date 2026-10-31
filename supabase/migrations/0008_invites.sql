-- Registration by single-use invite codes.
-- Run once in Supabase Dashboard -> SQL Editor, after 0007_engineering.sql.
-- Then turn off public sign-ups: Authentication -> Sign In / Providers ->
-- "Allow new users to sign up". The server creates accounts itself with the
-- service role after it has claimed a code, so the public anon key cannot be
-- used to register around the codes.

create table public.invite_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  note text not null default '' check (char_length(note) <= 100),
  created_at timestamptz not null default now(),
  -- Set when a registration claims the code; a code is claimed only once.
  used_at timestamptz,
  used_by uuid references public.users (id) on delete set null
);
create index invite_codes_created_idx on public.invite_codes (created_at desc);

-- Server only: no client policies or grants.
alter table public.invite_codes enable row level security;
revoke all on table public.invite_codes from anon, authenticated;
grant all on table public.invite_codes to service_role;
