
CREATE OR REPLACE FUNCTION public.get_lobby_analytics(_lobby_id uuid, _days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws uuid;
  _daily jsonb;
  _hourly jsonb;
  _summary jsonb;
  _start date := (current_date - (_days - 1));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT workspace_id INTO _ws FROM public.lobbies WHERE id = _lobby_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;

  WITH days AS (
    SELECT generate_series(_start, current_date, interval '1 day')::date AS d
  ),
  agg AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS d,
      COUNT(*) FILTER (WHERE TRUE) AS total,
      COUNT(*) FILTER (WHERE status IN ('served','collected')) AS served,
      COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
      ROUND(AVG(EXTRACT(EPOCH FROM (served_at - created_at))/60.0)
            FILTER (WHERE served_at IS NOT NULL))::int AS avg_wait_mins
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id
      AND created_at >= _start
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d.d,
    'total', COALESCE(a.total,0),
    'served', COALESCE(a.served,0),
    'waiting', COALESCE(a.waiting,0),
    'cancelled', COALESCE(a.cancelled,0),
    'avg_wait_mins', a.avg_wait_mins
  ) ORDER BY d.d), '[]'::jsonb)
  INTO _daily
  FROM days d LEFT JOIN agg a ON a.d = d.d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'hour', h,
    'total', cnt
  ) ORDER BY h), '[]'::jsonb)
  INTO _hourly
  FROM (
    SELECT EXTRACT(HOUR FROM created_at)::int AS h, COUNT(*)::int AS cnt
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id
      AND created_at >= (now() - interval '7 days')
    GROUP BY 1
  ) sub;

  SELECT jsonb_build_object(
    'total_all_time', (SELECT COUNT(*) FROM public.queue_entries WHERE lobby_id = _lobby_id),
    'total_served', (SELECT COUNT(*) FROM public.queue_entries WHERE lobby_id = _lobby_id AND status IN ('served','collected')),
    'today_total', (SELECT COUNT(*) FROM public.queue_entries WHERE lobby_id = _lobby_id AND created_at::date = current_date),
    'today_served', (SELECT COUNT(*) FROM public.queue_entries WHERE lobby_id = _lobby_id AND created_at::date = current_date AND status IN ('served','collected')),
    'avg_wait_mins_all_time', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (served_at - created_at))/60.0))::int
      FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND served_at IS NOT NULL
    )
  ) INTO _summary;

  RETURN jsonb_build_object('daily', _daily, 'hourly', _hourly, 'summary', _summary);
END $$;

REVOKE EXECUTE ON FUNCTION public.get_lobby_analytics(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lobby_analytics(uuid, int) TO authenticated, service_role;
