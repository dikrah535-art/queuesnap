import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, Users, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchLobby, type Lobby } from "@/lib/workspaces";
import { toast } from "@/components/ui/sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from "recharts";

interface DailyStats {
  date: string;
  total: number;
  served: number;
  waiting: number;
  cancelled: number;
  avg_wait_mins: number | null;
}

interface HourlyStats {
  hour: number;
  total: number;
}

interface Summary {
  total_all_time: number;
  total_served: number;
  today_total: number;
  today_served: number;
  avg_wait_mins_all_time: number | null;
}

interface Analytics {
  daily: DailyStats[];
  hourly: HourlyStats[];
  summary: Summary;
}

const HOUR_LABELS = ["12am","1am","2am","3am","4am","5am","6am","7am","8am","9am","10am","11am","12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"];

const Analytics = () => {
  const { wsId, lobbyId } = useParams<{ wsId: string; lobbyId: string }>();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!lobbyId) return;
    setLoading(true);
    try {
      const [l, { data, error }] = await Promise.all([
        fetchLobby(lobbyId),
        supabase.rpc("get_lobby_analytics", { _lobby_id: lobbyId, _days: days } as never),
      ]);
      setLobby(l);
      if (error) throw error;
      setAnalytics(data as unknown as Analytics);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [lobbyId, days]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!lobby || !analytics) return <div className="grid min-h-screen place-items-center text-muted-foreground">No data found</div>;

  const { summary, daily, hourly } = analytics;
  const dailyData = (daily ?? []).map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
  }));
  const hourlyData = (hourly ?? []).map((h) => ({
    ...h,
    label: HOUR_LABELS[h.hour] ?? `${h.hour}:00`,
  }));

  const successRate = summary.total_all_time > 0
    ? Math.round((summary.total_served / summary.total_all_time) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to={`/workspaces/${wsId}/lobbies/${lobbyId}`}><ArrowLeft /></Link>
            </Button>
            <div>
              <h1 className="font-semibold leading-tight">{lobby.name} — Analytics</h1>
              <p className="text-xs text-muted-foreground">Queue performance insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                variant={days === d ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total all time</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{summary.total_all_time ?? 0}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Success rate</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums text-green-500">{successRate}%</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{summary.today_total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.today_served ?? 0} served</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg wait time</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">
              {summary.avg_wait_mins_all_time != null ? `${summary.avg_wait_mins_all_time}m` : "—"}
            </p>
          </Card>
        </div>

        {/* Daily Chart */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Daily queue activity (last {days} days)</h3>
          {dailyData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No data for this period yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="served" name="Served" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Avg Wait Time Chart */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Average wait time per day (minutes)</h3>
          {dailyData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No data for this period yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: any) => v != null ? `${v} min` : "—"}
                />
                <Line type="monotone" dataKey="avg_wait_mins" name="Avg wait (min)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Peak Hours Chart */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Peak hours (last 7 days)</h3>
          {hourlyData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="total" name="People" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Analytics;
