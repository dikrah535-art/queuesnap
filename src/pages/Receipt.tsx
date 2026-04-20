import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Device {
  id: string; token_code: string; owner_name: string; slot_label: string | null; status: string;
}

const Receipt = () => {
  const { id } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const raw = id.trim();
    supabase.rpc("lookup_device", { _token: raw }).then(({ data, error }) => {
      if (import.meta.env.DEV) console.debug("[Receipt] lookup status", { hasData: !!(data && data.length), error });
      const row = Array.isArray(data) ? data[0] : null;
      if (row) setDevice(row as Device);
      else setNotFound(true);
    });
  }, [id]);

  if (notFound) return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center space-y-4">
        <h2 className="text-xl font-bold">Invalid or expired token</h2>
        <p className="text-sm text-muted-foreground">Token <span className="font-mono">{id}</span> doesn't match any device.</p>
        <Button asChild variant="hero"><Link to="/checkin"><ArrowLeft /> Back to check-in</Link></Button>
      </div>
    </div>
  );
  if (!device) return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      Fetching data…
    </div>
  );

  const statusUrl = `${window.location.origin}/status/${device.id}`;
  const isCollected = device.status === "collected";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Home</Link></Button>
          <div className="ml-auto flex items-center gap-2"><Smartphone className="h-4 w-4 text-accent" /><span className="font-semibold">Digital receipt</span></div>
        </div>
      </header>
      <main className="container max-w-md py-8">
        <div className="rounded-2xl border bg-card p-6 shadow-elegant text-center">
          <CheckCircle2 className={`mx-auto h-10 w-10 ${isCollected ? "text-success" : "text-accent"}`} />
          <h1 className="mt-3 text-2xl font-bold">
            {isCollected ? "Device collected" : "Device submitted"}
          </h1>
          <p className="text-sm text-muted-foreground">{device.owner_name}</p>

          {/* Prominent Token */}
          <div className="mt-6 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Token ID</div>
            <div className="mt-1 text-4xl md:text-5xl font-extrabold tracking-[0.25em] text-accent">
              {device.token_code}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className={`text-base font-bold ${isCollected ? "text-success" : "text-foreground"}`}>
                {isCollected ? "Collected" : "Stored"}
              </div>
            </div>
            <div className="rounded-lg bg-accent/10 p-3">
              <div className="text-xs text-accent">Slot</div>
              <div className="text-lg font-bold tracking-wider text-accent">{device.slot_label ?? "—"}</div>
            </div>
          </div>

          <div className="mt-6 inline-block rounded-2xl border-4 border-primary bg-white p-4">
            <QRCodeCanvas value={device.id} size={200} level="H" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Show this QR at collection counter</p>

          <Button asChild variant="hero" size="lg" className="mt-6 w-full">
            <Link to={`/status/${device.id}`}>Open status page <ArrowRight /></Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Bookmark this link: <br /><span className="break-all text-foreground">{statusUrl}</span></p>
        </div>
      </main>
    </div>
  );
};

export default Receipt;
