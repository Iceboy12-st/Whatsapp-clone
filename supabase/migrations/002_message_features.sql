/*
  002 — Message features

  - messages: media, replies, forwarding, edit, delete-for-everyone, optimistic client_id.
  - message_reactions, message_deletions (delete for me), starred_messages,
    message_reads (delivered / read receipts), blocked_users, reports.
  - Blocking is enforced on message INSERT for direct chats.
*/

-- ============ MESSAGES: NEW COLUMNS ============
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_size bigint,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS duration numeric,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_type_check') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_type_check
      CHECK (type IN ('text', 'image', 'video', 'document', 'audio', 'system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_length') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_content_length CHECK (char_length(content) <= 10000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin (to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_id);

-- ============ NEW TABLES ============
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE message_reactions ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reactions_conversation ON message_reactions (conversation_id);

CREATE TABLE IF NOT EXISTS message_deletions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_deletions_user_conv ON message_deletions (user_id, conversation_id);

CREATE TABLE IF NOT EXISTS starred_messages (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reads_conversation ON message_reads (conversation_id);

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.message_conversation(_mid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT conversation_id FROM messages WHERE id = _mid;
$$;

-- True when this is a direct chat and either side has blocked the other.
CREATE OR REPLACE FUNCTION public.is_blocked_in(_cid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversations c
    JOIN conversation_participants other
      ON other.conversation_id = c.id AND other.user_id <> auth.uid()
    JOIN blocked_users b
      ON (b.blocker_id = auth.uid() AND b.blocked_id = other.user_id)
      OR (b.blocker_id = other.user_id AND b.blocked_id = auth.uid())
    WHERE c.id = _cid AND NOT c.is_group
  );
$$;

-- ============ POLICIES: MESSAGES ============
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND type <> 'system'
    AND public.is_conversation_member(conversation_id)
    AND NOT public.is_blocked_in(conversation_id)
  );

DROP POLICY IF EXISTS "messages_update_sender" ON messages;
CREATE POLICY "messages_update_sender"
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender"
  ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Only content / edited_at / delete-for-everyone fields may change.
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF new.conversation_id <> old.conversation_id
     OR new.sender_id <> old.sender_id
     OR new.created_at <> old.created_at
     OR new.type <> old.type THEN
    RAISE EXCEPTION 'Immutable message fields cannot change';
  END IF;
  IF old.deleted_for_everyone THEN
    RAISE EXCEPTION 'Deleted messages cannot be edited';
  END IF;
  IF new.deleted_for_everyone THEN
    new.content := '';
    new.media_url := NULL;
    new.media_name := NULL;
  ELSIF new.content IS DISTINCT FROM old.content THEN
    new.edited_at := now();
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_message_update ON messages;
CREATE TRIGGER on_message_update
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

-- ============ POLICIES: REACTIONS ============
DROP POLICY IF EXISTS "reactions_select_member" ON message_reactions;
CREATE POLICY "reactions_select_member"
  ON message_reactions FOR SELECT TO authenticated
  USING (public.is_conversation_member(public.message_conversation(message_id)));

DROP POLICY IF EXISTS "reactions_insert_own" ON message_reactions;
CREATE POLICY "reactions_insert_own"
  ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND conversation_id = public.message_conversation(message_id)
    AND public.is_conversation_member(conversation_id)
  );

DROP POLICY IF EXISTS "reactions_update_own" ON message_reactions;
CREATE POLICY "reactions_update_own"
  ON message_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_delete_own" ON message_reactions;
CREATE POLICY "reactions_delete_own"
  ON message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ POLICIES: DELETIONS / STARS (private to the user) ============
DROP POLICY IF EXISTS "deletions_own" ON message_deletions;
CREATE POLICY "deletions_own"
  ON message_deletions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND conversation_id = public.message_conversation(message_id)
    AND public.is_conversation_member(conversation_id)
  );

DROP POLICY IF EXISTS "starred_own" ON starred_messages;
CREATE POLICY "starred_own"
  ON starred_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND conversation_id = public.message_conversation(message_id)
    AND public.is_conversation_member(conversation_id)
  );

-- ============ POLICIES: READS ============
DROP POLICY IF EXISTS "reads_select_member" ON message_reads;
CREATE POLICY "reads_select_member"
  ON message_reads FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));
-- Writes go through mark_conversation_read / mark_delivered RPCs.

-- ============ POLICIES: BLOCKS / REPORTS ============
DROP POLICY IF EXISTS "blocks_select_involved" ON blocked_users;
CREATE POLICY "blocks_select_involved"
  ON blocked_users FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS "blocks_insert_own" ON blocked_users;
CREATE POLICY "blocks_insert_own"
  ON blocked_users FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_delete_own" ON blocked_users;
CREATE POLICY "blocks_delete_own"
  ON blocked_users FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
