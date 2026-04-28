-- 1. Add new columns to queue_entries
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS device_type text;

-- 2. Add 'collected' to queue_entry_status enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'collected'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'queue_entry_status')
  ) THEN
    ALTER TYPE public.queue_entry_status ADD VALUE 'collected';
  END IF;
END $$;

-- 3. Add default_capacity column to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS default_capacity integer NOT NULL DEFAULT 50;

-- 4. Ensure trigger that auto-adds the workspace owner as a member exists
DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.workspaces;
CREATE TRIGGER trg_add_owner_as_member
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_as_member();

-- 5. Backfill: any existing workspace whose owner is not yet a member
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 6. Update join_lobby to accept phone + device, dedupe by phone, validate
CREATE OR REPLACE FUNCTION public.join_lobby(
  _lobby_id uuid,
  _name text,
  _user_id uuid DEFAULT NULL,
  _phone text DEFAULT NULL,
  _device_type text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _count int;
  _next_pos int;
  _entry public.queue_entries%ROWTYPE;
  _clean_name text := btrim(coalesce(_name, ''));
  _clean_phone text := nullif(btrim(coalesce(_phone, '')), '');
  _clean_device text := nullif(btrim(coalesce(_device_type, '')), '');
BEGIN
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = 'check_violation';
  END IF;
  IF _clean_phone IS NOT NULL AND (char_length(_clean_phone) < 4 OR char_length(_clean_phone) > 32) THEN
    RAISE EXCEPTION 'Invalid phone' USING ERRCODE = 'check_violation';
  END IF;
  IF _clean_device IS NOT NULL AND char_length(_clean_device) > 80 THEN
    RAISE EXCEPTION 'Invalid device type' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby is closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');

  IF _count >= _lobby.max_capacity THEN
    RAISE EXCEPTION 'Lobby is full' USING ERRCODE = 'check_violation';
  END IF;

  -- Prevent duplicate active entry for signed-in users
  IF _user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND user_id = _user_id AND status IN ('waiting','serving')
    ) THEN
      RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Prevent duplicate active entry for the same phone in the same lobby
  IF _clean_phone IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND phone = _clean_phone AND status IN ('waiting','serving')
    ) THEN
      RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_pos
    FROM public.queue_entries WHERE lobby_id = _lobby_id;

  INSERT INTO public.queue_entries (lobby_id, user_id, name, phone, device_type, position, status)
  VALUES (_lobby_id, _user_id, _clean_name, _clean_phone, _clean_device, _next_pos, 'waiting')
  RETURNING * INTO _entry;

  RETURN _entry;
END
$$;

-- 7. Mark-as-collected RPC for admins
CREATE OR REPLACE FUNCTION public.mark_collected(_entry_id uuid)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry public.queue_entries%ROWTYPE;
  _ws uuid;
BEGIN
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
END $$;