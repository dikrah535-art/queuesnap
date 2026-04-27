import { Link } from "react-router-dom";
import { ArrowRight, Building2, Clock, GraduationCap, Lightbulb, QrCode, ScanLine, ShieldCheck, Sparkles, Target, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowDemo } from "@/components/FlowDemo";
import { Typewriter } from "@/components/Typewriter";
import { Reveal } from "@/components/Reveal";

const features = [
  { icon: Zap, title: "No more queues", desc: "Join a digital pickup queue from your seat. Get notified when it's your turn." },
  { icon: ShieldCheck, title: "Secure handover", desc: "Token + QR verification prevents double collection or misplaced devices." },
  { icon: Users, title: "Smart batching", desc: "Admins call users in groups, eliminating crowd congestion at the counter." },
];

const useCases = [
  { icon: GraduationCap, label: "Colleges" },
  { icon: Sparkles, label: "Exams" },
  { icon: Building2, label: "Offices" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/status">Status</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/admin/login">Admin</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero">
        <div className="container py-24 md:py-36">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Smart Device Submission System
            </div>
            <h1 className="mt-6 text-6xl md:text-8xl font-semibold tracking-tight text-foreground">
              QueueSnap
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg md:text-xl text-muted-foreground leading-relaxed min-h-[3.5rem]">
              <Typewriter
                words={[
                  "Skip the line. Save your time.",
                  "Join queues digitally.",
                  "Real-time queue tracking.",
                ]}
              />
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild variant="hero" size="lg" className="w-full sm:w-auto min-w-[200px]">
                <Link to="/checkin">Get Started <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
                <Link to="/admin-demo"><ShieldCheck className="mr-1" /> Try Admin Demo</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto text-primary hover:bg-primary/5">
                <Link to="/status"><ScanLine className="mr-1" /> Check status</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Visual flow + queue simulation */}
      <div className="animate-fade-in">
        <FlowDemo />
      </div>

      {/* Trust / Use case */}
      <section className="container pb-8 md:pb-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-card p-8 md:p-12 text-center shadow-card animate-fade-in">
          <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Built for colleges, exams, and offices
          </h3>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Ensures secure and organized device collection in high-traffic environments.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {useCases.map((u) => (
              <div key={u.label} className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground">
                <u.icon className="h-4 w-4 text-primary" />
                {u.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center mb-14 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Designed for calm.</h2>
          <p className="mt-3 text-muted-foreground">Three simple ideas. Zero counter chaos.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-smooth hover:shadow-elegant animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <Button asChild variant="hero" size="lg" className="min-w-[220px]">
            <Link to="/checkin">Get Started <ArrowRight /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        QueueSnap · Smart Device Submission System
      </footer>
    </div>
  );
};

export default Index;
