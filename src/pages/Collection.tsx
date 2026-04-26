import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, PackageCheck, ScanLine, Search, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrScanner } from "@/components/QrScanner";
import { playChime } from "@/lib/notify";
import { formatDistanceToNow } from "date-fns";

interface Device {
  id: string;
  token_code: string;
  owner_name: string;
  owner_id_text: string | null;
  owner_email: string | null;
  phone_model: string | null;
  slot_label: string | null;
  status: "checked_in" | "in_queue" | "called" | "collected";
  ringing: boolean;
  check_in_time: string;
  collection_time: string | null;
  photo_url: string | null;
}

const statusStyles: Record<Device["status"], string> = {
  checked_in: "bg-secondary text-secondary-foreground",
  in_queue: "bg-warning/15 text-warning border border-warning/40",
  called: "bg-accent text-accent-foreground",
  collected: "bg-success text-success-foreground",
};

const statusLabel: Record<Device["status"], string> = {
  checked_in: "Checked in",
  in_queue: "In queue",
  called: "Called",
  collected: "Collected",
};

const Collection = () => {
  const nav = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Device | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const loadDevices = async () => {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .order("check_in_time", { ascending: false });
    if (error) toast.error(error.message);
    setDevices((data as Device[]) ?? []);
    setLoadingList(false);
  };

  useEffect(() => {
    loadDevices();
    const iv = setInterval(loadDevices, 5000);
    return () => clearInterval(iv);
  }, []);

  // Refresh selected device whenever the list updates
  useEffect(() => {
    if (!selected) return;
    const fresh = devices.find((d) => d.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [devices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signed URL for owner photo (private bucket)
  useEffect(() => {
    let cancelled = false;
    setPhotoUrl(null);
    if (!selected?.photo_url) return;
    const m = selected.photo_url.match(
      /\/storage\/v1\/object\/(?:public|sign)\/device-photos\/(.+?)(?:\?.*)?$/,
    );
    if (!m) return;
    supabase.storage.from("device-photos").createSignedUrl(m[1], 60).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.photo_url]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices.slice(0, 25);
    return devices
      .filter(
        (d) =>
          d.owner_name.toLowerCase().includes(q) ||
          d.token_code.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [devices, search]);

  const fetchById = async (id: string) => {
    setFetchingDetails(true);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setFetchingDetails(false);
    if (error) { toast.error(error.message); return null; }
    if (!data) { toast.error("Device not found"); return null; }
    return data as Device;
  };

  const handleScan = async (text: string) => {
    setScanning(false);
    const raw = text.trim();
    let device: Device | null = null;

    // UUID — direct lookup
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      device = await fetchById(raw);
    } else {
      // Token code lookup
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("token_code", raw.toUpperCase())
        .maybeSingle();
      if (error) { toast.error(error.message); return; }
      if (!data) { toast.error("Device not found"); return; }
      device = data as Device;
    }

    if (!device) return;
    playChime();
    if (navigator.vibrate) navigator.vibrate(80);
    setSelected(device);
    toast.success(`Found ${device.owner_name}`);
  };

  const pickFromList = async (d: Device) => {
    const fresh = await fetchById(d.id);
    if (fresh) setSelected(fresh);
  };

  const confirmCollect = async () => {
    if (!selected) return;
    setCollecting(true);
    const { error } = await supabase
      .from("devices")
      .update({
        status: "collected",
        collection_time: new Date().toISOString(),
        ringing: false,
      })
      .eq("id", selected.id);
    setCollecting(false);
    if (error) {
      toast.error("Failed to mark as collected. Try again.");
      return;
    }
    toast.success("Device marked as collected", { duration: 2500 });
    setConfirmOpen(false);
    // Optimistic update
    setSelected({
      ...selected,
      status: "collected",
      collection_time: new Date().toISOString(),
      ringing: false,
    });
    loadDevices();
  };

  const isCollected = selected?.status === "collected";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="container flex h-14 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><ArrowLeft /> Admin</Link>
          </Button>
          <Smartphone className="h-5 w-5 text-accent" />
          <span className="font-bold hidden sm:inline">Device Collection / Verification</span>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Device Collection / Verification</h1>
          <p className="text-sm text-muted-foreground">
            Identify a device via QR code or manual search, then confirm collection.
          </p>
        </div>

        {/* Section 1: identification */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* Scan card */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-accent" /> Scan QR code
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the camera to scan the receipt QR.
            </p>
            <Button
              variant="accent"
              className="mt-4 w-full"
              onClick={() => setScanning(true)}
            >
              <ScanLine /> Scan QR Code
            </Button>
          </div>

          {/* Manual search card */}
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4 text-accent" /> Manual selection
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Search by owner name, token, or device ID.
            </p>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search devices…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border">
              {loadingList ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No devices found.
                </div>
              ) : (
                <ul className="divide-y">
                  {results.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => pickFromList(d)}
                        className={`flex w-full items-center justify-between gap-3 p-3 text-left text-sm transition-colors hover:bg-secondary ${
                          selected?.id === d.id ? "bg-secondary" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{d.owner_name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            Token <span className="font-mono">{d.token_code}</span>
                            {d.slot_label && <> · Slot <span className="text-accent font-semibold">{d.slot_label}</span></>}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[d.status]}`}>
                          {statusLabel[d.status]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: device details */}
        <section
          className={`rounded-xl border p-5 shadow-card transition-colors ${
            selected
              ? isCollected
                ? "border-success/50 bg-success/5"
                : "border-accent/40 bg-card"
              : "bg-card"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Device details</h2>
            {selected && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selected.status]}`}>
                {statusLabel[selected.status]}
              </span>
            )}
          </div>

          {!selected ? (
            <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {fetchingDetails ? "Loading device…" : "Scan a QR code or pick a device from the list."}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Owner" value={selected.owner_name} />
                  <Field label="Token" value={<span className="font-mono">{selected.token_code}</span>} />
                  <Field label="Device ID" value={<span className="font-mono text-xs">{selected.id}</span>} mono />
                  <Field label="Slot" value={selected.slot_label ?? "—"} accent />
                  {selected.phone_model && <Field label="Phone model" value={selected.phone_model} />}
                  {selected.owner_email && <Field label="Email" value={selected.owner_email} />}
                  {selected.owner_id_text && <Field label="Owner ID" value={selected.owner_id_text} />}
                  <Field
                    label="Checked in"
                    value={formatDistanceToNow(new Date(selected.check_in_time), { addSuffix: true })}
                  />
                  {selected.collection_time && (
                    <Field
                      label="Collected"
                      value={formatDistanceToNow(new Date(selected.collection_time), { addSuffix: true })}
                    />
                  )}
                </div>

                {isCollected ? (
                  <Button variant="success" size="lg" className="w-full md:w-auto" disabled>
                    <CheckCircle2 /> Already Collected ✅
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="lg"
                    className="w-full md:w-auto"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <PackageCheck /> Mark as Collected
                  </Button>
                )}
              </div>

              {photoUrl && (
                <img
                  src={photoUrl}
                  alt={`${selected.owner_name} owner photo`}
                  className="h-40 w-40 rounded-lg object-cover md:h-48 md:w-48"
                />
              )}
            </div>
          )}
        </section>
      </main>

      {/* Scanner dialog */}
      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan receipt QR</DialogTitle></DialogHeader>
          {scanning && <QrScanner onResult={handleScan} onError={(e) => toast.error(e)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm collection */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !collecting && setConfirmOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm device collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the device as collected and free its slot.
              {selected && (
                <span className="mt-3 block rounded-lg bg-secondary p-3 text-foreground">
                  <span className="block text-sm font-semibold">{selected.owner_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Token <span className="font-mono font-semibold">{selected.token_code}</span>
                    {selected.slot_label && <> · Slot <span className="font-semibold text-accent">{selected.slot_label}</span></>}
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={collecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmCollect(); }}
              disabled={collecting}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {collecting ? "Collecting…" : "Confirm collection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Field = ({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  mono?: boolean;
}) => (
  <div className={`rounded-lg p-3 ${accent ? "bg-accent/10" : "bg-secondary"}`}>
    <div className={`text-[10px] uppercase tracking-wider ${accent ? "text-accent" : "text-muted-foreground"}`}>
      {label}
    </div>
    <div className={`mt-0.5 font-semibold ${accent ? "text-accent" : ""} ${mono ? "break-all" : ""}`}>
      {value}
    </div>
  </div>
);

export default Collection;
