ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing device policies for a clean slate
DROP POLICY IF EXISTS "Full access for testing" ON public.devices;
DROP POLICY IF EXISTS "Allow public insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow authenticated insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow read access to devices" ON public.devices;
DROP POLICY IF EXISTS "Public insert device" ON public.devices;
DROP POLICY IF EXISTS "Public insert devices" ON public.devices;
DROP POLICY IF EXISTS "Public read devices" ON public.devices;
DROP POLICY IF EXISTS "Admins full devices" ON public.devices;
DROP POLICY IF EXISTS "Admins read devices" ON public.devices;
DROP POLICY IF EXISTS "Admins update devices" ON public.devices;
DROP POLICY IF EXISTS "Admins delete devices" ON public.devices;
DROP POLICY IF EXISTS "Owners read own device" ON public.devices;
DROP POLICY IF EXISTS "User insert own device" ON public.devices;
DROP POLICY IF EXISTS "User read own devices" ON public.devices;

-- Public (anonymous) INSERT for self check-in, with strict field validation
CREATE POLICY "Public insert devices"
ON public.devices
FOR INSERT
TO anon, authenticated
WITH CHECK (
  owner_name IS NOT NULL
  AND char_length(btrim(owner_name)) BETWEEN 2 AND 80
  AND (owner_id_text IS NULL OR char_length(owner_id_text) <= 40)
  AND (owner_email IS NULL OR (char_length(owner_email) <= 120 AND owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND (phone_model IS NULL OR char_length(phone_model) <= 120)
  AND status = 'checked_in'::public.device_status
  AND ringing = false
  AND owner_user_id IS NULL
  AND called_time IS NULL
  AND collection_time IS NULL
  AND queue_time IS NULL
);

-- Admins: full read access
CREATE POLICY "Admins read devices"
ON public.devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated owners: read their own linked device records
CREATE POLICY "Owners read own device"
ON public.devices
FOR SELECT
TO authenticated
USING (owner_user_id IS NOT NULL AND owner_user_id = auth.uid());

-- Admins: update devices
CREATE POLICY "Admins update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins: delete devices
CREATE POLICY "Admins delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- NOTE: Anonymous status lookups continue to work via the SECURITY DEFINER
-- function public.lookup_device(_token), which bypasses RLS safely and only
-- returns a single row matched by token_code/id. No public SELECT is needed.