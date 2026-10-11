/*
  005 — Storage buckets and policies

  avatars     (public):  {user_id}/...        profile photos (owner writes)
                         groups/{chat_id}/... group icons (group admins write)
  chat-media  (private): {chat_id}/...        chat attachments (members read/write)
                         status/{user_id}/... status images (owner writes, signed-in users read)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-media', 'chat-media', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Safe uuid cast for folder names (non-uuid folders simply fail the check).
CREATE OR REPLACE FUNCTION public.is_member_of_folder(_folder text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.is_conversation_member(_folder::uuid);
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_folder(_folder text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.is_conversation_admin(_folder::uuid);
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

-- ============ AVATARS ============
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_write_own" ON storage.objects;
CREATE POLICY "avatars_write_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'groups' AND public.is_admin_of_folder((storage.foldername(name))[2]))
    )
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============ CHAT MEDIA ============
DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media' AND (
      (storage.foldername(name))[1] = 'status'
      OR public.is_member_of_folder((storage.foldername(name))[1])
    )
  );

DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;
CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media' AND (
      ((storage.foldername(name))[1] = 'status' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR public.is_member_of_folder((storage.foldername(name))[1])
    )
  );

DROP POLICY IF EXISTS "chat_media_delete_status" ON storage.objects;
CREATE POLICY "chat_media_delete_status"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = 'status'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
