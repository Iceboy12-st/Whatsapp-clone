/*
  001 — Core schema fixes

  - Adds per-member chat settings (role, pin, mute, archive, favourite, clear, hide).
  - Adds profile privacy / presence columns and an onboarding flag.
  - Replaces the self-referencing RLS policies on conversation_participants
    (which cause "infinite recursion detected in policy") with SECURITY DEFINER helpers.
  - Closes the hole where any user could insert themselves into any conversation:
    membership is now only created through the RPCs in 003_rpcs.sql.
*/

-- ============ COLUMNS ============
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_role_check'
  ) THEN
    ALTER TABLE conversation_participants
      ADD CONSTRAINT conversation_participants_role_check CHECK (role IN ('admin', 'member'));
  END IF;
END $$;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz,
  ADD COLUMN IF NOT EXISTS show_last_seen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Existing users already picked a name, don't force them through setup again.
UPDATE profiles SET onboarded = true WHERE display_name <> '' AND onboarded = false;

-- Group creators become admins.
UPDATE conversation_participants cp
SET role = 'admin'
FROM conversations c
WHERE c.id = cp.conversation_id AND c.is_group AND c.created_by = cp.user_id;

-- ============ HELPERS (SECURITY DEFINER => no RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_conversation_member(_cid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _cid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(_cid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _cid AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_conversation_with(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants a
    JOIN conversation_participants b ON b.conversation_id = a.conversation_id
    WHERE a.user_id = auth.uid() AND b.user_id = _uid
  );
$$;

-- ============ POLICIES: CONVERSATIONS ============
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
CREATE POLICY "conversations_update_participant"
  ON conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id) AND (NOT is_group OR public.is_conversation_admin(id)))
  WITH CHECK (public.is_conversation_member(id) AND (NOT is_group OR public.is_conversation_admin(id)));

DROP POLICY IF EXISTS "conversations_delete_participant" ON conversations;
CREATE POLICY "conversations_delete_participant"
  ON conversations FOR DELETE TO authenticated
  USING (is_group AND public.is_conversation_admin(id));

-- ============ POLICIES: CONVERSATION PARTICIPANTS ============
DROP POLICY IF EXISTS "cp_select_participant" ON conversation_participants;
CREATE POLICY "cp_select_participant"
  ON conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

-- Membership rows are created only by SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "cp_insert_self" ON conversation_participants;

DROP POLICY IF EXISTS "cp_update_own" ON conversation_participants;
CREATE POLICY "cp_update_own"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_delete_self" ON conversation_participants;
CREATE POLICY "cp_delete_self"
  ON conversation_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_conversation_admin(conversation_id));

-- A member may not promote themselves by updating their own row.
CREATE OR REPLACE FUNCTION public.guard_participant_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.conversation_id <> old.conversation_id OR new.user_id <> old.user_id THEN
    RAISE EXCEPTION 'Cannot move membership rows';
  END IF;
  IF new.role <> old.role
     AND NOT public.is_conversation_admin(new.conversation_id)
     AND coalesce(current_setting('app.bypass_role_guard', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_participant_update ON conversation_participants;
CREATE TRIGGER on_participant_update
  BEFORE UPDATE ON conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.guard_participant_update();
