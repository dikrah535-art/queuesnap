import { supabase } from "@/integrations/supabase/client";

export const DEMO_LOBBY_ID = "b89496ed-2deb-4b64-9dba-48ea953887fb";
export const DEMO_LOBBY_NAME = "QueueSnap Live Demo 🚀";
export const DEMO_LOBBY_DESCRIPTION =
  "See how QueueSnap works for colleges, events & shops. Join the demo queue and track your token live — just like the real thing.";
export const DEMO_LOBBY_PATH = `/join/${DEMO_LOBBY_ID}`;
export const DEMO_LOBBY_PUBLIC_URL = `https://queuesnap.vercel.app/join/${DEMO_LOBBY_ID}`;

export async function fetchDemoLobbyWaitingCount(): Promise<number> {
  const { count, error } = await supabase
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("lobby_id", DEMO_LOBBY_ID)
    .eq("status", "waiting");
  if (error) return 0;
  return count ?? 0;
}
