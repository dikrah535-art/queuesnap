import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, DoorOpen, Loader2, Plus, QrCode, Settings, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { QrCard } from "@/components/workspace/QrCard";
import {
  createLobby, fetchLobbies, fetchWorkspace, getMyRole,
  type Lobby, type Workspace, type WorkspaceRole,
} from "@/lib/workspaces";

const WorkspaceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", max_capacity: 50 });
  const [qrLobby, setQrLobby] = useState<Lobby | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [w, ls, r] = await Promise.all([fetchWorkspace(id), fetchLobbies(id), getMyRole(id)]);
      setWs(w); setLobbies(ls); setRole(r);
      setForm((f) => ({ ...f, max_capacity: w.default_capacity ?? 50 }));
      // counts
      if (ls.length) {
        const { data } = await supabase
          .from("queue_entries")
          .select("lobby_id, status")
          .in("lobby_id", ls.map((l) => l.id))
          .in("status", ["waiting", "serving"]);
        const map: Record<string, number> = {};
        (data ?? []).forEach((r: any) => { map[r.lobby_id] = (map[r.lobby_id] ?? 0) + 1; });
        setCounts(map);
      } else { setCounts({}); }
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [id]);

  // Realtime: refresh on lobby/queue changes
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`ws-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies", filter: `workspace_id=eq.${id}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isAdmin = role === "owner" || role === "admin";

  const submit = async () => {
    if (!id) return;
    if (form.name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
    if (!Number.isFinite(form.max_capacity) || form.max_capacity < 1) { toast.error("Capacity must be a number ≥ 1"); return; }
    setCreating(true);
    try {
      const lobby = await createLobby({ workspace_id: id, name: form.name, description: form.description, max_capacity: form.max_capacity });
      toast.success("Lobby created");
      setOpen(false); setForm({ name: "", description: "", max_capacity: 50 });
      setLobbies((s) => [lobby, ...s]);
    } catch (e: any) { toast.error(e.message ?? "Failed to create lobby"); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!ws) return <div className="grid min-h-screen place-items-center text-muted-foreground">Workspace not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/workspaces"><ArrowLeft /></Link></Button>
            <div>
              <h1 className="font-semibold leading-tight">{ws.name}</h1>
              <p className="text-xs text-muted-foreground capitalize">{role ?? "viewer"}</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm"><Link to={`/workspaces/${ws.id}/admins`}><Users className="mr-1 h-4 w-4" />Admins</Link></Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button variant="hero" size="sm"><Plus className="mr-1" /> New lobby</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create lobby</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Device Submission" maxLength={80} /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What is this lobby for?" maxLength={500} /></div>
                    <div className="space-y-2"><Label>Max capacity</Label><Input type="number" inputMode="numeric" min={1} max={10000} value={Number.isFinite(form.max_capacity) ? form.max_capacity : ""} onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setForm((f) => ({ ...f, max_capacity: NaN })); return; }
                      const n = parseInt(v, 10);
                      setForm((f) => ({ ...f, max_capacity: Number.isFinite(n) ? Math.max(1, Math.min(10000, n)) : NaN }));
                    }} onBlur={() => { if (!Number.isFinite(form.max_capacity) || form.max_capacity < 1) setForm((f) => ({ ...f, max_capacity: 50 })); }} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={submit} disabled={creating}>{creating ? <Loader2 className="animate-spin" /> : "Create"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </header>

      <main className="container py-10">
        {ws.description && <p className="mb-6 max-w-2xl text-muted-foreground">{ws.description}</p>}

        {lobbies.length === 0 ? (
          <Card className="p-12 text-center">
            <DoorOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No lobbies yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Create your first lobby to start a queue." : "Ask an admin to create a lobby."}</p>
            {isAdmin && <Button className="mt-6" variant="hero" onClick={() => setOpen(true)}><Plus className="mr-1" /> Create lobby</Button>}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lobbies.map((l) => {
              const count = counts[l.id] ?? 0;
              const full = count >= l.max_capacity;
              return (
                <Card key={l.id} className="p-5 transition hover:-translate-y-0.5 hover:shadow-elegant animate-scale-in">
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-accent/10 p-2 text-accent"><DoorOpen className="h-5 w-5" /></div>
                    <Badge variant={l.status === "open" ? "default" : "secondary"}>{l.status}</Badge>
                  </div>
                  <h3 className="mt-4 font-semibold tracking-tight">{l.name}</h3>
                  {l.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.description}</p>}
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Activity className="h-4 w-4" /> {count} / {l.max_capacity}</span>
                    {full && <Badge variant="destructive">Full</Badge>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {isAdmin && (
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to={`/workspaces/${ws.id}/lobbies/${l.id}`}><Settings className="mr-1 h-4 w-4" /> Manage</Link>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setQrLobby(l)} aria-label="Show QR">
                        <QrCode className="h-4 w-4" />
                      </Button>
                    )}
                    <Button asChild variant={isAdmin ? "ghost" : "hero"} size="sm" className="flex-1">
                      <Link to={`/join/${l.id}`}>Join page</Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!qrLobby} onOpenChange={(v) => !v && setQrLobby(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{qrLobby?.name} · Join QR</DialogTitle></DialogHeader>
            {qrLobby && (
              <QrCard
                url={`${window.location.origin}/join/${qrLobby.id}`}
                filename={`queuesnap-${qrLobby.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default WorkspaceDetail;
