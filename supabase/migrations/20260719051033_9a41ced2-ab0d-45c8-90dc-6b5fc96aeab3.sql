-- Add devices, slots, demo_visitors to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='devices') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.devices';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='slots') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.slots';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='demo_visitors') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_visitors';
  END IF;
END $$;

ALTER TABLE public.devices REPLICA IDENTITY FULL;
ALTER TABLE public.slots REPLICA IDENTITY FULL;
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER TABLE public.lobbies REPLICA IDENTITY FULL;
ALTER TABLE public.demo_visitors REPLICA IDENTITY FULL;