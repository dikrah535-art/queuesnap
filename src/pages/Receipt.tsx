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

  useEffect(() => {
    if (!id) return;
    supabase.from("devices").select("id, token_code, owner_name, slot_label, status").eq("id", id).single()
      .then(({ data }) => setDevice(data as Device | null));
  }, [id]);

  if (!device) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  const statusUrl = `${window.location.origin}/status/${device.id}`;

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
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="mt-3 text-2xl font-bold">Device submitted</h1>
          <p className="text-sm text-muted-foreground">{device.owner_name}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Token</div>
              <div className="text-lg font-bold tracking-wider">{device.token_code}</div>
            </div>
            <div className="rounded-lg bg-accent/10 p-3">
              <div className="text-xs text-accent">Slot</div>
              <div className="text-lg font-bold tracking-wider text-accent">{device.slot_label}</div>
            </div>
          </div>

          <div className="mt-6 inline-block rounded-2xl border-4 border-primary bg-white p-4">
            <QRCodeCanvas value={device.id} size={180} level="H" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Show this QR at the counter for handover.</p>

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
