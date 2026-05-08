import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { fetchDemoVisitors, type DemoVisitor } from "@/lib/workspaces";

const csvEscape = (v: string | null | undefined) => {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const AdminDemoVisitors = () => {
  const [rows, setRows] = useState<DemoVisitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemoVisitors()
      .then(setRows)
      .catch((e) => toast.error(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Visited At", "Source"];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [r.name, r.email, r.phone, new Date(r.visited_at).toISOString(), r.source].map(csvEscape).join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `demo-visitors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/workspaces"><ArrowLeft /></Link></Button>
            <div>
              <h1 className="font-semibold leading-tight">Demo Visitors</h1>
              <p className="text-xs text-muted-foreground">People who tried the public demo lobby</p>
            </div>
          </div>
          <Button onClick={exportCsv} disabled={rows.length === 0} variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <Card className="p-5 flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total visitors</p>
            <p className="text-3xl font-semibold tabular-nums">{rows.length}</p>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-accent" /></div>
          ) : rows.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">No demo visitors yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Visited At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {new Date(r.visited_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminDemoVisitors;
