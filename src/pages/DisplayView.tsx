import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchLobby, fetchQueueEntries, resolveLobbyKey, type Lobby, type QueueEntry } from "@/lib/workspaces";

const DisplayView = () => {
  const { lobbyId: lobbyKey } = useParams<{ lobbyId: string }>();
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lobbyKey) return;
      const id = await resolveLobbyKey(lobbyKey);
      if (cancelled) return;
      if (!id) { setLoading(false); return; }
      setLobbyId(id);
    })();
    return () => { cancelled = true; };
  }, [lobbyKey]);

  const reload = async () => {
    if (!lobbyId) return;
    try {
      const [l, es] = await Promise.all([fetchLobby(lobbyId), fetchQueueEntries(lobbyId)]);
      setLobby(l); setEntries(es);
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    const ch = supabase.channel(`display-${lobbyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${lobbyId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [lobbyId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const serving = useMemo(() => entries.find((e) => e.status === "serving"), [entries]);
  const upNext = useMemo(
    () => entries.filter((e) => e.status === "waiting").slice(0, 6),
    [entries],
  );

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (!lobby) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Lobby not found</div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="container flex h-20 items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now serving at</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{lobby.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-3xl md:text-4xl font-semibold tabular-nums">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 container grid gap-8 py-10 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col items-center justify-center rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-10 text-center shadow-2xl">
          <p className="text-sm md:text-base uppercase tracking-[0.25em] text-primary/80">Now Serving</p>
          {serving ? (
            <>
              <p className="mt-6 text-[10rem] md:text-[14rem] font-bold leading-none tabular-nums bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent animate-scale-in">
                #{serving.position}
              </p>
              <p className="mt-2 text-3xl md:text-4xl font-medium">{serving.name}</p>
              <p className="mt-3 text-base md:text-lg text-muted-foreground">Please proceed to the counter</p>
            </>
          ) : (
            <>
              <p className="mt-6 text-7xl md:text-8xl font-bold text-muted-foreground/60">—</p>
              <p className="mt-4 text-xl text-muted-foreground">Waiting for next customer…</p>
            </>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/40 p-6">
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">Coming Up Next</h2>
          {upNext.length === 0 ? (
            <p className="py-16 text-center text-lg text-muted-foreground">No one waiting 🎉</p>
          ) : (
            <ul className="divide-y divide-border">
              {upNext.map((e, i) => (
                <li key={e.id} className="flex items-center gap-4 py-4 animate-fade-in">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl font-bold tabular-nums ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {e.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-medium truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i === 0 ? "Next up" : `${i + 1} in line`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/40 py-4">
        <div className="container flex items-center justify-between text-xs text-muted-foreground">
          <span>{entries.filter((e) => e.status === "waiting" || e.status === "serving").length} active in queue</span>
          <span>Powered by QueueSnap</span>
        </div>
      </footer>
    </div>
  );
};

export default DisplayView;
