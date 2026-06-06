
ALTER TYPE public.queue_entry_status ADD VALUE IF NOT EXISTS 'no_show';

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz;

-- Update join_lobby to accept service_type
CREATE OR REPLACE FUNCTION public.join_lobby(
  _lobby_id uuid, _name text, _user_id uuid DEFAULT NULL::uuid,
  _phone text DEFAULT NULL::text, _device_type text DEFAULT NULL::text,
  _service_type text DEFAULT NULL::text
)
 RETURNS public.queue_entries
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _count int;
  _next_pos int;
  _entry public.queue_entries%ROWTYPE;
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

  IF _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND user_id = _user_id AND status IN ('waiting','serving')
  ) THEN RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation'; END IF;

  IF _clean_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND phone = _clean_phone AND status IN ('waiting','serving')
  ) THEN RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation'; END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_pos
    FROM public.queue_entries WHERE lobby_id = _lobby_id;

  INSERT INTO public.queue_entries (lobby_id, user_id, name, phone, device_type, service_type, position, status, last_confirmed_at)
  VALUES (_lobby_id, _user_id, _clean_name, _clean_phone, _clean_device, _clean_service, _next_pos, 'waiting', now())
  RETURNING * INTO _entry;
  RETURN _entry;
END $function$;

-- Update admin_add_entry to accept service_type
CREATE OR REPLACE FUNCTION public.admin_add_entry(
  _lobby_id uuid, _name text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text,
  _device_type text DEFAULT NULL::text, _is_vip boolean DEFAULT false,
  _service_type text DEFAULT NULL::text
)
 RETURNS public.queue_entries
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _entry public.queue_entries%ROWTYPE;
  _pos int;
  _clean_name text := btrim(coalesce(_name,''));
  _clean_phone text := nullif(btrim(coalesce(_phone,'')),'');
  _clean_email text := nullif(btrim(coalesce(_email,'')),'');
  _clean_device text := nullif(btrim(coalesce(_device_type,'')),'');
  _clean_service text := nullif(btrim(coalesce(_service_type,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege'; END IF;
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE='check_violation';
  END IF;
  IF _clean_email IS NOT NULL AND _clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_lobby.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;

  IF _is_vip THEN
    SELECT COALESCE(MIN(position), 1) - 1 INTO _pos FROM public.queue_entries
     WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');
  ELSE
    SELECT COALESCE(MAX(position), 0) + 1 INTO _pos FROM public.queue_entries WHERE lobby_id = _lobby_id;
  END IF;

  INSERT INTO public.queue_entries (lobby_id, name, phone, email, device_type, service_type, is_vip, position, status, last_confirmed_at)
  VALUES (_lobby_id, _clean_name, _clean_phone, _clean_email, _clean_device, _clean_service, _is_vip, _pos, 'waiting', now())
  RETURNING * INTO _entry;
  RETURN _entry;
END $function$;

-- Mark no-show RPC
CREATE OR REPLACE FUNCTION public.mark_no_show(_entry_id uuid)
 RETURNS public.queue_entries
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _entry public.queue_entries%ROWTYPE; _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT l.workspace_id INTO _ws FROM public.queue_entries qe
    JOIN public.lobbies l ON l.id = qe.lobby_id WHERE qe.id = _entry_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE public.queue_entries SET status = 'no_show', served_at = now()
   WHERE id = _entry_id RETURNING * INTO _entry;
  RETURN _entry;
END $function$;

-- Confirm presence (visitor can update their own entry)
CREATE OR REPLACE FUNCTION public.confirm_presence(_entry_id uuid)
 RETURNS public.queue_entries
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _entry public.queue_entries%ROWTYPE;
BEGIN
  UPDATE public.queue_entries SET last_confirmed_at = now()
   WHERE id = _entry_id AND status IN ('waiting','serving')
   RETURNING * INTO _entry;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found or not active'; END IF;
  RETURN _entry;
END $function$;

REVOKE ALL ON FUNCTION public.mark_no_show(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_presence(uuid) TO anon, authenticated, service_role;

-- Update fetch_lobby_entries_admin: still returns SETOF queue_entries (auto-picks new columns)
-- serve_next: skip no_show entries already excluded since only 'waiting' is selected; OK.
