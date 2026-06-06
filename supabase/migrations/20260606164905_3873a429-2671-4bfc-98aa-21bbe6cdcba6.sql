
CREATE OR REPLACE FUNCTION public.estimated_wait_seconds(_lobby_id uuid)
 RETURNS integer
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (served_at - created_at))))::int, 180)
  FROM (
    SELECT served_at, created_at
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id
      AND served_at IS NOT NULL
      AND status IN ('served','collected')
    ORDER BY served_at DESC
    LIMIT 5
  ) recent;
$function$;
