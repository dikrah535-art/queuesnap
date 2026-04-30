import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, Loader2, ArrowRight, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth";
import { createWorkspace, fetchMyWorkspaces, type Workspace } from "@/lib/workspaces";

const DEMO_NAME = "Agresh Ji's Workspace";
const DEMO_DESC = "Office Meeting";
const DEMO_CAPACITY = 25;

const Workspaces = () => {
  const navigate = useNavigate();
  const { ready: authReady, session, user, refreshSession } = useAuth();
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [capacity, setCapacity] = useState<number>(50);
  const [creating, setCreating] = useState(false);

  // Ghost-preview state (separate from real inputs)
  const [ghostName, setGhostName] = useState("");
  const [ghostDesc, setGhostDesc] = useState("");
  const [ghostCap, setGhostCap] = useState(0);
  const animRef = useRef<number[]>([]);

  const reload = async () => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      toast.error("Please sign in");
      return;
    }
    setLoading(true);
    try { setItems(await fetchMyWorkspaces()); }
    catch (e: any) { toast.error(e?.message ?? "Failed to load workspaces"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [authReady, user]);

  const clearAnimations = () => {
    animRef.current.forEach((id) => window.clearTimeout(id));
    animRef.current = [];
  };

  // Animate the ghost preview layer (never touches real inputs)
  useEffect(() => {
    if (!open) {
      clearAnimations();
      setGhostName(""); setGhostDesc(""); setGhostCap(0);
      return;
    }

    const typeInto = (text: string, setter: (s: string) => void, startDelay: number, perChar = 35) => {
      for (let i = 1; i <= text.length; i++) {
        const id = window.setTimeout(() => setter(text.slice(0, i)), startDelay + i * perChar);
        animRef.current.push(id);
      }
    };

    const loop = () => {
      clearAnimations();
      setGhostName(""); setGhostDesc(""); setGhostCap(0);
      typeInto(DEMO_NAME, setGhostName, 300, 45);
      const descStart = 300 + DEMO_NAME.length * 45 + 300;
      typeInto(DEMO_DESC, setGhostDesc, descStart, 50);
      const capStart = descStart + DEMO_DESC.length * 50 + 200;
      for (let i = 1; i <= DEMO_CAPACITY; i++) {
        const id = window.setTimeout(() => setGhostCap(i), capStart + i * 40);
        animRef.current.push(id);
      }
      // restart loop
      const total = capStart + DEMO_CAPACITY * 40 + 2200;
      const id = window.setTimeout(loop, total);
      animRef.current.push(id);
    };
    loop();
    return () => clearAnimations();
  }, [open]);

  const submit = async () => {
    if (creating) return;
    const cleanName = name.trim();
    if (cleanName.length < 2) { toast.error("Name must be at least 2 characters"); return; }
    if (!Number.isFinite(capacity) || capacity < 1) {
      toast.error("Capacity must be a number ≥ 1");
      return;
    }

    setCreating(true);
    // Hard safety: never let the spinner spin forever
    const watchdog = window.setTimeout(() => {
      setCreating((c) => {
        if (c) toast.error("Request timed out. Please try again.");
        return false;
      });
    }, 15000);

    try {
      const activeSession = session ?? await refreshSession();
      if (!activeSession?.user) {
        toast.error("Please sign in");
        navigate("/admin/login?next=/workspaces");
        return;
      }
      const ws = await createWorkspace(cleanName, desc, capacity, activeSession.user.id);
      toast.success("Workspace created successfully");
      setOpen(false);
      setName(""); setDesc(""); setCapacity(50);
      setItems((s) => [ws, ...s]);
      window.setTimeout(() => navigate(`/workspaces/${ws.id}`), 300);
    } catch (e: any) {
      const msg: string = e?.message ?? "Failed to create workspace";
      const lower = msg.toLowerCase();
      if (lower.includes("row-level security") || lower.includes("rls") || lower.includes("permission")) {
        toast.error("Permission error. Please sign out and sign in again.");
      } else {
        toast.error(msg);
      }
    } finally {
      window.clearTimeout(watchdog);
      setCreating(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (creating) return; // don't close mid-request
    setOpen(next);
    if (!next) {
      clearAnimations();
      setName(""); setDesc(""); setCapacity(50);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Plus className="mr-1" /> New workspace</Button>
            </DialogTrigger>
            <DialogContent className="animate-scale-in max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Create workspace
                </DialogTitle>
              </DialogHeader>

              {/* Ghost preview layer — non-interactive, low opacity, separate from real inputs */}
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 select-none pointer-events-none" aria-hidden="true">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Demo Preview</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">demo</span>
                </div>
                <div className="space-y-2 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-muted-foreground">Name</span>
                    <span className="font-medium text-sm tracking-tight min-h-[1.25rem]">
                      {ghostName}
                      <span className="ml-0.5 inline-block h-3 w-[2px] -mb-0.5 bg-foreground/50 animate-pulse" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-muted-foreground">Event</span>
                    <span className="text-sm min-h-[1.25rem]">{ghostDesc || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-muted-foreground">Capacity</span>
                    <span className="text-sm tabular-nums font-semibold text-primary">{ghostCap}</span>
                    <span className="text-xs text-muted-foreground">people</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Organization name</Label>
                  <Input
                    id="ws-name"
                    placeholder="e.g. ABC School"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-desc">Event description</Label>
                  <Textarea
                    id="ws-desc"
                    placeholder="What is this workspace for?"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-cap">Maximum queue capacity</Label>
                  <Input
                    id="ws-cap"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    value={Number.isFinite(capacity) ? capacity : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setCapacity(NaN as unknown as number); return; }
                      const n = parseInt(v, 10);
                      if (!Number.isFinite(n)) return;
                      setCapacity(Math.max(1, Math.min(10000, n)));
                    }}
                    onBlur={() => { if (!Number.isFinite(capacity) || capacity < 1) setCapacity(50); }}
                  />
                  <p className="text-xs text-muted-foreground">Suggested capacity based on typical usage. You can change it anytime.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={creating}>Cancel</Button>
                <Button onClick={submit} disabled={creating || !authReady}>
                  {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create workspace"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your workspaces</h1>
          <p className="mt-1 text-muted-foreground">Organize lobbies by school, clinic, shop, or any team.</p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-accent" /></div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center animate-fade-in">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No workspaces yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create one to start managing lobbies and queues.</p>
            <Button className="mt-6" variant="hero" onClick={() => setOpen(true)}><Plus className="mr-1" /> Create workspace</Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((w) => (
              <Card key={w.id} className="p-5 transition hover:-translate-y-0.5 hover:shadow-elegant animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 className="h-5 w-5" /></div>
                  <span className="text-xs text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />Owner</span>
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{w.name}</h3>
                {w.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>}
                <Button asChild variant="ghost" size="sm" className="mt-4 -ml-2">
                  <Link to={`/workspaces/${w.id}`}>Open <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Workspaces;
