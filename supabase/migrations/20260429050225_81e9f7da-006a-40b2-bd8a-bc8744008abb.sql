-- Base table privileges. RLS still restricts which rows are accessible.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Authenticated users: full DML on app tables (RLS-gated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots             TO authenticated;
GRANT SELECT                          ON public.user_roles       TO authenticated;

-- Anonymous users: read public-facing data + allow public submissions where RLS permits
GRANT SELECT          ON public.lobbies       TO anon;
GRANT SELECT, INSERT  ON public.queue_entries TO anon;
GRANT SELECT          ON public.slots         TO anon;
GRANT SELECT, INSERT  ON public.devices       TO anon;

-- Future tables in public schema inherit sensible defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;