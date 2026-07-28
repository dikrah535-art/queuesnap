
-- 1. Add is_active toggle to counters
ALTER TABLE public.counters
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Master-pool Serve Next: atomic pick + counter tag + ringing
CREATE OR REPLACE FUNCTION public.serve_next(_lobby_id uuid, _counter_id uuid DEFAULT NULL)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF _counter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.counters
     WHERE id = _counter_id AND workspace_id = _lobby.workspace_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive counter' USING ERRCODE = 'check_violation';
  END IF;

  -- Finish anyone currently being served at THIS counter (or globally if no counter chosen)
  UPDATE public.queue_entries
     SET status = 'served', served_at = now(), ringing = false, ringing_at = NULL
   WHERE lobby_id = _lobby_id
     AND status = 'serving'
     AND (_counter_id IS NULL OR counter_id = _counter_id OR counter_id IS NULL);

  -- Atomically claim the oldest master-pool waiter (counter_id IS NULL preferred),
  -- fall back to entries already tagged to this counter.
  UPDATE public.queue_entries qe
     SET status = 'serving',
         counter_id = COALESCE(_counter_id, qe.counter_id),
         ringing = true,
         ringing_at = now()
   WHERE qe.id = (
     SELECT id FROM public.queue_entries
      WHERE lobby_id = _lobby_id
        AND status = 'waiting'
        AND (
          counter_id IS NULL
          OR (_counter_id IS NOT NULL AND counter_id = _counter_id)
        )
      ORDER BY (counter_id IS NULL) DESC, position ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING * INTO _next;

  RETURN _next;
END $function$;

REVOKE EXECUTE ON FUNCTION public.serve_next(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid, uuid) TO authenticated;
