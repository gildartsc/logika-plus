-- Stage 8: files attached to answers.
-- Run once in Supabase Dashboard -> SQL Editor, after 0005_admin.sql.

-- Private bucket. No storage policies are created for anon/authenticated,
-- so clients cannot read or list it; the server uses the service role after
-- its own access checks and hands out short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'answer-files',
  'answer-files',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- submission_id stays empty while a file is uploaded but its answer is not
-- sent yet; such pending rows are cleaned up after a day.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in (
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create index attachments_submission_idx on public.attachments (submission_id);
create index attachments_user_task_idx on public.attachments (user_id, task_id, created_at);

alter table public.attachments enable row level security;
revoke all on table public.attachments from anon, authenticated;
grant all on table public.attachments to service_role;
grant select on table public.attachments to authenticated;

-- A student sees only the metadata of their own files.
create policy attachments_select_own
  on public.attachments for select to authenticated
  using ((select auth.uid()) = user_id);
