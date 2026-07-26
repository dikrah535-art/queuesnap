import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Check, Clock, Loader2, LogIn, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallPWA } from "@/components/InstallPWA";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRingTone } from "@/lib/useRingTone";
import { getJoinUrl } from "@/lib/urls";
import {
  cancelEntry, confirmPresence, fetchEstimatedWaitSeconds, fetchLobby, fetchQueueEntries, forgetAnonEntry, getAnonEntryFor,
  joinLobby, recordDemoVisitor, rememberAnonEntry, resolveLobbyKey,
  type Lobby, type QueueEntry,
} from "@/lib/workspaces";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceRatingCard } from "@/components/ServiceRatingCard";

const JoinLobby = () => {
  const navigate = useNavigate();
  const { lobbyId: lobbyKey } = useParams<{ lobbyId: string }>();
  const [searchParams] = useSearchParams();
  const tokenIdParam = searchParams.get("token");
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [serviceType, setServiceType] = useState<string>("");
  const [rollNumber, setRollNumber] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const [joining, setJoining] = useState(false);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [avgServiceSec, setAvgServiceSec] = useState<number>(180);
  const prevStatusRef = useRef<string | null>(null);
  const { ringing, start: startRing, stop: stopRing } = useRingTone();
  const isDemo = lobbyKey === "demo" || lobby?.slug === "demo";

  // Ask for browser notification permission once on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fire a browser notification when *my* entry transitions to "serving"
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = myEntry?.status ?? null;
    if (prev !== "serving" && curr === "serving") {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("🔔 It's your turn!", {
            body: "Your token is now being called. Please proceed to the counter.",
            icon: "/favicon.ico",
          });
        }
      } catch { /* ignore */ }
    }
    prevStatusRef.current = curr;
  }, [myEntry?.status]);

  // Check-in confirmation nudge: prompt every 10 min if not served yet
  useEffect(() => {
    if (!myEntry || (myEntry.status !== "waiting" && myEntry.status !== "serving")) {
      setNeedsConfirm(false);
      return;
    }
    const NUDGE_MS = 10 * 60 * 1000; // 10 minutes
    const check = () => {
      const last = new Date(myEntry.last_confirmed_at ?? myEntry.created_at).getTime();
      if (Date.now() - last > NUDGE_MS) setNeedsConfirm(true);
    };
    check();
    const t = setInterval(check, 30 * 1000);
    return () => clearInterval(t);
  }, [myEntry?.id, myEntry?.last_confirmed_at, myEntry?.status]);

  const onConfirmPresence = async () => {
    if (!myEntry) return;
    try {
      const updated = await confirmPresence(myEntry.id);
      setMyEntry(updated);
      setNeedsConfirm(false);
      toast.success("Presence confirmed — you're still in the queue");
    } catch (e: any) { toast.error(e.message ?? "Failed to confirm"); }
  };

  const reload = async () => {
    if (!lobbyId) return;
    try {
      const [l, es] = await Promise.all([fetchLobby(lobbyId), fetchQueueEntries(lobbyId, { includeAll: true })]);
      setLobby(l); setEntries(es);

      // Find my entry — prefer ?token=X (from email link)
      let mine: QueueEntry | null = null;
      if (tokenIdParam) {
        mine = es.find((e) => e.id === tokenIdParam) ?? null;
      }
      if (!mine) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) mine = es.find((e) => e.user_id === user.id) ?? null;
      }
      if (!mine) {
        const ref = getAnonEntryFor(lobbyId);
        if (ref) {
          mine = es.find((e) => e.id === ref.entryId) ?? null;
          if (!mine) forgetAnonEntry(lobbyId);
        }
      }
      setMyEntry(mine);
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };
  // Resolve slug like "demo" → real lobby UUID
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lobbyKey) { setLoading(false); return; }
      const id = await resolveLobbyKey(lobbyKey);
      if (cancelled) return;
      if (!id) { setLoading(false); toast.error("Lobby not found"); return; }
      setLobbyId(id);
    })();
    return () => { cancelled = true; };
  }, [lobbyKey]);

  useEffect(() => { reload(); }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchEstimatedWaitSeconds(lobbyId).then(setAvgServiceSec).catch(() => {});
  }, [lobbyId, entries.length]);

  useEffect(() => {
    if (!lobbyId) return;
    const ch = supabase
      .channel(`join-${lobbyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${lobbyId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // Listen for targeted "ring" broadcasts from the lobby admin.
  // We only react when the broadcast's entryId matches *our* entry — so
  // other participants never hear someone else's ring.
  useEffect(() => {
    if (!lobbyId || !myEntry?.id) return;
    const myId = myEntry.id;
    const ch = supabase.channel(`ring-${lobbyId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "ring" }, ({ payload }) => {
      if (payload?.entryId === myId) {
        startRing();
        toast.success("You are being called — please proceed!");
      }
    });
    ch.on("broadcast", { event: "stop" }, ({ payload }) => {
      if (payload?.entryId === myId) stopRing();
    });
    ch.subscribe();
    return () => {
      stopRing();
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId, myEntry?.id]);

  // Persistent ringing state (DB): sync sound to myEntry.ringing so page refreshes
  // during a call still play the tone, and admin's Stop ring silences it everywhere.
  useEffect(() => {
    if (myEntry?.ringing && !ringing) startRing();
    if (!myEntry?.ringing && ringing) stopRing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEntry?.ringing]);

  const position = useMemo(() => {
    if (!myEntry) return 0;
    if (myEntry.status === "serving") return 0;
    return entries.filter((e) => e.status === "waiting" && e.position <= myEntry.position).length;
  }, [entries, myEntry]);

  const onJoin = async () => {
    if (!lobbyId || !name.trim()) return;
    if (phone && (phone.trim().length < 4 || phone.trim().length > 32)) {
      toast.error("Enter a valid phone number"); return;
    }
    setJoining(true);
    try {
      const entry = await joinLobby(lobbyId, name, {
        phone: phone.trim() || undefined,
        deviceType: deviceType.trim() || undefined,
        serviceType: serviceType || undefined,
        rollNumber: rollNumber.trim() || undefined,
        deviceModel: deviceModel.trim() || undefined,
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) rememberAnonEntry({ lobbyId, entryId: entry.id, name: entry.name });
      setMyEntry(entry);

      if (isDemo) {
        await recordDemoVisitor({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          queueEntryId: entry.id,
        });
      }
      toast.success("Successfully added to queue");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to join";
      if (msg.includes("full")) toast.error("Queue Full");
      else if (msg.includes("closed")) toast.error("Lobby is closed");
      else if (msg.includes("Already")) toast.error("This phone is already in the queue");
      else toast.error(msg);
    } finally { setJoining(false); }
  };

  const onLeave = async () => {
    if (!myEntry || !lobbyId) return;
    try {
      await cancelEntry(myEntry.id);
      forgetAnonEntry(lobbyId);
      setMyEntry(null);
      toast.success("Left the queue");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  if (loading) return (
    <div className="container max-w-md py-12 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
  if (!lobby) return <div className="grid min-h-screen place-items-center text-muted-foreground">Lobby not found</div>;

  const etaSec = position > 0 ? Math.max(60, avgServiceSec) * position : 0;
  const eta = Math.round(etaSec / 60);
  const shareMyPosition = () => {
    const text = `I'm #${position} in queue at ${lobby.name} — join here: ${getJoinUrl(lobby.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  const shareJoinLink = () => {
    const text = `Join the queue at ${lobby.name}: ${getJoinUrl(lobby.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const total = entries.filter((e) => e.status === "waiting" || e.status === "serving").length;
  const full = total >= lobby.max_capacity;
  const closed = lobby.status !== "open";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/checkin"))}
            aria-label="Back"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <InstallPWA />
            <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
          </div>
        </div>
      </header>

      <main className="container max-w-md py-12">
        <Card className="p-6 animate-scale-in">
          <Badge variant={closed ? "secondary" : "default"} className="mb-3">{closed ? "Closed" : "Open"}</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">{lobby.name}</h1>
          {lobby.description && <p className="mt-2 text-sm text-muted-foreground">{lobby.description}</p>}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} in queue</span>
            <span>Capacity {lobby.max_capacity}</span>
          </div>

          {myEntry ? (
            <div className={`mt-6 rounded-xl border p-5 text-center transition-colors ${ringing ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              {ringing && (
                <div className="mb-4 rounded-lg bg-primary/10 p-3">
                  <Bell className="mx-auto h-8 w-8 text-primary animate-bounce" />
                  <p className="mt-2 font-semibold text-primary">📞 You are being called!</p>
                  <p className="text-xs text-muted-foreground">Please proceed to the counter.</p>
                  <Button variant="destructive" size="sm" className="mt-3" onClick={stopRing}>
                    <BellOff className="mr-1 h-4 w-4" /> Stop ring
                  </Button>
                </div>
              )}
              {myEntry.status === "serving" ? (
                <>
                  <Bell className="mx-auto h-10 w-10 text-primary animate-pulse" />
                  <p className="mt-3 text-lg font-semibold">It's your turn!</p>
                  <p className="text-sm text-muted-foreground">Please proceed to the counter.</p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Your position</p>
                  <p className="mt-2 text-6xl font-bold tabular-nums animate-scale-in">{position}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Token #{myEntry.position}</p>
                  <p className="mt-3 text-sm">{position <= 1 ? "You're next!" : `${position - 1} ahead of you`}</p>
                  {eta > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Estimated wait: ~{eta} min
                    </p>
                  )}
                </>
              )}
              <p className="mt-4 text-sm">Joined as <span className="font-medium">{myEntry.name}</span></p>
              {myEntry.service_type && (
                <p className="mt-1 text-xs text-muted-foreground">Service: {myEntry.service_type}</p>
              )}
              {needsConfirm && myEntry.status === "waiting" && (
                <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left">
                  <p className="text-sm font-medium">Are you still here?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tap below to keep your spot. Unconfirmed visitors may be marked as no-show.
                  </p>
                  <Button size="sm" className="mt-2 w-full" onClick={onConfirmPresence}>
                    <Check className="mr-1 h-4 w-4" /> Confirm presence
                  </Button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={shareMyPosition}>
                  <Share2 className="mr-1 h-4 w-4" /> Share position
                </Button>
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={onLeave}>
                  <X className="mr-1 h-4 w-4" /> Leave queue
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name <span className="text-destructive">*</span></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                  placeholder="Enter your name" disabled={closed || full} />
              </div>
              {isDemo && (
                <div className="space-y-2">
                  <Label htmlFor="email">Get notified when it's your turn <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120}
                    placeholder="you@example.com" disabled={closed || full} autoComplete="email" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32}
                  placeholder="e.g. +91 98765 43210" disabled={closed || full} autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service">Service type</Label>
                <Select value={serviceType} onValueChange={setServiceType} disabled={closed || full}>
                  <SelectTrigger id="service"><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device">Device type <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="device" value={deviceType} onChange={(e) => setDeviceType(e.target.value)} maxLength={80}
                  placeholder="e.g. iPhone 14, Laptop" disabled={closed || full} />
              </div>
              <Button variant="hero" className="w-full" onClick={onJoin} disabled={!name.trim() || joining || closed || full}>
                {joining ? <Loader2 className="animate-spin" /> : full ? "Queue Full" : closed ? "Lobby closed" : <><LogIn className="mr-1" /> Join queue</>}
              </Button>
              <p className="text-center text-xs text-muted-foreground">No account needed. We'll save your spot in this browser.</p>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={shareJoinLink}>
                <Share2 className="mr-1 h-4 w-4" /> Share this queue
              </Button>
            </div>
          )}
        </Card>

        {myEntry && (myEntry.status === "served" || myEntry.status === "collected") && lobby.workspace_id && (
          <ServiceRatingCard
            entryId={myEntry.id}
            lobbyId={lobby.id}
            workspaceId={lobby.workspace_id}
            queueName={lobby.name}
          />
        )}
      </main>
    </div>
  );
};

export default JoinLobby;
