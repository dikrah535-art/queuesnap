import { supabase } from "@/integrations/supabase/client";

export const DEMO_LOBBY_ID = "ed4c2a17-37d8-4df8-b98d-c7ae96baa37d";
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
