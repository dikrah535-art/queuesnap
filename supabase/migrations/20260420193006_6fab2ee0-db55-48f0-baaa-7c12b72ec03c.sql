-- 1. Drop overly broad public policies on devices
DROP POLICY IF EXISTS "Public read device" ON public.devices;
DROP POLICY IF EXISTS "Public join queue" ON public.devices;
DROP POLICY IF EXISTS "Public ack ring" ON public.devices;

-- 2. Tighten public INSERT: require photo_url be null or our own storage
DROP POLICY IF EXISTS "Public insert device" ON public.devices;
CREATE POLICY "Public insert device"
ON public.devices
FOR INSERT
TO public
WITH CHECK (
  photo_url IS NULL
  OR photo_url LIKE 'https://ncjxdyjfniqkbucwrldi.supabase.co/storage/v1/object/%/device-photos/%'
);

-- 3. Token-gated lookup RPC for guest receipt/status pages
CREATE OR REPLACE FUNCTION public.lookup_device(_token text)
RETURNS TABLE (
  id uuid,
  token_code text,
  owner_name text,
  slot_label text,
  status device_status,
  ringing boolean,
  phone_model text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.token_code, d.owner_name, d.slot_label, d.status, d.ringing, d.phone_model
  FROM public.devices d
  WHERE
    (
      -- UUID lookup
      (length(_token) = 36 AND d.id::text = lower(_token))
      OR
      -- Token code lookup (case-insensitive, trimmed)
      d.token_code = upper(btrim(_token))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_device(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_device(text) TO anon, authenticated;

-- 4. Token-gated join-queue RPC
CREATE OR REPLACE FUNCTION public.join_queue(_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated int;
BEGIN
  UPDATE public.devices
  SET status = 'in_queue', queue_time = now()
  WHERE id = _id
    AND token_code = upper(btrim(_token))
    AND status = 'checked_in';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.join_queue(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_queue(uuid, text) TO anon, authenticated;

-- 5. Token-gated acknowledge-ring RPC
CREATE OR REPLACE FUNCTION public.ack_ring(_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated int;
BEGIN
  UPDATE public.devices
  SET ringing = false
  WHERE id = _id
    AND token_code = upper(btrim(_token))
    AND ringing = true;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_ring(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ack_ring(uuid, text) TO anon, authenticated;

-- 6. Make device-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'device-photos';

-- 7. Drop the auto-promote-first-signup admin trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
DROP FUNCTION IF EXISTS public.bootstrap_first_admin();

-- 8. Remove devices from realtime publication so PII isn't broadcast to anon subscribers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'devices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.devices';
  END IF;
END $$;