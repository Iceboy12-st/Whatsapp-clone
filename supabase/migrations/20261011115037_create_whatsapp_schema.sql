/*
# WhatsApp Clone — Database Schema

1. Overview
   This migration creates the full schema for a WhatsApp-style messaging app:
   user profiles, conversations (1:1 and group), conversation participants,
   and messages with text content and read receipts.

2. New Tables
   - `profiles`: Public user profile data (display name, avatar, about/status).
     One row per auth user, auto-created on signup via trigger.
   - `conversations`: Chat container — either a direct message or a group chat.
   - `conversation_participants`: Junction table linking users to conversations.
   - `messages`: Individual messages within a conversation.

3. Security (RLS)
   - `profiles`: Authenticated users can read all profiles, update only their own.
   - `conversations`: CRUD scoped to participants via subquery on conversation_participants.
   - `conversation_participants`: Read if you're a participant; insert/update/delete only self.
   - `messages`: Read/insert/delete only in conversations you participate in.

4. Triggers
   - Auto-create a profile row when a new auth user signs up.
   - Auto-update conversations.updated_at when a new message is inserted.
*/

-- ============ TABLES (all created first, before policies) ============

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  about text NOT NULL DEFAULT 'Available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text,
  avatar_url text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_user ON conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_cp_conversation ON conversation_participants (conversation_id);

-- ============ ENABLE RLS ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES: PROFILES ============
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ POLICIES: CONVERSATIONS ============
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
CREATE POLICY "conversations_insert_participant"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
CREATE POLICY "conversations_update_participant"
  ON conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_delete_participant" ON conversations;
CREATE POLICY "conversations_delete_participant"
  ON conversations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

-- ============ POLICIES: CONVERSATION PARTICIPANTS ============
DROP POLICY IF EXISTS "cp_select_participant" ON conversation_participants;
CREATE POLICY "cp_select_participant"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cp_insert_self" ON conversation_participants;
CREATE POLICY "cp_insert_self"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_update_own" ON conversation_participants;
CREATE POLICY "cp_update_own"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_delete_self" ON conversation_participants;
CREATE POLICY "cp_delete_self"
  ON conversation_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ POLICIES: MESSAGES ============
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender"
  ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- ============ TRIGGER: Auto-create profile on signup ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============ TRIGGER: Update conversations.updated_at on new message ============
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = new.conversation_id;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
