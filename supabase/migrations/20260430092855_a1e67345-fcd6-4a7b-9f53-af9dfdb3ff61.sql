-- Reduce execute access for SECURITY DEFINER helpers while preserving public join/status flows.
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_slot_occupancy() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_collected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_collected(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.clear_queue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_queue(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.serve_next(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Public self-service flows that must remain callable.
GRANT EXECUTE ON FUNCTION public.assign_next_slot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_device(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_queue(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_ring(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_position(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid, text, text) TO anon, authenticated;