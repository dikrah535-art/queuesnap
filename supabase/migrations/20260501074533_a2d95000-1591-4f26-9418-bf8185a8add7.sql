
-- =========================================================
-- 1. PHONE PRIVACY: revoke phone column from anon + authenticated
-- =========================================================
-- Public JoinLobby page only reads name/position/status — never phone.
-- Only workspace admins should see phones, via the SECURITY DEFINER RPC below.
REVOKE SELECT (phone) ON public.queue_entries FROM anon, authenticated;

-- Admin-only fetch that includes phone, scoped to the lobby's workspace
CREATE OR REPLACE FUNCTION public.fetch_lobby_entries_admin(
  _lobby_id uuid,
  _include_all boolean DEFAULT false
)
RETURNS SETOF public.queue_entries
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT workspace_id INTO _ws FROM public.lobbies WHERE id = _lobby_id;
  IF _ws IS NULL THEN
    RAISE EXCEPTION 'Lobby not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT * FROM public.queue_entries
     WHERE lobby_id = _lobby_id
       AND (_include_all OR status IN ('waiting','serving'))
     ORDER BY position ASC;
END $$;

REVOKE EXECUTE ON FUNCTION public.fetch_lobby_entries_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_lobby_entries_admin(uuid, boolean) TO authenticated;

-- =========================================================
-- 2. REALTIME LEAK FIX: tighten workspace_members SELECT visibility
-- (Realtime evaluates SELECT policies; current policy already restricts
--  to workspace members, so this is mostly verification — no broadcast
--  goes to non-members. We re-assert the policy explicitly.)
-- =========================================================
DROP POLICY IF EXISTS "Members can view members" ON public.workspace_members;
CREATE POLICY "Members can view members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- =========================================================
-- 3. REVOKE PUBLIC EXECUTE on internal functions
-- =========================================================
-- Trigger functions: never called directly
REVOKE EXECUTE ON FUNCTION public.sync_workspace_owner_user_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_slot_occupancy() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Slot-management: only admins should request slots
REVOKE EXECUTE ON FUNCTION public.assign_next_slot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_next_slot() TO authenticated;

-- queue_position: takes a UUID + token, used by status page; restrict to authenticated
REVOKE EXECUTE ON FUNCTION public.queue_position(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_position(uuid, text) TO anon, authenticated;

-- join_lobby: must remain callable by anon (public join page).
-- Keep PUBLIC EXECUTE intentionally — security is enforced inside the function.
-- (No change needed; documenting intent.)

-- =========================================================
-- 4. STRENGTHEN auth checks inside SECURITY DEFINER admin functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_workspace_admin_by_email(_workspace_id uuid, _email text)
 RETURNS public.workspace_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid; _row public.workspace_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_workspace_admin(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO _uid FROM public.profiles WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user found with that email' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _uid, 'admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO _row;

  RETURN _row;
END $function$;

CREATE OR REPLACE FUNCTION public.mark_collected(_entry_id uuid)
 RETURNS public.queue_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry public.queue_entries%ROWTYPE;
  _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT l.workspace_id INTO _ws
  FROM public.queue_entries qe
  JOIN public.lobbies l ON l.id = qe.lobby_id
  WHERE qe.id = _entry_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.queue_entries
     SET status = 'collected', served_at = COALESCE(served_at, now())
   WHERE id = _entry_id
   RETURNING * INTO _entry;
  RETURN _entry;
END $function$;

CREATE OR REPLACE FUNCTION public.serve_next(_lobby_id uuid)
 RETURNS public.queue_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _next public.queue_entries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_lobby.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.queue_entries
     SET status = 'served', served_at = now()
   WHERE lobby_id = _lobby_id AND status = 'serving';

  UPDATE public.queue_entries
     SET status = 'serving'
   WHERE id = (
     SELECT id FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND status = 'waiting'
      ORDER BY position ASC LIMIT 1
   )
   RETURNING * INTO _next;

  RETURN _next;
END $function$;

CREATE OR REPLACE FUNCTION public.clear_queue(_lobby_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ws uuid; _count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT workspace_id INTO _ws FROM public.lobbies WHERE id = _lobby_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.queue_entries
     SET status = 'cancelled'
   WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $function$;
