DROP POLICY IF EXISTS "Full access for testing" ON public.devices;
DROP POLICY IF EXISTS "Allow public insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow authenticated insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow read access to devices" ON public.devices;
DROP POLICY IF EXISTS "Admins update devices" ON public.devices;
DROP POLICY IF EXISTS "Admins delete devices" ON public.devices;
DROP POLICY IF EXISTS "Owners read own device" ON public.devices;

CREATE POLICY "Allow public insert on devices"
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
);

CREATE POLICY "Allow read access to devices"
ON public.devices
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));