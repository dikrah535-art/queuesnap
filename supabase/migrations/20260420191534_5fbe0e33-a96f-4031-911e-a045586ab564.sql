-- Drop the broad public update policies that aren't needed
-- (keep "Public join queue" and "Public ack ring" as they are narrowly scoped)

-- Ensure admin-only DELETE
DROP POLICY IF EXISTS "Admins delete devices" ON public.devices;
CREATE POLICY "Admins delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure admin-only full UPDATE (the existing "Admins full devices" ALL policy already covers this,
-- but we make it explicit and idempotent)
DROP POLICY IF EXISTS "Admins update devices" ON public.devices;
CREATE POLICY "Admins update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Confirm INSERT remains open to the public (recreate to be explicit)
DROP POLICY IF EXISTS "Public insert device" ON public.devices;
CREATE POLICY "Public insert device"
ON public.devices
FOR INSERT
TO public
WITH CHECK (true);

-- Confirm SELECT remains open (for current testing phase)
DROP POLICY IF EXISTS "Public read device" ON public.devices;
CREATE POLICY "Public read device"
ON public.devices
FOR SELECT
TO public
USING (true);