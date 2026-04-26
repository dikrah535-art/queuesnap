-- Drop the overly strict insert policy and replace with a simpler one
DROP POLICY IF EXISTS "Public insert device" ON public.devices;

CREATE POLICY "Public insert device"
ON public.devices
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(owner_name)) BETWEEN 2 AND 80
  AND (owner_id_text IS NULL OR char_length(owner_id_text) <= 40)
  AND (owner_email IS NULL OR (char_length(owner_email) <= 120 AND owner_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND (phone_model IS NULL OR char_length(phone_model) <= 120)
  AND status = 'checked_in'::public.device_status
  AND ringing = false
  AND owner_user_id IS NULL
);