ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow authenticated insert on devices" ON public.devices;
DROP POLICY IF EXISTS "Allow read access to devices" ON public.devices;
DROP POLICY IF EXISTS "Public insert device" ON public.devices;
DROP POLICY IF EXISTS "Admins delete devices" ON public.devices;
DROP POLICY IF EXISTS "Admins full devices" ON public.devices;
DROP POLICY IF EXISTS "Admins read devices" ON public.devices;
DROP POLICY IF EXISTS "Admins update devices" ON public.devices;
DROP POLICY IF EXISTS "Owners read own device" ON public.devices;
DROP POLICY IF EXISTS "Full access for testing" ON public.devices;

CREATE POLICY "Full access for testing"
ON public.devices
FOR ALL
TO public
USING (true)
WITH CHECK (true);