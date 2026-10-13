-- Revoke EXECUTE on group management RPCs from anon (they check auth.uid() internally but shouldn't be callable without signing in)
REVOKE EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_group_admin(uuid, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_group(uuid) FROM anon;