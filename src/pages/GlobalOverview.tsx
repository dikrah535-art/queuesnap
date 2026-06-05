import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, CheckCircle, Clock, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

interface Overview {
  workspaces_count: number;
  lobbies_count: number;
  summary: {
    total_served: number;
    total_tokens: number;
    currently_waiting: number;
    avg_wait_mins: number | null;
  };
  per_workspace: Array<{
    workspace_id: string;
    workspace_name: string;
    served: number;
    waiting: number;
    avg_wait_mins: number | null;
  }>;
}

const GlobalOverview = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_global_overview" as never);
        if (error) throw error;
        setData(data as unknown as Overview);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load overview");
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!data) return <div className="grid min-h-screen place-items-center text-muted-foreground">No data available</div>;

  const { summary, per_workspace } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/workspaces"><ArrowLeft /></Link></Button>
            <div>
              <h1 className="font-semibold leading-tight">Global Overview</h1>
              <p className="text-xs text-muted-foreground">All your workspaces, at a glance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><Building2 className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspaces</p></div>
            <p className="text-3xl font-semibold tabular-nums">{data.workspaces_count} <span className="text-sm font-normal text-muted-foreground">/ {data.lobbies_count} lobbies</span></p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total tokens served</p></div>
            <p className="text-3xl font-semibold tabular-nums text-green-500">{summary.total_served ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.total_tokens ?? 0} total tokens issued</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg wait time</p></div>
            <p className="text-3xl font-semibold tabular-nums">{summary.avg_wait_mins != null ? `${summary.avg_wait_mins}m` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all locations</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-blue-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Currently waiting</p></div>
            <p className="text-3xl font-semibold tabular-nums">{summary.currently_waiting ?? 0}</p>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">By workspace</h3>
          {per_workspace.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">You don't manage any workspaces yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {per_workspace.map((w) => (
                <li key={w.workspace_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link to={`/workspaces/${w.workspace_id}`} className="font-medium hover:underline">
                    {w.workspace_name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-green-500"><CheckCircle className="inline h-3.5 w-3.5 mr-1" />{w.served} served</span>
                    <span className="text-blue-500"><Users className="inline h-3.5 w-3.5 mr-1" />{w.waiting} waiting</span>
                    <span className="text-muted-foreground"><Clock className="inline h-3.5 w-3.5 mr-1" />{w.avg_wait_mins != null ? `${w.avg_wait_mins}m avg` : "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
};

export default GlobalOverview;
