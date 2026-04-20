-- Allow public SELECT on devices so insert .select() returning works for anon users
CREATE POLICY "Public read devices"
ON public.devices
FOR SELECT
TO anon, authenticated
USING (true);

-- Trigger function to sync slot occupancy automatically (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.sync_slot_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slot_id IS NOT NULL THEN
      UPDATE public.slots SET is_occupied = true WHERE id = NEW.slot_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Free slot when device is collected
    IF NEW.status = 'collected' AND OLD.status <> 'collected' AND OLD.slot_id IS NOT NULL THEN
      UPDATE public.slots SET is_occupied = false WHERE id = OLD.slot_id;
    END IF;
    -- Handle slot change
    IF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
      IF OLD.slot_id IS NOT NULL THEN
        UPDATE public.slots SET is_occupied = false WHERE id = OLD.slot_id;
      END IF;
      IF NEW.slot_id IS NOT NULL AND NEW.status <> 'collected' THEN
        UPDATE public.slots SET is_occupied = true WHERE id = NEW.slot_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.slot_id IS NOT NULL THEN
      UPDATE public.slots SET is_occupied = false WHERE id = OLD.slot_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_slot_occupancy ON public.devices;
CREATE TRIGGER trg_sync_slot_occupancy
AFTER INSERT OR UPDATE OR DELETE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.sync_slot_occupancy();