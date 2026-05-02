import { Link } from "react-router-dom";
import { ArrowRight, Building2, Clock, GraduationCap, Lightbulb, QrCode, ScanLine, ShieldCheck, Sparkles, Target, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowDemo } from "@/components/FlowDemo";
import { Reveal } from "@/components/Reveal";
import { Typewriter } from "@/components/Typewriter";

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
            <Button asChild variant="ghost" size="sm"><Link to="/workspaces">Workspaces</Link></Button>
            <Button asChild variant="default" size="sm"><Link to="/admin/login?next=/workspaces">Admin</Link></Button>
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

            {/* Big brand title */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary md:h-14 md:w-14">
                <QrCode className="h-7 w-7 md:h-8 md:w-8" />
              </span>
              <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground">
                QueueSnap
              </h1>
            </div>

            <h2 className="mt-5 text-2xl md:text-4xl font-semibold tracking-tight text-foreground">
              Smart Device Submission &amp;{" "}
              <Typewriter
                className="text-primary"
                words={["Queue Management", "Token Generation", "QR Verification", "Crowd Control"]}
              />
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Eliminate crowd congestion during device collection using tokens, QR codes, and digital queues.
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
      {/* Problem & Vision */}
      <section className="container py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center mb-14">
          <span className="inline-block text-xs font-medium uppercase tracking-wider text-primary">Why QueueSnap</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">The problem we're solving.</h2>
          <p className="mt-3 text-muted-foreground">Waiting in line is a tax on your day. We think it's time to remove it.</p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          <Reveal>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-smooth hover:shadow-elegant">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">The problem</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                People lose hours every week standing in queues at shops, clinics, and service counters. There's no visibility into wait times, no way to plan ahead, and no efficient system to manage the crowd.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-smooth hover:shadow-elegant">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">Our vision</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                QueueSnap removes physical waiting altogether. Join a queue digitally, track your position in real time, and arrive exactly when it's your turn — so your time stays yours.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust / Use case */}
      <section className="container pb-8 md:pb-12">
        <Reveal className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-card p-8 md:p-12 text-center shadow-card">
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
        </Reveal>
      </section>

      {/* Features */}
      <section className="container py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Designed for calm.</h2>
          <p className="mt-3 text-muted-foreground">Three simple ideas. Zero counter chaos.</p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-smooth hover:shadow-elegant hover:-translate-y-0.5">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
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
