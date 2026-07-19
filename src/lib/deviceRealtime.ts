import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

// Lightweight broadcast channel used to notify anonymous status pages that a
// device row has changed. Anonymous users cannot subscribe to postgres_changes
// on `devices` (RLS blocks SELECT for anon), so admin-side mutations broadcast
// a ping and the Status page refetches via the SECURITY DEFINER lookup RPC.
const CHANNEL = "devices-pings";

let sendChannel: ReturnType<typeof supabase.channel> | null = null;

function getSendChannel() {
  if (sendChannel) return sendChannel;
  sendChannel = supabase.channel(CHANNEL, { config: { broadcast: { self: true, ack: false } } });
  sendChannel.subscribe();
  return sendChannel;
}

export function pingDevice(id: string) {
  try {
    getSendChannel().send({ type: "broadcast", event: "device-changed", payload: { id } });
  } catch (e) {
    // Non-fatal — the receiver falls back to polling.
    if (import.meta.env.DEV) console.debug("[pingDevice] failed", e);
  }
}

/** Subscribe to device change pings for a specific device id. */
export function useDevicePings(deviceId: string | null | undefined, onPing: () => void) {
  const cbRef = useRef(onPing);
  cbRef.current = onPing;
  useEffect(() => {
    if (!deviceId) return;
    const ch = supabase
      .channel(`${CHANNEL}-listener-${deviceId}`)
      .on("broadcast", { event: "device-changed" }, (msg) => {
        const pid = (msg as { payload?: { id?: string } }).payload?.id;
        if (pid === deviceId) cbRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deviceId]);
}
