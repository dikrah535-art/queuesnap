import { Link } from "react-router-dom";
import { Smartphone, QrCode, ScanLine, ShieldCheck, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Zap, title: "No more queues", desc: "Join a digital pickup queue from your seat. Get notified when it's your turn." },
  { icon: ShieldCheck, title: "Secure handover", desc: "Token + QR verification prevents double collection or misplaced devices." },
  { icon: Users, title: "Smart batching", desc: "Admin calls users in groups of 5, eliminating crowd congestion at the counter." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-gradient shadow-glow">
              <Smartphone className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">SyncPhone</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/admin/login">Admin</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero text-primary-foreground">
        <div className="container py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Crowd-controlled device management
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Submit. Sit back. <span className="text-accent">Get called.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base md:text-lg text-primary-foreground/75">
              Replace chaotic device drop-off counters with a digital queue. Token-based check-in,
              real-time pickup notifications, and verified handover — all in one place.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild variant="hero" size="lg" className="w-full sm:w-auto">
                <Link to="/checkin"><QrCode className="mr-1" /> Self check-in</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/status"><ScanLine className="mr-1" /> Check status</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16 md:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-card transition-smooth hover:shadow-elegant">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        SyncPhone · High-trust device management
      </footer>
    </div>
  );
};

export default Index;
