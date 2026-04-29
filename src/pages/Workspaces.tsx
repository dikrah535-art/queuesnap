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
import { supabase } from "@/integrations/supabase/client";
import { createWorkspace, fetchMyWorkspaces, type Workspace } from "@/lib/workspaces";

const DEMO_NAME = "Agresh Ji's Workspace";
const DEMO_DESC = "Office Meeting";
const DEMO_CAPACITY = 25;

const Workspaces = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [creating, setCreating] = useState(false);
  const animRef = useRef<number[]>([]);

  const reload = async () => {
    setLoading(true);
    try { setItems(await fetchMyWorkspaces()); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const clearAnimations = () => {
    animRef.current.forEach((id) => window.clearTimeout(id));
    animRef.current = [];
  };

  // Run guided demo animations when dialog opens with empty fields
  useEffect(() => {
    if (!open) { clearAnimations(); return; }
    // Only auto-fill when user hasn't started typing
    if (name || desc) return;

    setName(""); setDesc(""); setCapacity(0);

    const typeInto = (text: string, setter: (s: string) => void, startDelay: number, perChar = 35) => {
      for (let i = 1; i <= text.length; i++) {
        const id = window.setTimeout(() => setter(text.slice(0, i)), startDelay + i * perChar);
        animRef.current.push(id);
      }
    };

    typeInto(DEMO_NAME, setName, 200, 35);
    const descStart = 200 + DEMO_NAME.length * 35 + 250;
    typeInto(DEMO_DESC, setDesc, descStart, 40);

    // Animate capacity 0 -> 25 after text is done
    const capStart = descStart + DEMO_DESC.length * 40 + 200;
    const steps = DEMO_CAPACITY;
    for (let i = 1; i <= steps; i++) {
      const id = window.setTimeout(() => setCapacity(i), capStart + i * 30);
      animRef.current.push(id);
    }

    return () => clearAnimations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
    if (!Number.isFinite(capacity) || capacity < 1) { toast.error("Capacity must be a number ≥ 1"); return; }
    setCreating(true);
    try {
      // Re-verify session to avoid stale-token RLS errors
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Your session expired. Please sign in again.");
        navigate("/admin/login?next=/workspaces");
        return;
      }
      const ws = await createWorkspace(name, desc, capacity);
      toast.success("Workspace created — taking you in…");
      setOpen(false); setName(""); setDesc(""); setCapacity(50);
      setItems((s) => [ws, ...s]);
      // Guide user to the new workspace
      window.setTimeout(() => navigate(`/workspaces/${ws.id}`), 400);
    } catch (e: any) {
      const msg: string = e?.message ?? "Failed to create workspace";
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("rls")) {
        toast.error("Permission error. Please sign out and sign in again.");
      } else {
        toast.error(msg);
      }
    } finally { setCreating(false); }
  };

  const handleOpenChange = (next: boolean) => {
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
            <DialogContent className="animate-scale-in">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Create workspace
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Organization name</Label>
                  <Input id="ws-name" placeholder="e.g. ABC School" value={name} onChange={(e) => { clearAnimations(); setName(e.target.value); }} maxLength={80} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-desc">Event description</Label>
                  <Textarea id="ws-desc" placeholder="What is this workspace for?" value={desc} onChange={(e) => { clearAnimations(); setDesc(e.target.value); }} maxLength={500} />
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
                      clearAnimations();
                      const v = e.target.value;
                      if (v === "") { setCapacity(NaN); return; }
                      const n = parseInt(v, 10);
                      setCapacity(Number.isFinite(n) ? Math.max(1, Math.min(10000, n)) : NaN);
                    }}
                    onBlur={() => { if (!Number.isFinite(capacity) || capacity < 1) setCapacity(50); }}
                  />
                  <p className="text-xs text-muted-foreground">Suggested capacity based on typical usage.</p>
                </div>
                <p className="text-xs text-muted-foreground">You can customize this anytime.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button onClick={submit} disabled={creating}>
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
