import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Check, Loader2, LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRingTone } from "@/lib/useRingTone";
import {
  cancelEntry, fetchLobby, fetchQueueEntries, forgetAnonEntry, getAnonEntryFor,
  joinLobby, rememberAnonEntry,
  type Lobby, type QueueEntry,
} from "@/lib/workspaces";

const JoinLobby = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [joining, setJoining] = useState(false);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const { ringing, start: startRing, stop: stopRing } = useRingTone();

  const reload = async () => {
    if (!lobbyId) return;
    try {
      const [l, es] = await Promise.all([fetchLobby(lobbyId), fetchQueueEntries(lobbyId)]);
      setLobby(l); setEntries(es);

      // Find my entry
      const { data: { user } } = await supabase.auth.getUser();
      let mine: QueueEntry | null = null;
      if (user) {
        mine = es.find((e) => e.user_id === user.id) ?? null;
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
  useEffect(() => { reload(); }, [lobbyId]);

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
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) rememberAnonEntry({ lobbyId, entryId: entry.id, name: entry.name });
      setMyEntry(entry);
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

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!lobby) return <div className="grid min-h-screen place-items-center text-muted-foreground">Lobby not found</div>;

  const total = entries.length;
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
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
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
            <div className="mt-6 rounded-xl border border-border bg-card p-5 text-center">
              {myEntry.status === "serving" ? (
                <>
                  <Bell className="mx-auto h-10 w-10 text-primary animate-pulse" />
                  <p className="mt-3 text-lg font-semibold">It's your turn!</p>
                  <p className="text-sm text-muted-foreground">Please proceed to the counter.</p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Your position</p>
                  <p className="mt-2 text-5xl font-semibold tabular-nums">{position}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Token #{myEntry.position}</p>
                  <p className="mt-3 text-sm">{position <= 1 ? "You're next!" : `${position - 1} ahead of you`}</p>
                </>
              )}
              <p className="mt-4 text-sm">Joined as <span className="font-medium">{myEntry.name}</span></p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onLeave}>
                <X className="mr-1 h-4 w-4" /> Leave queue
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name <span className="text-destructive">*</span></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                  placeholder="Enter your name" disabled={closed || full} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32}
                  placeholder="e.g. +91 98765 43210" disabled={closed || full} autoComplete="tel" />
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
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default JoinLobby;
