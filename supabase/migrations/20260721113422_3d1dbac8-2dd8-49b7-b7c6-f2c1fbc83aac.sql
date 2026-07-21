
-- 1. Persistent ringing state on queue_entries
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS ringing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ringing_at timestamptz;

-- 2. Allow "skipped" status (status is a text column, no enum change needed if it's text;
-- if it's an enum, add the value defensively)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'queue_entry_status'
    LIMIT 1
  ) THEN
    BEGIN
      ALTER TYPE public.queue_entry_status ADD VALUE IF NOT EXISTS 'skipped';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- 3. Ring / stop-ring (admin only)
CREATE OR REPLACE FUNCTION public.set_ringing(_entry_id uuid, _on boolean)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE _entry public.queue_entries%ROWTYPE; _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT l.workspace_id INTO _ws
    FROM public.queue_entries qe JOIN public.lobbies l ON l.id = qe.lobby_id
   WHERE qe.id = _entry_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE public.queue_entries
     SET ringing = _on,
         ringing_at = CASE WHEN _on THEN now() ELSE NULL END
   WHERE id = _entry_id
   RETURNING * INTO _entry;
  RETURN _entry;
END $fn$;

REVOKE ALL ON FUNCTION public.set_ringing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ringing(uuid, boolean) TO authenticated;

-- 4. Skip an entry (marks as 'skipped' so they can be reinstated later)
CREATE OR REPLACE FUNCTION public.skip_entry(_entry_id uuid)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE _entry public.queue_entries%ROWTYPE; _ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT l.workspace_id INTO _ws
    FROM public.queue_entries qe JOIN public.lobbies l ON l.id = qe.lobby_id
   WHERE qe.id = _entry_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE public.queue_entries
     SET status = 'skipped', ringing = false, ringing_at = NULL
   WHERE id = _entry_id
   RETURNING * INTO _entry;
  RETURN _entry;
END $fn$;

REVOKE ALL ON FUNCTION public.skip_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skip_entry(uuid) TO authenticated;

-- 5. Reinstate a skipped entry back to end of queue
CREATE OR REPLACE FUNCTION public.reinstate_entry(_entry_id uuid)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE _entry public.queue_entries%ROWTYPE; _ws uuid; _lobby uuid; _pos int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT l.workspace_id, qe.lobby_id INTO _ws, _lobby
    FROM public.queue_entries qe JOIN public.lobbies l ON l.id = qe.lobby_id
   WHERE qe.id = _entry_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT COALESCE(MAX(position),0) + 1 INTO _pos
    FROM public.queue_entries WHERE lobby_id = _lobby;
  UPDATE public.queue_entries
     SET status = 'waiting', position = _pos, last_confirmed_at = now()
   WHERE id = _entry_id
   RETURNING * INTO _entry;
  RETURN _entry;
END $fn$;

REVOKE ALL ON FUNCTION public.reinstate_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reinstate_entry(uuid) TO authenticated;

-- 6. Bulk simulate mock entries for stress-testing
CREATE OR REPLACE FUNCTION public.simulate_entries(_lobby_id uuid, _count int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _ws uuid; _lobby public.lobbies%ROWTYPE; _pos int; _i int; _n int;
  _names text[] := ARRAY['Alex','Priya','Sam','Jordan','Riya','Kai','Nia','Zoe','Ravi','Maya','Leo','Ana','Ben','Tara','Owen'];
  _services text[] := ARRAY['Quick Service','Consultation','Repair'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_lobby.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;
  _n := GREATEST(1, LEAST(50, COALESCE(_count, 10)));
  SELECT COALESCE(MAX(position),0) INTO _pos FROM public.queue_entries WHERE lobby_id = _lobby_id;
  FOR _i IN 1.._n LOOP
    _pos := _pos + 1;
    INSERT INTO public.queue_entries
      (lobby_id, name, phone, device_type, service_type, position, status, last_confirmed_at)
    VALUES (
      _lobby_id,
      _names[1 + (floor(random()*array_length(_names,1)))::int] || ' ' || substr(md5(random()::text),1,3),
      NULL,
      'Sim device',
      _services[1 + (floor(random()*array_length(_services,1)))::int],
      _pos,
      'waiting',
      now()
    );
  END LOOP;
  RETURN _n;
END $fn$;

REVOKE ALL ON FUNCTION public.simulate_entries(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulate_entries(uuid, int) TO authenticated;
