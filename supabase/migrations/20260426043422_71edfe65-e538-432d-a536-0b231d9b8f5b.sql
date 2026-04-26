
-- 1. Restrict devices SELECT to admins only (lookup_device RPC handles public token-based access via SECURITY DEFINER)
DROP POLICY IF EXISTS "Public read devices" ON public.devices;

CREATE POLICY "Admins read devices"
ON public.devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners read own device"
ON public.devices
FOR SELECT
TO authenticated
USING (owner_user_id IS NOT NULL AND owner_user_id = auth.uid());

-- 2. Tighten public INSERT with stricter WITH CHECK constraints on supplied fields
DROP POLICY IF EXISTS "Public insert device" ON public.devices;

CREATE POLICY "Public insert device"
ON public.devices
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Field length / format constraints
  char_length(btrim(owner_name)) BETWEEN 2 AND 80
  AND (owner_id_text IS NULL OR char_length(owner_id_text) <= 40)
  AND (owner_email IS NULL OR (char_length(owner_email) <= 120 AND owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND (phone_model IS NULL OR char_length(phone_model) <= 120)
  AND (slot_label IS NULL OR char_length(slot_label) <= 40)
  -- Forbid client from forging server-managed fields
  AND status = 'checked_in'::public.device_status
  AND ringing = false
  AND called_time IS NULL
  AND collection_time IS NULL
  AND queue_time IS NULL
  AND owner_user_id IS NULL
  -- Restrict photo_url to our storage bucket
  AND (photo_url IS NULL OR photo_url ~~ 'https://ncjxdyjfniqkbucwrldi.supabase.co/storage/v1/object/%/device-photos/%')
);

-- 3. Add admin DELETE policy on device-photos storage bucket
CREATE POLICY "Admins delete device photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'device-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. Restrict realtime channel subscriptions to admins
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins subscribe to realtime" ON realtime.messages;
CREATE POLICY "Admins subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
