-- Security check of the database. Run in Supabase Dashboard -> SQL Editor.
-- Rows with ok = false are problems; ok = true rows are the expected
-- client privileges, listed for reference.
with checks as (
  -- Every table in public must have row level security.
  select 'RLS выключен' as check_name, c.relname::text as item, false as ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all
  -- Guests (anon) must have no rights on any table.
  select 'Права гостя (anon) на таблицу', table_name || ': ' || privilege_type, false
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'

  union all
  -- Signed-in users may only read; any other table right is a problem.
  select 'Лишнее право authenticated', table_name || ': ' || privilege_type, false
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and privilege_type <> 'SELECT'

  union all
  -- Our functions run only through the server (service role).
  select 'Функция доступна клиентам', p.proname::text, false
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))

  union all
  -- The file bucket is closed: no client policies, not public.
  select 'Политика хранилища для клиентов', policyname::text, false
  from pg_policies where schemaname = 'storage' and tablename = 'objects'

  union all
  select 'Публичное хранилище', id, false from storage.buckets where public

  union all
  -- Expected: SELECT on users, topics, user_progress, submissions, chat_history, attachments.
  select 'Чтение для authenticated (ожидается)', table_name::text, true
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'SELECT'

  union all
  -- Expected: only id, topic_id, type, public_text of tasks.
  select 'Столбцы tasks для authenticated (ожидается)', column_name::text, true
  from information_schema.column_privileges
  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'tasks'
)
select * from checks order by ok, check_name, item;
