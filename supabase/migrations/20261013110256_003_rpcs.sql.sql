/*
  003 — RPCs

  Chat creation, group management, chat list summary and read receipts.
  All mutating functions are SECURITY DEFINER and check auth.uid() themselves.
*/

-- ============ CHAT CREATION ============
CREATE OR REPLACE FUNCTION public.create_direct_chat(other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF other = me THEN RAISE EXCEPTION 'You cannot start a chat with yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = other) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT c.id INTO cid
  FROM conversations c
  JOIN conversation_participants a ON a.conversation_id = c.id AND a.user_id = me
  JOIN conversation_participants b ON b.conversation_id = c.id AND b.user_id = other
  WHERE NOT c.is_group
  LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO conversations (is_group, created_by) VALUES (false, me) RETURNING id INTO cid;
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (cid, me, 'member'), (cid, other, 'member');
  ELSE
    UPDATE conversation_participants SET is_hidden = false
    WHERE conversation_id = cid AND user_id = me;
  END IF;

  RETURN cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_chat(_name text, member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cid uuid;
  my_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'Group name is required'; END IF;
  IF char_length(_name) > 100 THEN RAISE EXCEPTION 'Group name is too long'; END IF;

  INSERT INTO conversations (is_group, name, created_by)
  VALUES (true, trim(_name), me) RETURNING id INTO cid;

  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (cid, me, 'admin');

  INSERT INTO conversation_participants (conversation_id, user_id, role)
  SELECT DISTINCT cid, p.id, 'member'
  FROM profiles p
  WHERE p.id = ANY (member_ids) AND p.id <> me
  ON CONFLICT DO NOTHING;

  SELECT coalesce(nullif(display_name, ''), split_part(email, '@', 1)) INTO my_name FROM profiles WHERE id = me;
  INSERT INTO messages (conversation_id, sender_id, content, type)
  VALUES (cid, me, my_name || ' created group "' || trim(_name) || '"', 'system');

  RETURN cid;
END;
$$;

-- ============ GROUP MANAGEMENT ============
CREATE OR REPLACE FUNCTION public.profile_label(_uid uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(nullif(display_name, ''), split_part(email, '@', 1)) FROM profiles WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.add_group_members(_cid uuid, member_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  added uuid;
BEGIN
  IF NOT public.is_conversation_admin(_cid) THEN RAISE EXCEPTION 'Only admins can add members'; END IF;
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = _cid AND is_group) THEN
    RAISE EXCEPTION 'Not a group';
  END IF;

  FOR added IN
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    SELECT _cid, p.id, 'member' FROM profiles p WHERE p.id = ANY (member_ids)
    ON CONFLICT DO NOTHING
    RETURNING user_id
  LOOP
    INSERT INTO messages (conversation_id, sender_id, content, type)
    VALUES (_cid, me, public.profile_label(me) || ' added ' || public.profile_label(added), 'system');
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_member(_cid uuid, _uid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF NOT public.is_conversation_admin(_cid) THEN RAISE EXCEPTION 'Only admins can remove members'; END IF;
  IF _uid = me THEN RAISE EXCEPTION 'Use leave_group to leave'; END IF;

  DELETE FROM conversation_participants WHERE conversation_id = _cid AND user_id = _uid;
  IF FOUND THEN
    INSERT INTO messages (conversation_id, sender_id, content, type)
    VALUES (_cid, me, public.profile_label(me) || ' removed ' || public.profile_label(_uid), 'system');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_admin(_cid uuid, _uid uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_admin(_cid) THEN RAISE EXCEPTION 'Only admins can change roles'; END IF;
  UPDATE conversation_participants
  SET role = CASE WHEN _make_admin THEN 'admin' ELSE 'member' END
  WHERE conversation_id = _cid AND user_id = _uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_group(_cid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  was_admin boolean;
  successor uuid;
BEGIN
  SELECT role = 'admin' INTO was_admin
  FROM conversation_participants WHERE conversation_id = _cid AND user_id = me;
  IF was_admin IS NULL THEN RAISE EXCEPTION 'You are not a member of this group'; END IF;

  INSERT INTO messages (conversation_id, sender_id, content, type)
  VALUES (_cid, me, public.profile_label(me) || ' left', 'system');

  DELETE FROM conversation_participants WHERE conversation_id = _cid AND user_id = me;

  IF NOT EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = _cid) THEN
    DELETE FROM conversations WHERE id = _cid;
    RETURN;
  END IF;

  IF was_admin AND NOT EXISTS (
    SELECT 1 FROM conversation_participants WHERE conversation_id = _cid AND role = 'admin'
  ) THEN
    SELECT user_id INTO successor FROM conversation_participants
    WHERE conversation_id = _cid ORDER BY created_at ASC LIMIT 1;
    -- The leaving admin is no longer a member, so tell the role guard this promotion is allowed.
    PERFORM set_config('app.bypass_role_guard', 'on', true);
    UPDATE conversation_participants SET role = 'admin' WHERE conversation_id = _cid AND user_id = successor;
    PERFORM set_config('app.bypass_role_guard', 'off', true);
  END IF;
END;
$$;

-- Notify the group when its name / icon / description changes.
CREATE OR REPLACE FUNCTION public.log_group_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.is_group AND auth.uid() IS NOT NULL THEN
    IF new.name IS DISTINCT FROM old.name THEN
      INSERT INTO messages (conversation_id, sender_id, content, type)
      VALUES (new.id, auth.uid(), public.profile_label(auth.uid()) || ' changed the group name to "' || new.name || '"', 'system');
    END IF;
    IF new.avatar_url IS DISTINCT FROM old.avatar_url THEN
      INSERT INTO messages (conversation_id, sender_id, content, type)
      VALUES (new.id, auth.uid(), public.profile_label(auth.uid()) || ' changed this group''s icon', 'system');
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_group_update ON conversations;
CREATE TRIGGER on_group_update
  AFTER UPDATE OF name, avatar_url ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.log_group_change();

-- ============ CHAT LIST SUMMARY ============
CREATE OR REPLACE FUNCTION public.get_chat_summaries()
RETURNS TABLE (conversation_id uuid, last_message jsonb, unread_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    cp.conversation_id,
    (
      SELECT to_jsonb(m)
      FROM messages m
      WHERE m.conversation_id = cp.conversation_id
        AND (cp.cleared_at IS NULL OR m.created_at > cp.cleared_at)
        AND NOT EXISTS (
          SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = auth.uid()
        )
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message,
    (
      SELECT count(*)::integer
      FROM messages m
      WHERE m.conversation_id = cp.conversation_id
        AND m.sender_id <> auth.uid()
        AND m.type <> 'system'
        AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        AND (cp.cleared_at IS NULL OR m.created_at > cp.cleared_at)
    ) AS unread_count
  FROM conversation_participants cp
  WHERE cp.user_id = auth.uid();
$$;

-- ============ RECEIPTS ============
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_cid uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  send_receipts boolean;
BEGIN
  IF NOT public.is_conversation_member(_cid) THEN RETURN; END IF;
  SELECT read_receipts INTO send_receipts FROM profiles WHERE id = me;

  UPDATE conversation_participants SET last_read_at = now()
  WHERE conversation_id = _cid AND user_id = me;

  INSERT INTO message_reads (message_id, user_id, conversation_id, delivered_at, read_at)
  SELECT m.id, me, _cid, now(), CASE WHEN send_receipts THEN now() END
  FROM messages m
  WHERE m.conversation_id = _cid
    AND m.sender_id <> me
    AND m.type <> 'system'
    AND m.created_at > now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM message_reads r
      WHERE r.message_id = m.id AND r.user_id = me
        AND (r.read_at IS NOT NULL OR NOT send_receipts)
    )
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET read_at = coalesce(message_reads.read_at, excluded.read_at),
        delivered_at = coalesce(message_reads.delivered_at, excluded.delivered_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_delivered()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO message_reads (message_id, user_id, conversation_id, delivered_at)
  SELECT m.id, auth.uid(), m.conversation_id, now()
  FROM messages m
  JOIN conversation_participants cp
    ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND m.type <> 'system'
    AND m.created_at > now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = auth.uid()
    )
  ON CONFLICT DO NOTHING;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_summaries() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_delivered() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_direct_chat(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_group_chat(text, uuid[]) FROM anon;