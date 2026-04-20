import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Bell, BellRing, CheckCircle2, ListOrdered, ScanLine, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { playChime, pushNotify, requestNotifyPermission } from "@/lib/notify";

interface Device {
  id: string; token_code: string; owner_name: string; slot_label: string | null;
  status: "checked_in" | "in_queue" | "called" | "collected"; ringing: boolean;
}

const StatusBadge = ({ status }: { status: Device["status"] }) => {
  const map: Record<string, { label: string; cls: string }> = {
    checked_in: { label: "Checked in", cls: "bg-secondary text-secondary-foreground" },
    in_queue: { label: "In queue", cls: "bg-warning/15 text-warning-foreground border border-warning/40" },
    called: { label: "Please proceed!", cls: "bg-accent text-accent-foreground" },
    collected: { label: "Collected", cls: "bg-success text-success-foreground" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
};

const Status = () => {
  const { id: paramId } = useParams();
  const nav = useNavigate();
  const [lookup, setLookup] = useState("");
  const [device, setDevice] = useState<Device | null>(null);
  const [acked, setAcked] = useState(false);
  const prevStatus = useRef<string | null>(null);
  const prevRinging = useRef<boolean>(false);

  useEffect(() => {
    if (!paramId) return;
    supabase.from("devices").select("id,token_code,owner_name,slot_label,status,ringing").eq("id", paramId).maybeSingle()
      .then(({ data }) => { if (data) setDevice(data as Device); else toast.error("Receipt not found"); });

    const channel = supabase.channel(`device:${paramId}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "devices", filter: `id=eq.${paramId}` },
      (payload) => setDevice(payload.new as Device),
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paramId]);

  // Trigger chime + push when called or rung
  useEffect(() => {
    if (!device) return;
    const becameCalled = prevStatus.current && prevStatus.current !== "called" && device.status === "called";
    const becameRinging = !prevRinging.current && device.ringing;
    if (becameCalled) {
      playChime();
      pushNotify("Your turn!", `Token ${device.token_code} — proceed to counter for slot ${device.slot_label}`);
      setAcked(false);
    }
    if (becameRinging) {
      playChime();
      pushNotify("Device ringing", `Admin is locating token ${device.token_code}`);
      setAcked(false);
    }
    prevStatus.current = device.status;
    prevRinging.current = device.ringing;
  }, [device]);

  const goLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookup.trim()) nav(`/status/${lookup.trim()}`);
  };

  const joinQueue = async () => {
    if (!device) return;
    const { error } = await supabase.from("devices").update({ status: "in_queue", queue_time: new Date().toISOString() }).eq("id", device.id);
    if (error) toast.error(error.message); else toast.success("You're in the queue");
  };

  const ackRing = async () => {
    if (!device) return;
    setAcked(true);
    await supabase.from("devices").update({ ringing: false }).eq("id", device.id);
  };

  const enableNotifs = async () => {
    const p = await requestNotifyPermission();
    if (p === "granted") toast.success("Notifications enabled");
    else toast.error("Permission denied");
  };

  if (!paramId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b"><div className="container flex h-14 items-center gap-2"><Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Check status</span></div></header>
        <main className="container max-w-md py-8">
          <h1 className="text-2xl font-bold">Find your receipt</h1>
          <p className="mt-1 text-sm text-muted-foreground">Paste your receipt link or token ID below.</p>
          <form onSubmit={goLookup} className="mt-6 flex gap-2">
            <Input placeholder="Receipt ID / token" value={lookup} onChange={(e) => setLookup(e.target.value)} />
            <Button variant="accent" type="submit"><ScanLine /></Button>
          </form>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            New here? <Link to="/checkin" className="text-accent font-semibold underline-offset-4 hover:underline">Self check-in</Link>
          </div>
        </main>
      </div>
    );
  }

  if (!device) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  const showRingingOverlay = device.ringing && !acked;

  return (
    <div className="min-h-screen bg-background">
      {showRingingOverlay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-accent text-accent-foreground animate-flash p-6">
          <div className="text-center">
            <BellRing className="mx-auto h-24 w-24 animate-bounce" />
            <h2 className="mt-4 text-4xl font-bold">RINGING</h2>
            <p className="mt-2 text-lg">Token {device.token_code} · Slot {device.slot_label}</p>
            <Button onClick={ackRing} size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary-glow">
              <X /> Acknowledge
            </Button>
          </div>
        </div>
      )}
      <header className="border-b">
        <div className="container flex h-14 items-center gap-2">
          <Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Status</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={enableNotifs}>
            <Bell /> Enable alerts
          </Button>
        </div>
      </header>
      <main className="container max-w-md py-8">
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <h1 className="text-xl font-bold">{device.owner_name}</h1>
            </div>
            <StatusBadge status={device.status} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Token</div>
              <div className="text-lg font-bold tracking-wider">{device.token_code}</div>
            </div>
            <div className="rounded-lg bg-accent/10 p-3">
              <div className="text-xs text-accent">Slot</div>
              <div className="text-lg font-bold tracking-wider text-accent">{device.slot_label}</div>
            </div>
          </div>

          {device.status === "called" && (
            <div className="mt-5 rounded-xl border-2 border-accent bg-accent/10 p-4 text-center animate-ring-pulse">
              <BellRing className="mx-auto h-8 w-8 text-accent" />
              <p className="mt-2 font-bold text-accent">Please proceed to the counter</p>
            </div>
          )}

          {device.status === "collected" && (
            <div className="mt-5 rounded-xl border-2 border-success bg-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-2 font-bold text-success">Device handed over. Thank you!</p>
            </div>
          )}

          {(device.status === "checked_in" || device.status === "in_queue" || device.status === "called") && (
            <div className="mt-5 inline-block rounded-2xl border-4 border-primary bg-white p-3 mx-auto block w-fit">
              <QRCodeCanvas value={device.id} size={160} level="H" />
            </div>
          )}

          <div className="mt-5">
            {device.status === "checked_in" && (
              <Button variant="hero" size="lg" className="w-full" onClick={joinQueue}>
                <ListOrdered /> Join collection queue
              </Button>
            )}
            {device.status === "in_queue" && (
              <p className="text-center text-sm text-muted-foreground">You're in the queue. We'll chime when it's your turn.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Status;
