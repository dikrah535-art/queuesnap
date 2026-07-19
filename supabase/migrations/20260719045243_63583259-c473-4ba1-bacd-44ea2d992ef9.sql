
-- 1. join_lobby: drop overloads, use auth.uid()
DROP FUNCTION IF EXISTS public.join_lobby(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.join_lobby(uuid, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.join_lobby(uuid, text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.join_lobby(
  _lobby_id uuid,
  _name text,
  _phone text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _service_type text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _count int;
  _next_pos int;
  _entry public.queue_entries%ROWTYPE;
  _uid uuid := auth.uid();
  _clean_name text := btrim(coalesce(_name, ''));
  _clean_phone text := nullif(btrim(coalesce(_phone, '')), '');
  _clean_device text := nullif(btrim(coalesce(_device_type, '')), '');
  _clean_service text := nullif(btrim(coalesce(_service_type, '')), '');
BEGIN
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = 'check_violation';
  END IF;
  IF _clean_phone IS NOT NULL AND (char_length(_clean_phone) < 4 OR char_length(_clean_phone) > 32) THEN
    RAISE EXCEPTION 'Invalid phone' USING ERRCODE = 'check_violation';
  END IF;
  IF _clean_service IS NOT NULL AND char_length(_clean_service) > 40 THEN
    RAISE EXCEPTION 'Invalid service type' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found' USING ERRCODE = 'no_data_found'; END IF;
  IF _lobby.status <> 'open' THEN RAISE EXCEPTION 'Lobby is closed' USING ERRCODE = 'check_violation'; END IF;

  SELECT COUNT(*) INTO _count FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');
  IF _count >= _lobby.max_capacity THEN RAISE EXCEPTION 'Lobby is full' USING ERRCODE = 'check_violation'; END IF;

  IF _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND user_id = _uid AND status IN ('waiting','serving')
  ) THEN RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation'; END IF;

  IF _clean_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND phone = _clean_phone AND status IN ('waiting','serving')
  ) THEN RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation'; END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_pos
    FROM public.queue_entries WHERE lobby_id = _lobby_id;

  INSERT INTO public.queue_entries (lobby_id, user_id, name, phone, device_type, service_type, position, status, last_confirmed_at)
  VALUES (_lobby_id, _uid, _clean_name, _clean_phone, _clean_device, _clean_service, _next_pos, 'waiting', now())
  RETURNING * INTO _entry;
  RETURN _entry;
END $function$;

-- 2. Lock down SECURITY DEFINER function EXECUTE privileges
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_lobby(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_demo_waiting() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimated_wait_seconds(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_device(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_position(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_ring(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_queue(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_presence(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_next_slot() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mark_collected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_queue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_lobby_entries_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lobby_analytics(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;

-- 3. Move pg_net out of public schema (drop + recreate; nothing in app uses it directly)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 4. Remove workspace_members from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.workspace_members;
