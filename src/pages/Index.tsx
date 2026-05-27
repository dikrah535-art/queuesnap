import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Clock, GraduationCap, Lightbulb, QrCode, ScanLine, ShieldCheck, Sparkles, Zap, Users, LogIn, QrCode as QrIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HowItWorks } from "@/components/HowItWorks";
import { Reveal } from "@/components/Reveal";
import { Typewriter } from "@/components/Typewriter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEMO_LOBBY_ID,
  DEMO_LOBBY_PATH,
  DEMO_LOBBY_PUBLIC_URL,
  fetchDemoLobbyWaitingCount,
} from "@/lib/demoLobby";
import { Share2 } from "lucide-react";
import { resolveLobbyKey } from "@/lib/workspaces";

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
  const navigate = useNavigate();
  const [demoCount, setDemoCount] = useState<number>(0);
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [lobbyInput, setLobbyInput] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const n = await fetchDemoLobbyWaitingCount();
      if (!cancelled) setDemoCount(n);
    };
    load();
    const ch = supabase
      .channel(`demo-counter-${DEMO_LOBBY_ID}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${DEMO_LOBBY_ID}` }, () => load())
      .subscribe();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  const handleJoinByLink = async () => {
    if (!lobbyInput.trim()) return;
    setJoining(true);
    try {
      // Extract lobby ID from URL or use directly
      const input = lobbyInput.trim();
      const match = input.match(/\/join\/([a-f0-9-]{36})/);
      const key = match ? match[1] : input;
      const id = await resolveLobbyKey(key);
      if (!id) { toast.error("Lobby not found — check the link or ID"); return; }
      navigate(`/join/${id}`);
    } catch {
      toast.error("Invalid lobby link");
    } finally {
      setJoining(false);
    }
  };

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

            <div className="mt-10 flex flex-col items-center justify-center gap-3">

              {/* Get Started Button */}
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-w-[240px] border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setShowGetStarted(!showGetStarted)}
              >
                {showGetStarted ? <X className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {showGetStarted ? "Close" : "Get Started"}
              </Button>

              {/* Get Started Panel */}
              {showGetStarted && (
                <Card className="w-full max-w-md p-6 animate-scale-in text-left">
                  <h3 className="font-semibold text-base mb-4 text-center">What would you like to do?</h3>
                  <div className="grid gap-3">
                    {/* Admin option */}
                    <Button
                      asChild
                      variant="hero"
                      size="lg"
                      className="w-full justify-start"
                    >
                      <Link to="/admin/login?next=/workspaces">
                        <LogIn className="mr-3 h-5 w-5" />
                        <div className="text-left">
                          <p className="font-semibold">I'm an Admin</p>
                          <p className="text-xs opacity-80">Create and manage queues</p>
                        </div>
                      </Link>
                    </Button>

                    {/* Join by link */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ScanLine className="h-4 w-4 text-primary" />
                        Join a queue by link
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste lobby link or ID..."
                          value={lobbyInput}
                          onChange={(e) => setLobbyInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleJoinByLink()}
                          className="flex-1"
                        />
                        <Button onClick={handleJoinByLink} disabled={!lobbyInput.trim() || joining}>
                          {joining ? "..." : "Join"}
                        </Button>
                      </div>
                    </div>

                    {/* Try demo */}
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="w-full justify-start"
                    >
                      <Link to={DEMO_LOBBY_PATH}>
                        <QrIcon className="mr-3 h-5 w-5 text-primary" />
                        <div className="text-left">
                          <p className="font-semibold">Try the live demo</p>
                          <p className="text-xs text-muted-foreground">No signup needed</p>
                        </div>
                      </Link>
                    </Button>
                  </div>
                </Card>
              )}

              {/* Try Live Demo */}
              <Button asChild variant="hero" size="lg" className="w-full sm:w-auto min-w-[240px]">
                <Link to={DEMO_LOBBY_PATH}>Try Live Demo <ArrowRight /></Link>
              </Button>
              <p className="text-xs text-muted-foreground">No signup needed • See it live</p>

              {/* Live queue count */}
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                {demoCount === 0 ? (
                  <span>Queue is empty — be the first!</span>
                ) : (
                  <span><span className="font-semibold tabular-nums">{demoCount}</span> people in queue right now</span>
                )}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(DEMO_LOBBY_PUBLIC_URL);
                      toast.success("Link copied! Share it with anyone 🎉");
                    } catch {
                      toast.error("Couldn't copy link");
                    }
                  }}
                >
                  <Share2 className="mr-1" /> Share Demo Link
                </Button>
                <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto text-primary hover:bg-primary/5">
                  <Link to="/status"><ScanLine className="mr-1" /> Check status</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <div className="animate-fade-in">
        <HowItWorks />
      </div>

      {/* Try It Live */}
      <section className="container py-16 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-10 md:p-14 shadow-elegant">
          <span className="inline-block text-xs font-medium uppercase tracking-wider text-primary">See It In Action</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Try the live demo</h2>
          <p className="mt-3 text-muted-foreground">
            Join our live demo queue and experience QueueSnap as a real user would.
          </p>
          <div className="mt-7">
            <Button asChild variant="hero" size="lg" className="min-w-[240px]">
              <Link to={DEMO_LOBBY_PATH}>Join Demo Queue <ArrowRight /></Link>
            </Button>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-medium tabular-nums">{demoCount}</span>
            <span className="text-primary/80">people in demo queue right now</span>
          </div>
        </Reveal>
      </section>

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

      {/* Use cases */}
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
            <Link to={DEMO_LOBBY_PATH}>Get Started <ArrowRight /></Link>
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
