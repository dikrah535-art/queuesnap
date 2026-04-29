-- Re-attach triggers that are required for app behavior

-- 1) Auto-create profile rows when a new auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Auto-add workspace owner as a member with role 'owner'
DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.workspaces;
CREATE TRIGGER trg_add_owner_as_member
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- 3) Touch updated_at on workspaces and lobbies
DROP TRIGGER IF EXISTS trg_touch_workspaces ON public.workspaces;
CREATE TRIGGER trg_touch_workspaces
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_lobbies ON public.lobbies;
CREATE TRIGGER trg_touch_lobbies
BEFORE UPDATE ON public.lobbies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Slot occupancy sync from devices
DROP TRIGGER IF EXISTS trg_sync_slot_occupancy ON public.devices;
CREATE TRIGGER trg_sync_slot_occupancy
AFTER INSERT OR UPDATE OR DELETE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.sync_slot_occupancy();

-- Backfill: ensure existing workspace owners are members (so they can read their workspace)
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'::workspace_role
FROM public.workspaces w
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';