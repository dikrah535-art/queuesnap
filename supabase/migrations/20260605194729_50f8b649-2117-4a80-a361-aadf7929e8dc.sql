
-- 1. Ratings table
CREATE TABLE public.service_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id)
);
CREATE INDEX idx_service_ratings_workspace ON public.service_ratings(workspace_id, created_at DESC);
CREATE INDEX idx_service_ratings_lobby ON public.service_ratings(lobby_id, created_at DESC);

GRANT SELECT, INSERT ON public.service_ratings TO anon, authenticated;
GRANT ALL ON public.service_ratings TO service_role;
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a rating for a served entry (anonymous visitors included)
CREATE POLICY "Anyone can submit a rating for a served entry"
  ON public.service_ratings FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.queue_entries qe
      WHERE qe.id = entry_id
        AND qe.lobby_id = service_ratings.lobby_id
        AND qe.status IN ('served', 'collected')
    )
  );

-- Workspace admins can read ratings for their workspaces
CREATE POLICY "Admins can view their workspace ratings"
  ON public.service_ratings FOR SELECT
  TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- 2. Estimated wait RPC
CREATE OR REPLACE FUNCTION public.estimated_wait_seconds(_lobby_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (served_at - created_at))))::int, 180)
  FROM (
    SELECT served_at, created_at
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id
      AND served_at IS NOT NULL
      AND status IN ('served','collected')
    ORDER BY served_at DESC
    LIMIT 10
  ) recent;
$$;
REVOKE EXECUTE ON FUNCTION public.estimated_wait_seconds(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimated_wait_seconds(uuid) TO anon, authenticated, service_role;

-- 3. Global overview RPC (across all workspaces the admin can manage)
CREATE OR REPLACE FUNCTION public.get_global_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;

  WITH my_workspaces AS (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ),
  my_lobbies AS (
    SELECT l.id, l.name, l.workspace_id, w.name AS workspace_name
    FROM public.lobbies l
    JOIN public.workspaces w ON w.id = l.workspace_id
    WHERE l.workspace_id IN (SELECT workspace_id FROM my_workspaces)
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE qe.status IN ('served','collected'))::int AS total_served,
      COUNT(*)::int AS total_tokens,
      COUNT(*) FILTER (WHERE qe.status IN ('waiting','serving'))::int AS currently_waiting,
      ROUND(AVG(EXTRACT(EPOCH FROM (qe.served_at - qe.created_at))/60.0)
            FILTER (WHERE qe.served_at IS NOT NULL))::int AS avg_wait_mins
    FROM public.queue_entries qe
    WHERE qe.lobby_id IN (SELECT id FROM my_lobbies)
  ),
  per_workspace AS (
    SELECT
      w.id AS workspace_id,
      w.name AS workspace_name,
      COUNT(qe.*) FILTER (WHERE qe.status IN ('served','collected'))::int AS served,
      COUNT(qe.*) FILTER (WHERE qe.status IN ('waiting','serving'))::int AS waiting,
      ROUND(AVG(EXTRACT(EPOCH FROM (qe.served_at - qe.created_at))/60.0)
            FILTER (WHERE qe.served_at IS NOT NULL))::int AS avg_wait_mins
    FROM public.workspaces w
    LEFT JOIN public.lobbies l ON l.workspace_id = w.id
    LEFT JOIN public.queue_entries qe ON qe.lobby_id = l.id
    WHERE w.id IN (SELECT workspace_id FROM my_workspaces)
    GROUP BY w.id, w.name
    ORDER BY served DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'workspaces_count', (SELECT COUNT(*) FROM my_workspaces),
    'lobbies_count', (SELECT COUNT(*) FROM my_lobbies),
    'summary', (SELECT row_to_json(agg) FROM agg),
    'per_workspace', COALESCE((SELECT jsonb_agg(row_to_json(per_workspace)) FROM per_workspace), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_global_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_overview() TO authenticated, service_role;

-- 4. Public read of minimal lobby info for the Display View (name + status)
-- lobbies already allow public select via existing policy "Anyone can view lobbies" (assumed); no change needed.
