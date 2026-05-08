import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);

    const { data: lobby, error: le } = await sb.from("lobbies").select("id").eq("slug", "demo").maybeSingle();
    if (le) throw le;
    if (!lobby) return new Response(JSON.stringify({ ok: true, updated: 0, note: "no demo lobby" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from("queue_entries")
      .update({ status: "collected" })
      .eq("lobby_id", lobby.id)
      .in("status", ["waiting", "serving"])
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, updated: data?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
