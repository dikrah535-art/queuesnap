CREATE OR REPLACE FUNCTION public.queue_position(_id uuid, _token text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::int + 1
    FROM public.devices q
    WHERE q.status = 'in_queue'
      AND q.queue_time < (
        SELECT d.queue_time FROM public.devices d
        WHERE d.id = _id AND d.token_code = upper(btrim(_token)) AND d.status = 'in_queue'
      )
  ), 0);
$$;