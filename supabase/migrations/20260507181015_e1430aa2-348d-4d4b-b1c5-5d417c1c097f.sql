-- Additive columns
ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS notified_email BOOLEAN NOT NULL DEFAULT false;

-- demo_visitors leads table
CREATE TABLE IF NOT EXISTS public.demo_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  queue_entry_id uuid,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'landing_page'
);
ALTER TABLE public.demo_visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert demo visitor" ON public.demo_visitors;
CREATE POLICY "Anyone can insert demo visitor" ON public.demo_visitors
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 80
    AND (email IS NULL OR (char_length(email) <= 120 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    AND (phone IS NULL OR char_length(phone) BETWEEN 4 AND 32)
    AND (source IS NULL OR char_length(source) <= 40)
  );

DROP POLICY IF EXISTS "Authenticated can view demo visitors" ON public.demo_visitors;
CREATE POLICY "Authenticated can view demo visitors" ON public.demo_visitors
  FOR SELECT TO authenticated USING (true);

-- Seed permanent demo workspace + lobby
DO $$
DECLARE
  _system_uid CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  _ws_id uuid;
BEGIN
  SELECT id INTO _ws_id FROM public.workspaces WHERE name = 'QueueSnap Demo Workspace' LIMIT 1;
  IF _ws_id IS NULL THEN
    INSERT INTO public.workspaces (name, description, owner_id, user_id)
    VALUES ('QueueSnap Demo Workspace', 'Public demo workspace', _system_uid, _system_uid)
    RETURNING id INTO _ws_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lobbies WHERE slug = 'demo') THEN
    INSERT INTO public.lobbies (workspace_id, created_by, name, description, slug, status, max_capacity)
    VALUES (_ws_id, _system_uid, 'QueueSnap Demo 🚀', 'Public demo queue — try it live!', 'demo', 'open', 200);
  END IF;
END $$;

-- Block deletion of the demo lobby
CREATE OR REPLACE FUNCTION public.prevent_demo_lobby_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.slug = 'demo' THEN
    RAISE EXCEPTION 'The demo lobby cannot be deleted';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS prevent_demo_lobby_delete_trg ON public.lobbies;
CREATE TRIGGER prevent_demo_lobby_delete_trg
  BEFORE DELETE ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_demo_lobby_delete();

-- Resolve a lobby by slug or uuid (used by /join/:key)
CREATE OR REPLACE FUNCTION public.resolve_lobby(_key text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.lobbies
   WHERE (length(_key) = 36 AND id::text = lower(_key))
      OR slug = lower(btrim(_key))
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_lobby(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_lobby(text) TO anon, authenticated;

-- Public live counter for the demo lobby
CREATE OR REPLACE FUNCTION public.count_demo_waiting()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COUNT(*)::int FROM public.queue_entries qe
   JOIN public.lobbies l ON l.id = qe.lobby_id
   WHERE l.slug = 'demo' AND qe.status IN ('waiting','serving');
$$;
REVOKE ALL ON FUNCTION public.count_demo_waiting() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_demo_waiting() TO anon, authenticated;

-- Admin manual add with optional VIP / email / phone
CREATE OR REPLACE FUNCTION public.admin_add_entry(
  _lobby_id uuid,
  _name text,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _is_vip boolean DEFAULT false
) RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _ws uuid;
  _lobby public.lobbies%ROWTYPE;
  _entry public.queue_entries%ROWTYPE;
  _pos int;
  _clean_name text := btrim(coalesce(_name,''));
  _clean_phone text := nullif(btrim(coalesce(_phone,'')),'');
  _clean_email text := nullif(btrim(coalesce(_email,'')),'');
  _clean_device text := nullif(btrim(coalesce(_device_type,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE='check_violation';
  END IF;
  IF _clean_email IS NOT NULL AND _clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_lobby.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='insufficient_privilege';
  END IF;

  IF _is_vip THEN
    SELECT COALESCE(MIN(position), 1) - 1 INTO _pos
      FROM public.queue_entries
     WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');
  ELSE
    SELECT COALESCE(MAX(position), 0) + 1 INTO _pos
      FROM public.queue_entries WHERE lobby_id = _lobby_id;
  END IF;

  INSERT INTO public.queue_entries (lobby_id, name, phone, email, device_type, is_vip, position, status)
  VALUES (_lobby_id, _clean_name, _clean_phone, _clean_email, _clean_device, _is_vip, _pos, 'waiting')
  RETURNING * INTO _entry;
  RETURN _entry;
END $$;
REVOKE ALL ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_entry(uuid, text, text, text, text, boolean) TO authenticated;