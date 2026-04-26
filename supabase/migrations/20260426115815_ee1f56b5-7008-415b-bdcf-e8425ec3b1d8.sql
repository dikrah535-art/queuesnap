DROP POLICY IF EXISTS "Public insert devices" ON public.devices;

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
  AND (slot_label IS NULL OR char_length(slot_label) <= 40)
  AND status = 'checked_in'::public.device_status
  AND ringing = false
  AND owner_user_id IS NULL
  AND called_time IS NULL
  AND collection_time IS NULL
  AND queue_time IS NULL
  AND photo_url IS NULL
);