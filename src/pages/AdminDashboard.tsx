import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, BellRing, CheckCircle2, Grid3x3, ListOrdered, LogOut,
  PhoneCall, ScanLine, Search, Smartphone, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrScanner } from "@/components/QrScanner";
import { formatDistanceToNow } from "date-fns";

interface Device {
  id: string; token_code: string; owner_name: string; owner_id_text: string | null;
  slot_id: string | null; slot_label: string | null;
  status: "checked_in" | "in_queue" | "called" | "collected"; ringing: boolean;
  check_in_time: string; queue_time: string | null; called_time: string | null;
  photo_url: string | null;
}
interface Slot { id: string; label: string; is_occupied: boolean; }

const statusColor: Record<string, string> = {
  checked_in: "bg-secondary text-secondary-foreground",
  in_queue: "bg-warning/15 text-warning border border-warning/40",
  called: "bg-accent text-accent-foreground",
  collected: "bg-success text-success-foreground",
};

const AdminDashboard = () => {
  const nav = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [scanning, setScanning] = useState(false);
  const [handover, setHandover] = useState<Device | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase.from("devices").select("*").order("check_in_time", { ascending: false }),
      supabase.from("slots").select("*").order("label"),
    ]);
    setDevices((d as Device[]) ?? []);
    setSlots((s as Slot[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const queue = useMemo(() => devices.filter((d) => d.status === "in_queue").sort((a, b) => (a.queue_time ?? "").localeCompare(b.queue_time ?? "")), [devices]);
  const called = useMemo(() => devices.filter((d) => d.status === "called"), [devices]);
  const checkedIn = useMemo(() => devices.filter((d) => d.status === "checked_in"), [devices]);

  const callNext = async (n: number) => {
    const next = queue.slice(0, n);
    if (!next.length) { toast.info("Queue is empty"); return; }
    const { error } = await supabase.from("devices").update({ status: "called", called_time: new Date().toISOString() }).in("id", next.map((d) => d.id));
    if (error) toast.error(error.message); else toast.success(`Called ${next.length}`);
  };

  const ring = async (d: Device) => {
    await supabase.from("devices").update({ ringing: true }).eq("id", d.id);
    toast.success(`Ringing ${d.token_code}`);
  };

  const handleScan = async (text: string) => {
    setScanning(false);
    const id = text.trim();
    const { data, error } = await supabase.from("devices").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Invalid receipt"); return; }
    if (data.status === "collected") { toast.error("Already collected — invalid QR"); return; }
    setHandover(data as Device);
  };

  const confirmHandover = async () => {
    if (!handover) return;
    const { error } = await supabase.from("devices").update({
      status: "collected", collection_time: new Date().toISOString(), ringing: false,
    }).eq("id", handover.id);
    if (error) { toast.error(error.message); return; }
    if (handover.slot_id) await supabase.from("slots").update({ is_occupied: false }).eq("id", handover.slot_id);
    toast.success(`Handed over to ${handover.owner_name}`);
    setHandover(null);
  };

  const signOut = async () => { await supabase.auth.signOut(); nav("/admin/login"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="container flex h-14 items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Home</Link></Button>
          <Smartphone className="h-5 w-5 text-accent" />
          <span className="font-bold hidden sm:inline">SyncPhone · Admin</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="accent" size="sm" onClick={() => setScanning(true)}><ScanLine /> Scan</Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { icon: Users, label: "Checked in", val: checkedIn.length, cls: "text-foreground" },
            { icon: ListOrdered, label: "In queue", val: queue.length, cls: "text-warning" },
            { icon: BellRing, label: "Called", val: called.length, cls: "text-accent" },
            { icon: CheckCircle2, label: "Slots free", val: slots.filter((s) => !s.is_occupied).length, cls: "text-success" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className="h-4 w-4" /> {s.label}</div>
              <div className={`mt-1 text-3xl font-bold ${s.cls}`}>{s.val}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue"><ListOrdered className="mr-1 h-4 w-4" /> Queue</TabsTrigger>
            <TabsTrigger value="all"><Users className="mr-1 h-4 w-4" /> All devices</TabsTrigger>
            <TabsTrigger value="slots"><Grid3x3 className="mr-1 h-4 w-4" /> Slots</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="hero" onClick={() => callNext(5)}><PhoneCall /> Call next 5</Button>
              <Button variant="accent" onClick={() => callNext(3)}>Call next 3</Button>
              <Button variant="outline" onClick={() => callNext(1)}>Call next 1</Button>
            </div>

            {called.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-accent">Currently called</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {called.map((d) => <DeviceRow key={d.id} d={d} onRing={() => ring(d)} />)}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Waiting queue ({queue.length})</h3>
              {queue.length === 0 ? <EmptyState text="No one is in the queue right now." /> : (
                <div className="grid gap-2 md:grid-cols-2">
                  {queue.map((d, i) => <DeviceRow key={d.id} d={d} index={i + 1} onRing={() => ring(d)} />)}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="all" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by token or owner name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="p-3 text-left">Token</th><th className="p-3 text-left">Owner</th><th className="p-3 text-left">Slot</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Check-in</th></tr>
                </thead>
                <tbody>
                  {devices.filter((d) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return d.token_code.toLowerCase().includes(q) || d.owner_name.toLowerCase().includes(q);
                  }).map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="p-3 font-mono font-semibold">{d.token_code}</td>
                      <td className="p-3">{d.owner_name}</td>
                      <td className="p-3"><span className="rounded bg-accent/10 px-2 py-0.5 font-semibold text-accent">{d.slot_label}</span></td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[d.status]}`}>{d.status}</span></td>
                      <td className="p-3 text-muted-foreground">{formatDistanceToNow(new Date(d.check_in_time), { addSuffix: true })}</td>
                    </tr>
                  ))}
                  {!devices.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No devices yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="slots">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-10">
              {slots.map((s) => (
                <div key={s.id} className={`rounded-lg border-2 p-3 text-center font-mono font-semibold ${s.is_occupied ? "border-accent bg-accent/10 text-accent" : "border-success/40 bg-success/5 text-success"}`}>
                  {s.label}
                  <div className="mt-1 text-[10px] uppercase tracking-wider opacity-70">{s.is_occupied ? "occupied" : "free"}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Scanner */}
      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan receipt QR</DialogTitle></DialogHeader>
          {scanning && <QrScanner onResult={handleScan} onError={(e) => toast.error(e)} />}
        </DialogContent>
      </Dialog>

      {/* Handover */}
      <Dialog open={!!handover} onOpenChange={(o) => !o && setHandover(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify & hand over</DialogTitle></DialogHeader>
          {handover && (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary p-4">
                <div className="text-xs text-muted-foreground">Owner</div>
                <div className="text-xl font-bold">{handover.owner_name}</div>
                {handover.owner_id_text && <div className="text-sm text-muted-foreground">ID: {handover.owner_id_text}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary p-3">
                  <div className="text-xs text-muted-foreground">Token</div>
                  <div className="text-lg font-bold tracking-wider">{handover.token_code}</div>
                </div>
                <div className="rounded-lg bg-accent/10 p-3">
                  <div className="text-xs text-accent">Slot</div>
                  <div className="text-2xl font-bold tracking-wider text-accent">{handover.slot_label}</div>
                </div>
              </div>
              {handover.photo_url && <img src={handover.photo_url} alt="Owner" className="w-full rounded-lg" />}
              <Button variant="success" size="lg" className="w-full" onClick={confirmHandover}>
                <CheckCircle2 /> Confirm handed over
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DeviceRow = ({ d, index, onRing }: { d: Device; index?: number; onRing: () => void }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-card">
    <div className="flex items-center gap-3 min-w-0">
      {index && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 font-bold text-warning">{index}</div>}
      <div className="min-w-0">
        <div className="truncate font-semibold">{d.owner_name}</div>
        <div className="text-xs text-muted-foreground">Token {d.token_code} · Slot <span className="text-accent font-semibold">{d.slot_label}</span></div>
      </div>
    </div>
    <Button variant="outline" size="sm" onClick={onRing}><Bell className="h-4 w-4" /> Ring</Button>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>
);

export default AdminDashboard;
