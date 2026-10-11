/*
  004 — Status (stories)

  24-hour text / image statuses, visible to the poster and to anyone who shares a chat
  with them (and isn't blocked). status_views records who viewed what.
*/

CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text', 'image')),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 700),
  media_url text,
  bg_color text NOT NULL DEFAULT '#00a884',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_statuses_user_expires ON statuses (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS status_views (
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_blocked_with(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = auth.uid() AND blocked_id = _uid)
       OR (blocker_id = _uid AND blocked_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.status_owner(_sid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_id FROM statuses WHERE id = _sid;
$$;

DROP POLICY IF EXISTS "statuses_select_contacts" ON statuses;
CREATE POLICY "statuses_select_contacts"
  ON statuses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      expires_at > now()
      AND public.shares_conversation_with(user_id)
      AND NOT public.is_blocked_with(user_id)
    )
  );

DROP POLICY IF EXISTS "statuses_insert_own" ON statuses;
CREATE POLICY "statuses_insert_own"
  ON statuses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND expires_at <= now() + interval '24 hours 1 minute');

DROP POLICY IF EXISTS "statuses_delete_own" ON statuses;
CREATE POLICY "statuses_delete_own"
  ON statuses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "status_views_select" ON status_views;
CREATE POLICY "status_views_select"
  ON status_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR public.status_owner(status_id) = auth.uid());

DROP POLICY IF EXISTS "status_views_insert_own" ON status_views;
CREATE POLICY "status_views_insert_own"
  ON status_views FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_id AND s.user_id <> auth.uid())
  );

-- Optional cleanup if pg_cron is enabled (Database > Extensions > pg_cron):
-- SELECT cron.schedule('purge-expired-statuses', '0 * * * *', $$DELETE FROM statuses WHERE expires_at < now()$$);
