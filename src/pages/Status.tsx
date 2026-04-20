import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Bell, BellRing, CheckCircle2, ListOrdered, ScanLine, Smartphone, X } from "lucide-react";
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
  const [notFound, setNotFound] = useState(false);
  const [acked, setAcked] = useState(false);
  const [queuePos, setQueuePos] = useState<number | null>(null);
  const prevStatus = useRef<string | null>(null);
  const prevRinging = useRef<boolean>(false);

  // Fetch + poll via secure RPC (no PII broadcast over realtime)
  useEffect(() => {
    if (!paramId) return;
    const raw = paramId.trim();
    let cancelled = false;

    const fetchOnce = async () => {
      const { data, error } = await supabase.rpc("lookup_device", { _token: raw });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (import.meta.env.DEV) console.debug("[Status] lookup", { hasData: !!row, error });
      if (row) {
        setDevice(row as Device);
        setNotFound(false);
        if ((row as Device).status === "in_queue") {
          const { data: pos } = await supabase.rpc("queue_position", { _id: (row as Device).id, _token: (row as Device).token_code });
          if (!cancelled) setQueuePos(typeof pos === "number" ? pos : null);
        } else {
          setQueuePos(null);
        }
      } else if (!device) {
        setNotFound(true);
        toast.error("Invalid or expired token");
      }
    };

    fetchOnce();
    const iv = setInterval(fetchOnce, 4000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { data, error } = await supabase.rpc("join_queue", { _id: device.id, _token: device.token_code });
    if (error) { toast.error(error.message); return; }
    if (data === true) toast.success("You're in the queue");
    else toast.error("Could not join queue");
  };

  const ackRing = async () => {
    if (!device) return;
    setAcked(true);
    await supabase.rpc("ack_ring", { _id: device.id, _token: device.token_code });
  };

  const enableNotifs = async () => {
    const p = await requestNotifyPermission();
    if (p === "granted") toast.success("Notifications enabled");
    else toast.error("Permission denied");
  };

  if (!paramId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b"><div className="container flex h-14 items-center gap-3"><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Home</Link></Button><div className="ml-auto flex items-center gap-2"><Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Check status</span></div></div></header>
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

  if (notFound) return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center space-y-4">
        <h2 className="text-xl font-bold">Invalid or expired token</h2>
        <p className="text-sm text-muted-foreground">Token <span className="font-mono">{paramId}</span> doesn't match any device.</p>
        <Button asChild variant="outline" size="sm"><Link to="/status"><ArrowLeft /> Try another token</Link></Button>
      </div>
    </div>
  );

  if (!device) return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-muted-foreground">Searching for <span className="font-mono font-semibold">{paramId}</span>…</p>
      </div>
    </div>
  );

  if (device.status === "collected") return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h2 className="text-xl font-bold">This device has already been collected</h2>
        <p className="text-sm text-muted-foreground">Token <span className="font-mono">{device.token_code}</span> · {device.owner_name}</p>
        <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft /> Home</Link></Button>
      </div>
    </div>
  );

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
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Home</Link></Button>
          <div className="mx-auto flex items-center gap-2"><Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Status</span></div>
          <Button variant="ghost" size="sm" onClick={enableNotifs}>
            <Bell /> Alerts
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
              <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-4 text-center">
                <p className="text-sm font-semibold text-warning-foreground">Please wait for your turn</p>
                {queuePos && queuePos > 0 ? (
                  <p className="mt-2 text-3xl font-extrabold text-warning">
                    #{queuePos}
                    <span className="ml-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">in queue</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">We'll chime when it's your turn.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Status;
