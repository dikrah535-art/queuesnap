import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  addAdminByEmail, fetchMembers, fetchProfilesByIds, fetchWorkspace, getMyRole, removeMember,
  type Workspace, type WorkspaceMember, type WorkspaceRole,
} from "@/lib/workspaces";

interface Row extends WorkspaceMember { email?: string | null; display_name?: string | null }

const WorkspaceAdmins = () => {
  const { wsId } = useParams<{ wsId: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [w, m, r] = await Promise.all([fetchWorkspace(wsId), fetchMembers(wsId), getMyRole(wsId)]);
      setWs(w); setRole(r);
      const profiles = await fetchProfilesByIds(m.map((x) => x.user_id));
      const map = new Map(profiles.map((p: any) => [p.id, p]));
      setRows(m.map((mem) => ({ ...mem, email: (map.get(mem.user_id) as any)?.email, display_name: (map.get(mem.user_id) as any)?.display_name })));
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [wsId]);

  const isAdmin = role === "owner" || role === "admin";

  const onAdd = async () => {
    if (!wsId || !email.trim()) return;
    setAdding(true);
    try {
      await addAdminByEmail(wsId, email);
      toast.success("Admin added");
      setEmail("");
      reload();
    } catch (e: any) {
      const msg = e?.message ?? "Failed";
      if (msg.includes("No user found")) toast.error("No QueueSnap user with that email. They must sign up first.");
      else toast.error(msg);
    } finally { setAdding(false); }
  };

  const onRemove = async (row: Row) => {
    if (row.role === "owner") { toast.error("Cannot remove the owner"); return; }
    if (!confirm(`Remove ${row.display_name ?? row.email ?? "this admin"}?`)) return;
    try { await removeMember(row.id); toast.success("Removed"); reload(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!ws) return <div className="grid min-h-screen place-items-center text-muted-foreground">Workspace not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to={`/workspaces/${ws.id}`}><ArrowLeft /></Link></Button>
          <div>
            <h1 className="font-semibold leading-tight">Manage admins</h1>
            <p className="text-xs text-muted-foreground">{ws.name}</p>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8 space-y-6">
        {isAdmin && (
          <Card className="p-5">
            <h3 className="font-semibold">Add admin by email</h3>
            <p className="mt-1 text-sm text-muted-foreground">The user must already have a QueueSnap account.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input id="email" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAdd()} />
              </div>
              <Button onClick={onAdd} disabled={!email.trim() || adding}>
                {adding ? <Loader2 className="animate-spin" /> : <><UserPlus className="mr-1 h-4 w-4" /> Add admin</>}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h3 className="font-semibold">Members</h3>
          <ul className="mt-4 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-semibold uppercase">
                    {(r.display_name ?? r.email ?? "?").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.display_name ?? r.email ?? r.user_id.slice(0, 8)}</p>
                    {r.email && <p className="truncate text-xs text-muted-foreground"><Mail className="inline h-3 w-3 mr-1" />{r.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.role === "owner" ? "default" : "secondary"} className="capitalize">{r.role}</Badge>
                  {isAdmin && r.role !== "owner" && (
                    <Button variant="ghost" size="icon" onClick={() => onRemove(r)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
};

export default WorkspaceAdmins;
