-- Align workspace ownership with an explicit non-null user field while preserving existing owner_id usage.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.workspaces
   SET user_id = owner_id
 WHERE user_id IS NULL;

ALTER TABLE public.workspaces
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.workspaces(user_id);

CREATE OR REPLACE FUNCTION public.sync_workspace_owner_user_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, NEW.owner_id, auth.uid());
  NEW.owner_id := COALESCE(NEW.owner_id, NEW.user_id, auth.uid());

  IF NEW.user_id IS NULL OR NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.user_id <> NEW.owner_id THEN
    RAISE EXCEPTION 'Workspace owner mismatch' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_workspace_owner_user_ids ON public.workspaces;
CREATE TRIGGER trg_sync_workspace_owner_user_ids
BEFORE INSERT OR UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_owner_user_ids();

-- Restore automatic owner membership after workspace creation.
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_seed_owner ON public.workspaces;
DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.workspaces;
CREATE TRIGGER trg_add_owner_as_member
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_as_member();

-- Restore updated_at automation for workspace/lobby edits.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_updated ON public.workspaces;
DROP TRIGGER IF EXISTS trg_touch_workspaces ON public.workspaces;
CREATE TRIGGER trg_touch_workspaces
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_lobbies_updated ON public.lobbies;
DROP TRIGGER IF EXISTS trg_touch_lobbies ON public.lobbies;
CREATE TRIGGER trg_touch_lobbies
BEFORE UPDATE ON public.lobbies
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Restore slot occupancy automation used by the device queue.
DROP TRIGGER IF EXISTS trg_sync_slot_occupancy ON public.devices;
CREATE TRIGGER trg_sync_slot_occupancy
AFTER INSERT OR UPDATE OR DELETE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.sync_slot_occupancy();

-- Backfill memberships for any existing workspaces.
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.user_id, 'owner'
FROM public.workspaces w
WHERE w.user_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

-- Keep required table privileges present so RLS policies can evaluate.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.queue_entries TO anon;
GRANT SELECT, INSERT ON public.devices TO anon;

-- Workspace RLS: creators/members can view; only creators can create/edit/delete ownership records.
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace"
ON public.workspaces
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.is_workspace_member(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can create workspace" ON public.workspaces;
CREATE POLICY "Authenticated can create workspace"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK ((user_id = auth.uid()) AND (owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can update workspace" ON public.workspaces;
CREATE POLICY "Owner can update workspace"
ON public.workspaces
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) AND (owner_id = auth.uid()))
WITH CHECK ((user_id = auth.uid()) AND (owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can delete workspace" ON public.workspaces;
CREATE POLICY "Owner can delete workspace"
ON public.workspaces
FOR DELETE
TO authenticated
USING ((user_id = auth.uid()) AND (owner_id = auth.uid()));

-- Devices: allow signed-in users to submit their own device while preserving anonymous self check-in.
DROP POLICY IF EXISTS "Authenticated users insert own devices" ON public.devices;
CREATE POLICY "Authenticated users insert own devices"
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND owner_name IS NOT NULL
  AND char_length(btrim(owner_name)) BETWEEN 2 AND 80
  AND (owner_id_text IS NULL OR char_length(owner_id_text) <= 40)
  AND (owner_email IS NULL OR (char_length(owner_email) <= 120 AND owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND (phone_model IS NULL OR char_length(phone_model) <= 120)
  AND (slot_label IS NULL OR char_length(slot_label) <= 40)
  AND status = 'checked_in'::device_status
  AND ringing = false
  AND called_time IS NULL
  AND collection_time IS NULL
  AND queue_time IS NULL
  AND photo_url IS NULL
);

DROP POLICY IF EXISTS "Owners read own device" ON public.devices;
CREATE POLICY "Owners read own device"
ON public.devices
FOR SELECT
TO authenticated
USING (owner_user_id IS NOT NULL AND owner_user_id = auth.uid());