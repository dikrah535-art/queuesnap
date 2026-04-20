import { Link } from "react-router-dom";
import { QrCode, ScanLine, ShieldCheck, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Zap, title: "No more queues", desc: "Join a digital pickup queue from your seat. Get notified when it's your turn." },
  { icon: ShieldCheck, title: "Secure handover", desc: "Token + QR verification prevents double collection or misplaced devices." },
  { icon: Users, title: "Smart batching", desc: "Admins call users in groups, eliminating crowd congestion at the counter." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSafe</Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/status">Status</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/admin/login">Admin</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero">
        <div className="container py-24 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground">
              Submit. Sit back.
              <br />
              <span className="text-primary">Get called.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg md:text-xl text-muted-foreground">
              A smarter way to drop off your device. Token-based check-in with real-time pickup notifications.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild variant="hero" size="lg" className="w-full sm:w-auto min-w-[200px]">
                <Link to="/checkin"><QrCode className="mr-1" /> Start check-in</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto text-primary hover:bg-primary/5">
                <Link to="/status"><ScanLine className="mr-1" /> Check status</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Designed for calm.</h2>
          <p className="mt-3 text-muted-foreground">Three simple ideas. Zero counter chaos.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-smooth hover:shadow-elegant">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        QueueSafe · Smart Device Submission System
      </footer>
    </div>
  );
};

export default Index;
