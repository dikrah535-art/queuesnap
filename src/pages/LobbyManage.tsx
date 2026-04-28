import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bell, Check, Copy, Loader2, PackageCheck, Phone, PlayCircle, Power, Smartphone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { QrCard } from "@/components/workspace/QrCard";
import {
  cancelEntry, clearQueue, deleteLobby, fetchLobby, fetchQueueEntries,
  markCollected, serveNext, updateLobby, joinLobby,
  type Lobby, type QueueEntry,
} from "@/lib/workspaces";

const LobbyManage = () => {
  const { wsId, lobbyId } = useParams<{ wsId: string; lobbyId: string }>();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [search, setSearch] = useState("");

  const reload = async () => {
    if (!lobbyId) return;
    try {
      const [l, es] = await Promise.all([fetchLobby(lobbyId), fetchQueueEntries(lobbyId)]);
      setLobby(l); setEntries(es);
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    const ch = supabase
      .channel(`lobby-${lobbyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${lobbyId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  const serving = useMemo(() => entries.find((e) => e.status === "serving"), [entries]);
  const waiting = useMemo(() => entries.filter((e) => e.status === "waiting"), [entries]);

  const toggleStatus = async () => {
    if (!lobby) return;
    try {
      const next = lobby.status === "open" ? "closed" : "open";
      const updated = await updateLobby(lobby.id, { status: next });
      setLobby(updated); toast.success(`Lobby ${next}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onServeNext = async () => {
    if (!lobbyId) return;
    try { await serveNext(lobbyId); toast.success("Next person called"); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onClear = async () => {
    if (!lobbyId) return;
    if (!confirm("Cancel everyone in the queue?")) return;
    try { const n = await clearQueue(lobbyId); toast.success(`Cleared ${n} entries`); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onAdd = async () => {
    if (!lobbyId || !addName.trim()) return;
    try { await joinLobby(lobbyId, addName); setAddName(""); toast.success("Added to queue"); }
    catch (e: any) { toast.error(e.message ?? "Failed to add"); }
  };

  const onRemove = async (id: string) => {
    if (!confirm("Remove this person from the queue?")) return;
    try { await cancelEntry(id); toast.success("Removed from queue"); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onCollected = async (id: string) => {
    try { await markCollected(id); toast.success("Marked as collected ✅"); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onDeleteLobby = async () => {
    if (!lobby) return;
    if (!confirm(`Delete lobby "${lobby.name}"? This cannot be undone.`)) return;
    try { await deleteLobby(lobby.id); toast.success("Lobby deleted"); window.history.back(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const copyLink = async () => {
    if (!lobbyId) return;
    const url = `${window.location.origin}/join/${lobbyId}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!lobby) return <div className="grid min-h-screen place-items-center text-muted-foreground">Lobby not found</div>;

  const total = entries.length;
  const pct = Math.min(100, Math.round((total / lobby.max_capacity) * 100));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to={`/workspaces/${wsId}`}><ArrowLeft /></Link></Button>
            <div>
              <h1 className="font-semibold leading-tight">{lobby.name}</h1>
              <p className="text-xs text-muted-foreground">Lobby management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="mr-1 h-4 w-4" /> Share link</Button>
            <Button variant={lobby.status === "open" ? "outline" : "default"} size="sm" onClick={toggleStatus}>
              <Power className="mr-1 h-4 w-4" /> {lobby.status === "open" ? "Close" : "Open"}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDeleteLobby}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">In queue</p>
            <p className="mt-1 text-3xl font-semibold">{total}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{total} / {lobby.max_capacity} capacity</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Currently serving</p>
            <p className="mt-1 text-3xl font-semibold truncate">{serving?.name ?? "—"}</p>
            {serving && <Badge variant="secondary" className="mt-3">#{serving.position}</Badge>}
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <Badge variant={lobby.status === "open" ? "default" : "secondary"} className="mt-2">{lobby.status}</Badge>
          </Card>
        </div>

        {/* Actions */}
        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label>Add person manually</Label>
              <div className="flex gap-2">
                <Input placeholder="Name" value={addName} onChange={(e) => setAddName(e.target.value)} maxLength={80} />
                <Button onClick={onAdd} disabled={!addName.trim()}>Add</Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="hero" onClick={onServeNext} disabled={waiting.length === 0 && !serving}>
                <PlayCircle className="mr-1" /> Serve next
              </Button>
              <Button variant="outline" onClick={onClear} disabled={total === 0}>Clear queue</Button>
            </div>
          </div>
        </Card>

        {/* Queue list */}
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Queue</h3>
          {entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No one in the queue yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${e.status === "serving" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {e.position}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.status === "serving" ? <span className="inline-flex items-center gap-1 text-primary"><Bell className="h-3 w-3" /> Now serving</span> : "Waiting"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(e.id)} aria-label="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
};

export default LobbyManage;
