-- The second task type is engineering thinking, not analytical.
-- Run once in Supabase Dashboard -> SQL Editor, after 0006_attachments.sql.
-- Existing rows keep their value: the enum label is renamed in place.

alter type public.task_type rename value 'analytical' to 'engineering';
