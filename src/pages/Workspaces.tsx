import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Loader2, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createWorkspace, fetchMyWorkspaces, type Workspace } from "@/lib/workspaces";

const Workspaces = () => {
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setItems(await fetchMyWorkspaces()); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const submit = async () => {
    if (name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
    setCreating(true);
    try {
      const ws = await createWorkspace(name, desc);
      toast.success("Workspace created");
      setOpen(false); setName(""); setDesc("");
      setItems((s) => [ws, ...s]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create workspace");
    } finally { setCreating(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Plus className="mr-1" /> New workspace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create workspace</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Workspace name</Label>
                  <Input id="ws-name" placeholder="e.g. ABC School" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-desc">Description (optional)</Label>
                  <Textarea id="ws-desc" placeholder="What is this workspace for?" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={creating}>
                  {creating ? <Loader2 className="animate-spin" /> : "Create"}
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
          <Card className="p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No workspaces yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create one to start managing lobbies and queues.</p>
            <Button className="mt-6" variant="hero" onClick={() => setOpen(true)}><Plus className="mr-1" /> Create workspace</Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((w) => (
              <Card key={w.id} className="p-5 transition hover:-translate-y-0.5 hover:shadow-elegant">
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
