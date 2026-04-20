-- Replace overly permissive device update policy
DROP POLICY IF EXISTS "Public update non-collected" ON public.devices;

-- Allow public to join the queue: only when current status is checked_in and new status is in_queue
CREATE POLICY "Public join queue" ON public.devices FOR UPDATE
USING (status = 'checked_in')
WITH CHECK (status = 'in_queue');

-- Allow public to acknowledge ring (set ringing=false) when called or in_queue
CREATE POLICY "Public ack ring" ON public.devices FOR UPDATE
USING (status IN ('called','in_queue','checked_in') AND ringing = true)
WITH CHECK (ringing = false);

-- Storage: drop broad public select, allow only individual object reads via known path
-- (public bucket already serves files via URL; SELECT policy only affects listing API)
DROP POLICY IF EXISTS "Public read device photos" ON storage.objects;

CREATE POLICY "Admins list device photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'device-photos' AND public.has_role(auth.uid(),'admin'));