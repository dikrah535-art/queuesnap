-- ============================================================
-- QueueSnap: Workspaces & Lobbies (Phase 1 schema)
-- Coexists with existing devices/slots system.
-- ============================================================

-- Extend role enum (add 'owner') if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'owner' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
END$$;

-- Lobby status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lobby_status') THEN
    CREATE TYPE public.lobby_status AS ENUM ('open', 'closed');
  END IF;
END$$;

-- Queue entry status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_entry_status') THEN
    CREATE TYPE public.queue_entry_status AS ENUM ('waiting', 'serving', 'served', 'cancelled');
  END IF;
END$$;

-- Workspace member role enum (workspace-scoped, separate from global app_role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END$$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  max_capacity int NOT NULL DEFAULT 50 CHECK (max_capacity BETWEEN 1 AND 10000),
  status public.lobby_status NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  position int NOT NULL,
  status public.queue_entry_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_workspace ON public.lobbies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_lobby_status ON public.queue_entries(lobby_id, status, position);
CREATE INDEX IF NOT EXISTS idx_queue_user ON public.queue_entries(user_id);

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER, search_path locked)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  );
$$;

-- Lock down execute
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid)  TO authenticated;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_workspaces_updated ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_lobbies_updated ON public.lobbies;
CREATE TRIGGER trg_lobbies_updated BEFORE UPDATE ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-add owner as workspace_member with role=owner
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workspaces_seed_owner ON public.workspaces;
CREATE TRIGGER trg_workspaces_seed_owner AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobbies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: workspaces
-- ============================================================
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can create workspace" ON public.workspaces;
CREATE POLICY "Authenticated can create workspace"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update workspace" ON public.workspaces;
CREATE POLICY "Owner can update workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can delete workspace" ON public.workspaces;
CREATE POLICY "Owner can delete workspace"
  ON public.workspaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- POLICIES: workspace_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view members" ON public.workspace_members;
CREATE POLICY "Members can view members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Only workspace owners/admins can add members.
-- Special bootstrap: the trigger runs as SECURITY DEFINER so it bypasses RLS;
-- so this policy only governs explicit client inserts.
DROP POLICY IF EXISTS "Admins can add members" ON public.workspace_members;
CREATE POLICY "Admins can add members"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- Owner can remove anyone; admins can remove non-owners; users can remove themselves
DROP POLICY IF EXISTS "Admins or self can remove members" ON public.workspace_members;
CREATE POLICY "Admins or self can remove members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.is_workspace_admin(workspace_id, auth.uid()) AND role <> 'owner')
    OR public.is_workspace_owner(workspace_id, auth.uid())
  );

-- ============================================================
-- POLICIES: lobbies
-- ============================================================
-- Lobbies are publicly readable so anonymous users can join via shareable link.
DROP POLICY IF EXISTS "Anyone can view lobbies" ON public.lobbies;
CREATE POLICY "Anyone can view lobbies"
  ON public.lobbies FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert lobbies" ON public.lobbies;
CREATE POLICY "Admins can insert lobbies"
  ON public.lobbies FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_admin(workspace_id, auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update lobbies" ON public.lobbies;
CREATE POLICY "Admins can update lobbies"
  ON public.lobbies FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete lobbies" ON public.lobbies;
CREATE POLICY "Admins can delete lobbies"
  ON public.lobbies FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- ============================================================
-- POLICIES: queue_entries
-- ============================================================
-- Public read so anyone with the link can see queue position
DROP POLICY IF EXISTS "Anyone can view queue entries" ON public.queue_entries;
CREATE POLICY "Anyone can view queue entries"
  ON public.queue_entries FOR SELECT TO anon, authenticated
  USING (true);

-- Inserts are funneled through the join_lobby() RPC (SECURITY DEFINER).
-- We still allow signed-in admins to insert manually.
DROP POLICY IF EXISTS "Admins can insert queue entries" ON public.queue_entries;
CREATE POLICY "Admins can insert queue entries"
  ON public.queue_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id
        AND public.is_workspace_admin(l.workspace_id, auth.uid())
    )
  );

-- Admins update; users can cancel their own
DROP POLICY IF EXISTS "Admins or owner can update queue entry" ON public.queue_entries;
CREATE POLICY "Admins or owner can update queue entry"
  ON public.queue_entries FOR UPDATE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id
        AND public.is_workspace_admin(l.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id
        AND public.is_workspace_admin(l.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins or owner can delete queue entry" ON public.queue_entries;
CREATE POLICY "Admins or owner can delete queue entry"
  ON public.queue_entries FOR DELETE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id
        AND public.is_workspace_admin(l.workspace_id, auth.uid())
    )
  );

-- ============================================================
-- RPC: join_lobby (allows anon + auth to join with capacity check)
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_lobby(_lobby_id uuid, _name text, _user_id uuid DEFAULT NULL)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _count int;
  _next_pos int;
  _entry public.queue_entries%ROWTYPE;
  _clean_name text := btrim(coalesce(_name, ''));
BEGIN
  IF char_length(_clean_name) < 1 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF _lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby is closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.queue_entries
    WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');

  IF _count >= _lobby.max_capacity THEN
    RAISE EXCEPTION 'Lobby is full' USING ERRCODE = 'check_violation';
  END IF;

  -- Prevent duplicate active entry for signed-in users
  IF _user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND user_id = _user_id AND status IN ('waiting','serving')
    ) THEN
      RAISE EXCEPTION 'Already in queue' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_pos
    FROM public.queue_entries WHERE lobby_id = _lobby_id;

  INSERT INTO public.queue_entries (lobby_id, user_id, name, position, status)
  VALUES (_lobby_id, _user_id, _clean_name, _next_pos, 'waiting')
  RETURNING * INTO _entry;

  RETURN _entry;
END $$;

REVOKE EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- RPC: serve_next  (admin marks current 'serving' as served, promotes next)
-- ============================================================
CREATE OR REPLACE FUNCTION public.serve_next(_lobby_id uuid)
RETURNS public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lobby public.lobbies%ROWTYPE;
  _next public.queue_entries%ROWTYPE;
BEGIN
  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_lobby.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Mark currently serving as served
  UPDATE public.queue_entries
     SET status = 'served', served_at = now()
   WHERE lobby_id = _lobby_id AND status = 'serving';

  -- Promote next waiting (lowest position)
  UPDATE public.queue_entries
     SET status = 'serving'
   WHERE id = (
     SELECT id FROM public.queue_entries
      WHERE lobby_id = _lobby_id AND status = 'waiting'
      ORDER BY position ASC LIMIT 1
   )
   RETURNING * INTO _next;

  RETURN _next;
END $$;

REVOKE EXECUTE ON FUNCTION public.serve_next(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.serve_next(uuid) TO authenticated;

-- ============================================================
-- RPC: clear_queue (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_queue(_lobby_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _ws uuid; _count int;
BEGIN
  SELECT workspace_id INTO _ws FROM public.lobbies WHERE id = _lobby_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Lobby not found'; END IF;
  IF NOT public.is_workspace_admin(_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.queue_entries
     SET status = 'cancelled'
   WHERE lobby_id = _lobby_id AND status IN ('waiting','serving');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;

REVOKE EXECUTE ON FUNCTION public.clear_queue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_queue(uuid) TO authenticated;

-- ============================================================
-- RPC: add_admin_by_email (owner/admin invites by email)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_workspace_admin_by_email(_workspace_id uuid, _email text)
RETURNS public.workspace_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid; _row public.workspace_members%ROWTYPE;
BEGIN
  IF NOT public.is_workspace_admin(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO _uid FROM public.profiles WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user found with that email' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _uid, 'admin')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO _row;

  RETURN _row;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_workspace_admin_by_email(uuid, text) TO authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
