
-- 1) counters table
CREATE TABLE IF NOT EXISTS public.counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counters TO authenticated;
GRANT ALL ON public.counters TO service_role;

ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counters_select_members" ON public.counters
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "counters_write_admins" ON public.counters
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_counters_touch ON public.counters;
CREATE TRIGGER trg_counters_touch BEFORE UPDATE ON public.counters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) new columns on queue_entries
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS roll_number text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS counter_id uuid REFERENCES public.counters(id) ON DELETE SET NULL;

-- 3) update join_lobby to accept roll_number + device_model
CREATE OR REPLACE FUNCTION public.join_lobby(
  _lobby_id uuid,
  _name text,
  _phone text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _roll_number text DEFAULT NULL,
  _device_model text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  _clean_roll text := nullif(btrim(coalesce(_roll_number, '')), '');
  _clean_model text := nullif(btrim(coalesce(_device_model, '')), '');
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
  IF _clean_roll IS NOT NULL AND char_length(_clean_roll) > 40 THEN
    RAISE EXCEPTION 'Invalid roll/ID' USING ERRCODE = 'check_violation';
  END IF;
  IF _clean_model IS NOT NULL AND char_length(_clean_model) > 80 THEN
    RAISE EXCEPTION 'Invalid device model' USING ERRCODE = 'check_violation';
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

  INSERT INTO public.queue_entries
    (lobby_id, user_id, name, phone, device_type, service_type, roll_number, device_model,
     position, status, last_confirmed_at)
  VALUES
    (_lobby_id, _uid, _clean_name, _clean_phone, _clean_device, _clean_service, _clean_roll, _clean_model,
     _next_pos, 'waiting', now())
  RETURNING * INTO _entry;
  RETURN _entry;
END $$;

REVOKE EXECUTE ON FUNCTION public.join_lobby(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, text, text, text, text, text) TO anon, authenticated;

-- 4) update admin_add_entry to accept roll_number + device_model (new overload)
CREATE OR REPLACE FUNCTION public.admin_add_entry(
  _lobby_id uuid,
  _name text,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _is_vip boolean DEFAULT false,
  _service_type text DEFAULT NULL,
  _roll_number text DEFAULT NULL,
  _device_model text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _entry public.queue_entries%ROWTYPE;
  _pos int;
  _clean_name text := btrim(coalesce(_name,''));
  _clean_phone text := nullif(btrim(coalesce(_phone,'')),'');
  _clean_email text := nullif(btrim(coalesce(_email,'')),'');
  _clean_device text := nullif(btrim(coalesce(_device_type,'')),'');
  _clean_service text := nullif(btrim(coalesce(_service_type,'')),'');
  _clean_roll text := nullif(btrim(coalesce(_roll_number,'')),'');
  _clean_model text := nullif(btrim(coalesce(_device_model,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege'; END IF;
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE='check_violation';
  END IF;
  IF _clean_email IS NOT NULL AND _clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE='check_violation';
  END IF;
  IF _clean_roll IS NOT NULL AND char_length(_clean_roll) > 40 THEN
    RAISE EXCEPTION 'Invalid roll/ID' USING ERRCODE='check_violation';
  END IF;
  IF _clean_model IS NOT NULL AND char_length(_clean_model) > 80 THEN
    RAISE EXCEPTION 'Invalid device model' USING ERRCODE='check_violation';
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

  INSERT INTO public.queue_entries
    (lobby_id, name, phone, email, device_type, service_type, roll_number, device_model,
     is_vip, position, status, last_confirmed_at)
  VALUES
    (_lobby_id, _clean_name, _clean_phone, _clean_email, _clean_device, _clean_service, _clean_roll, _clean_model,
     _is_vip, _pos, 'waiting', now())
  RETURNING * INTO _entry;
  RETURN _entry;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean, text, text, text) TO authenticated;

-- 5) serve_next with optional counter_id
CREATE OR REPLACE FUNCTION public.serve_next(_lobby_id uuid, _counter_id uuid DEFAULT NULL)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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

  IF _counter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.counters WHERE id = _counter_id AND workspace_id = _lobby.workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid counter for this workspace' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.queue_entries
     SET status = 'served', served_at = now()
   WHERE lobby_id = _lobby_id AND status = 'serving';

  UPDATE public.queue_entries
     SET status = 'serving',
         counter_id = COALESCE(_counter_id, counter_id)
   WHERE id = (
     SELECT id FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND status = 'waiting'
      ORDER BY position ASC LIMIT 1
   )
   RETURNING * INTO _next;

  RETURN _next;
END $$;

REVOKE EXECUTE ON FUNCTION public.serve_next(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid, uuid) TO authenticated;
