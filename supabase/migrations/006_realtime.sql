/*
  006 — Realtime publication

  Adds every table the client listens to into supabase_realtime (idempotent) and sets
  REPLICA IDENTITY FULL where the client needs the old row on UPDATE / DELETE.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'messages', 'conversations', 'conversation_participants', 'message_reactions',
    'message_reads', 'statuses', 'status_views', 'profiles', 'blocked_users'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE message_reactions REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;
