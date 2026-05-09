
-- 1. queue_entries: hide phone/email/notified_email from public + authenticated direct selects
REVOKE SELECT ON public.queue_entries FROM anon, authenticated;
GRANT SELECT (id, lobby_id, user_id, name, device_type, position, status, created_at, served_at, is_vip)
  ON public.queue_entries TO anon, authenticated;

-- Safe public view (no phone/email)
CREATE OR REPLACE VIEW public.public_queue_entries AS
  SELECT id, lobby_id, user_id, name, device_type, position, status, created_at, served_at, is_vip
  FROM public.queue_entries;
GRANT SELECT ON public.public_queue_entries TO anon, authenticated;

-- 2. demo_visitors: only global admins can SELECT
DROP POLICY IF EXISTS "Authenticated can view demo visitors" ON public.demo_visitors;
CREATE POLICY "Only admins can view demo visitors"
  ON public.demo_visitors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Lock down SECURITY DEFINER function execution
-- Internal trigger-only:
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_slot_occupancy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_workspace_owner_user_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_demo_lobby_delete() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs (require auth):
REVOKE EXECUTE ON FUNCTION public.serve_next(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_queue(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_collected(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fetch_lobby_entries_admin(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_next_slot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_queue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_collected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_lobby_entries_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_next_slot() TO authenticated;

-- Public-callable (anon allowed) RPCs — keep accessible:
-- join_lobby, lookup_device, queue_position, join_queue, ack_ring, resolve_lobby, count_demo_waiting,
-- has_role, is_workspace_admin/member/owner — leave default grants intact.
