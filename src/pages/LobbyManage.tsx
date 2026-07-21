import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Copy, Crown, Loader2, Mail, MessageCircle, Monitor, Phone, PlayCircle, Power, RotateCcw, SkipForward, Smartphone, Sparkles, Trash2, TrendingUp, Undo2, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { QrCard } from "@/components/workspace/QrCard";
import { InstallPWA } from "@/components/InstallPWA";
import { getJoinUrl, getTokenUrl } from "@/lib/urls";
import {
  adminAddEntry, cancelEntry, clearQueue, deleteLobby, fetchLobby, fetchLobbyEntriesAdmin,
  markCollected, markNoShow, markNotified, reinstateEntry, sendTokenEmail, serveNext,
  setRinging, simulateEntries, skipEntry, updateLobby,
  type Lobby, type QueueEntry,
} from "@/lib/workspaces";
import { SERVICE_TYPES } from "@/lib/serviceTypes";

const sendWhatsAppToken = (phone: string, name: string, position: number, queueName: string, tokenUrl: string) => {
  const msg = `Hi ${name} 👋\n\nYou've been added to *${queueName}*!\n\n🎫 *Your Token: #${position}*\n\nTrack your position in real time:\n${tokenUrl}\n\n_Powered by QueueSnap_`;
  window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
};

const sendWhatsAppCall = (phone: string, name: string, queueName: string) => {
  const msg = `Hi ${name} 👋\n\nIt's your turn at *${queueName}*! 🔔\n\nPlease proceed to the counter now.\n\n_Powered by QueueSnap_`;
  window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
};

const LobbyManage = () => {
  const { wsId, lobbyId } = useParams<{ wsId: string; lobbyId: string }>();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; served: number; avgMs: number | null }>({ total: 0, served: 0, avgMs: null });
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addVip, setAddVip] = useState(false);
  const [addServiceType, setAddServiceType] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [shareModal, setShareModal] = useState<{ entry: QueueEntry; url: string } | null>(null);
  const [search, setSearch] = useState("");
  const [ringingEntryId, setRingingEntryId] = useState<string | null>(null);
  const ringChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const sendRingEvent = (entryId: string, action: "ring" | "stop") => {
    const ch = ringChannelRef.current;
    if (!ch) { toast.error("Not connected — try again in a moment"); return; }
    ch.send({ type: "broadcast", event: action, payload: { entryId } });
  };

  const onRing = (entryId: string, name: string) => {
    setRingingEntryId(entryId);
    sendRingEvent(entryId, "ring");
    toast.success(`Ringing ${name}'s device…`);
  };

  const onStopRing = () => {
    if (ringingEntryId) sendRingEvent(ringingEntryId, "stop");
    setRingingEntryId(null);
    toast.success("Ring stopped");
  };

  const reload = async () => {
    if (!lobbyId) return;
    try {
      const [l, es, allEs] = await Promise.all([
        fetchLobby(lobbyId),
        fetchLobbyEntriesAdmin(lobbyId, { includeAll: false }),
        fetchLobbyEntriesAdmin(lobbyId, { includeAll: true }),
      ]);
      setLobby(l); setEntries(es);
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const todays = allEs.filter((e) => new Date(e.created_at) >= startOfDay);
      const served = todays.filter((e) => e.served_at && (e.status === "served" || e.status === "collected"));
      const durations = served
        .map((e) => new Date(e.served_at!).getTime() - new Date(e.created_at).getTime())
        .filter((d) => d > 0 && d < 1000 * 60 * 60 * 12);
      const avgMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
      setTodayStats({ total: todays.length, served: served.length, avgMs });
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    const ch = supabase
      .channel(`lobby-${lobbyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${lobbyId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lobbyId]);

  const serving = useMemo(() => entries.find((e) => e.status === "serving"), [entries]);
  const waiting = useMemo(() => entries.filter((e) => e.status === "waiting"), [entries]);

  useEffect(() => {
    if (!lobbyId) return;
    const ch = supabase.channel(`ring-${lobbyId}`, { config: { broadcast: { self: false } } });
    ch.subscribe();
    ringChannelRef.current = ch;
    return () => { ringChannelRef.current = null; supabase.removeChannel(ch); };
  }, [lobbyId]);

  useEffect(() => {
    if (!ringingEntryId) return;
    const stillActive = entries.some(
      (e) => e.id === ringingEntryId && (e.status === "serving" || e.status === "waiting"),
    );
    if (!stillActive) {
      sendRingEvent(ringingEntryId, "stop");
      setRingingEntryId(null);
    }
  }, [entries, ringingEntryId]);

  const toggleStatus = async () => {
    if (!lobby) return;
    try {
      const next = lobby.status === "open" ? "closed" : "open";
      const updated = await updateLobby(lobby.id, { status: next });
      setLobby(updated); toast.success(`Lobby ${next}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onServeNext = async () => {
    if (!lobbyId || !lobby) return;
    try {
      const next = await serveNext(lobbyId);
      toast.success("Next person called");
      if (next) {
        const tokenUrl = getTokenUrl(lobbyId, next.id);
        if (next.email) {
          try {
            await sendTokenEmail({
              email: next.email,
              name: next.name,
              tokenNumber: next.position,
              queueName: lobby.name,
              tokenUrl,
              type: "turn",
            });
            toast.success(`🔔 Notified ${next.name} by email`);
          } catch (e: any) {
            toast.error(`Email failed: ${e.message ?? "unknown"}`);
          }
        }
        if (next.phone) {
          sendWhatsAppCall(next.phone, next.name, lobby.name);
        }
      }
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onClear = async () => {
    if (!lobbyId) return;
    if (!confirm("Cancel everyone in the queue?")) return;
    try { const n = await clearQueue(lobbyId); toast.success(`Cleared ${n} entries`); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onAdd = async () => {
    if (!lobbyId || !addName.trim() || !lobby) return;
    if (addEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addEmail.trim())) {
      toast.error("Enter a valid email"); return;
    }
    setAdding(true);
    try {
      const entry = await adminAddEntry({
        lobbyId,
        name: addName,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        isVip: addVip,
        serviceType: addServiceType || undefined,
      });
      const tokenUrl = getTokenUrl(lobbyId, entry.id);
      toast.success(`Token #${entry.position} assigned to ${entry.name}`);

      if (addEmail.trim()) {
        try {
          await sendTokenEmail({
            email: addEmail.trim(),
            name: entry.name,
            tokenNumber: entry.position,
            queueName: lobby.name,
            tokenUrl,
          });
          await markNotified(entry.id);
          toast.success(`Email sent to ${addEmail.trim()}`);
        } catch (e: any) {
          toast.error(`Email failed: ${e.message ?? "unknown"}`);
        }
      }

      if (!addEmail.trim()) {
        setShareModal({ entry, url: tokenUrl });
      }

      if (addPhone.trim() && !addEmail.trim()) {
        sendWhatsAppToken(addPhone.trim(), entry.name, entry.position, lobby.name, tokenUrl);
      }

      setAddName(""); setAddEmail(""); setAddPhone(""); setAddVip(false); setAddServiceType("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add");
    } finally { setAdding(false); }
  };

  const onRemove = async (id: string) => {
    if (!confirm("Remove this person from the queue?")) return;
    try { await cancelEntry(id); toast.success("Removed from queue"); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onCollected = async (id: string) => {
    try { await markCollected(id); toast.success("Marked as collected ✅"); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onNoShow = async (id: string, name: string) => {
    if (!confirm(`Mark ${name} as no-show? They will be removed from the queue.`)) return;
    try { await markNoShow(id); toast.success(`${name} marked as no-show`); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const onDeleteLobby = async () => {
    if (!lobby) return;
    if (!confirm(`Delete lobby "${lobby.name}"? This cannot be undone.`)) return;
    try { await deleteLobby(lobby.id); toast.success("Lobby deleted"); window.history.back(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const copyLink = async () => {
    if (!lobbyId) return;
    const url = getJoinUrl(lobbyId);
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!lobby) return <div className="grid min-h-screen place-items-center text-muted-foreground">Lobby not found</div>;

  const total = entries.length;
  const pct = Math.min(100, Math.round((total / lobby.max_capacity) * 100));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to={`/workspaces/${wsId}`}><ArrowLeft /></Link></Button>
            <div>
              <h1 className="font-semibold leading-tight">{lobby.name}</h1>
              <p className="text-xs text-muted-foreground">Lobby management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallPWA />
            <Button asChild variant="outline" size="sm">
              <Link to={`/display/${lobbyId}`} target="_blank">
                <Monitor className="mr-1 h-4 w-4" /> Display
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/workspaces/${wsId}/lobbies/${lobbyId}/analytics`}>
                <TrendingUp className="mr-1 h-4 w-4" /> Analytics
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="mr-1 h-4 w-4" /> Share link</Button>
            <Button variant={lobby.status === "open" ? "outline" : "default"} size="sm" onClick={toggleStatus}>
              <Power className="mr-1 h-4 w-4" /> {lobby.status === "open" ? "Close" : "Open"}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDeleteLobby}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total today</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{todayStats.total}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Currently waiting</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{total}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Served today</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{todayStats.served}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg service time</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {todayStats.avgMs != null ? `${Math.round(todayStats.avgMs / 60000)}m` : "—"}
            </p>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Add person manually</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Name <span className="text-destructive">*</span></Label>
              <Input id="add-name" placeholder="Full name" value={addName} onChange={(e) => setAddName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email <span className="text-muted-foreground text-xs">(optional — sends token)</span></Label>
              <Input id="add-email" type="email" placeholder="person@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone">Phone <span className="text-muted-foreground text-xs">(optional — enables WhatsApp)</span></Label>
              <Input id="add-phone" type="tel" placeholder="+91 98765 43210" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} maxLength={32} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-service">Service type</Label>
              <Select value={addServiceType} onValueChange={setAddServiceType}>
                <SelectTrigger id="add-service"><SelectValue placeholder="Select a service (optional)" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Crown className={`h-4 w-4 ${addVip ? "text-amber-500" : "text-muted-foreground"}`} />
                <Label htmlFor="add-vip" className="cursor-pointer text-sm">VIP priority</Label>
                <Switch id="add-vip" checked={addVip} onCheckedChange={setAddVip} />
              </div>
              <Button onClick={onAdd} disabled={!addName.trim() || adding} className="ml-auto">
                {adding ? <Loader2 className="animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="hero" onClick={onServeNext} disabled={waiting.length === 0 && !serving}>
              <PlayCircle className="mr-1" /> Serve next
            </Button>
            <Button variant="outline" onClick={onClear} disabled={total === 0}>Clear queue</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Share / QR code</h3>
          <QrCard
            url={getJoinUrl(lobby.id)}
            filename={`queuesnap-${lobby.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Queue</h3>
            <Input
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <Tabs value={serviceFilter} onValueChange={setServiceFilter} className="mb-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
              {SERVICE_TYPES.map((s) => {
                const n = entries.filter((e) => e.service_type === s).length;
                return <TabsTrigger key={s} value={s}>{s} ({n})</TabsTrigger>;
              })}
              <TabsTrigger value="__none">Unspecified ({entries.filter((e) => !e.service_type).length})</TabsTrigger>
            </TabsList>
          </Tabs>
          {(() => {
            const q = search.trim().toLowerCase();
            const byService = serviceFilter === "all"
              ? entries
              : serviceFilter === "__none"
                ? entries.filter((e) => !e.service_type)
                : entries.filter((e) => e.service_type === serviceFilter);
            const filtered = q
              ? byService.filter((e) =>
                  e.name.toLowerCase().includes(q) || (e.phone ?? "").toLowerCase().includes(q),
                )
              : byService;
            if (entries.length === 0) {
              return <p className="py-12 text-center text-sm text-muted-foreground">No one in queue yet — share the QR code! 📱</p>;
            }
            if (filtered.length === 0) {
              return <p className="py-12 text-center text-sm text-muted-foreground">No matches.</p>;
            }
            if (entries.length === 0) {
              return <p className="py-12 text-center text-sm text-muted-foreground">No one in queue yet — share the QR code! 📱</p>;
            }
            if (filtered.length === 0) {
              return <p className="py-12 text-center text-sm text-muted-foreground">No matches.</p>;
            }
            return (
              <ul className="divide-y divide-border">
                {filtered.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-3 animate-fade-in gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${e.status === "serving" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {e.position}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium leading-tight truncate flex items-center gap-1.5">
                          {e.name}
                          {e.is_vip && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600" title="VIP">
                              <Crown className="h-3 w-3" /> VIP
                            </span>
                          )}
                          {e.notified_email && (
                            <Mail className="h-3 w-3 text-primary" aria-label="Notified by email" />
                          )}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {e.status === "serving" ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Bell className={`h-3 w-3 ${ringingEntryId === e.id ? "animate-pulse" : ""}`} />
                              {ringingEntryId === e.id ? "Ringing…" : "Now serving"}
                            </span>
                          ) : (
                            <span>Waiting</span>
                          )}
                          {e.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {e.phone}</span>}
                          {e.device_type && <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" /> {e.device_type}</span>}
                          {e.service_type && <span className="inline-flex items-center rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-medium">{e.service_type}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {e.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => sendWhatsAppCall(e.phone!, e.name, lobby.name)}
                          title="Notify via WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </Button>
                      )}
                      {ringingEntryId === e.id ? (
                        <Button variant="destructive" size="sm" onClick={onStopRing} title="Stop ringing">
                          <BellOff className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Stop ring</span>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => onRing(e.id, e.name)} title="Ring this person">
                          <Bell className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Ring</span>
                        </Button>
                      )}
                      <Button variant="default" size="sm" onClick={() => onCollected(e.id)} title="Device returned to owner">
                        <Undo2 className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Return</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNoShow(e.id, e.name)}
                        title="Mark as no-show"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <UserX className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">No-show</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onRemove(e.id)} aria-label="Remove">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Card>
      </main>

      <Dialog open={!!shareModal} onOpenChange={(o) => !o && setShareModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token #{shareModal?.entry.position} assigned to {shareModal?.entry.name}</DialogTitle>
            <DialogDescription>Share the token link with this person.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3 text-xs font-mono break-all">{shareModal?.url}</div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!shareModal) return;
                try { await navigator.clipboard.writeText(shareModal.url); toast.success("Link copied"); }
                catch { toast.error("Could not copy"); }
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy link
            </Button>
           <Button
  variant="outline"
  className="text-green-600 border-green-200 hover:bg-green-50"
  onClick={() => {
    if (!shareModal) return;
    const msg = `Hi ${shareModal.entry.name} 👋\n\nYour token is *#${shareModal.entry.position}*\n\nTrack your queue position here:\n${shareModal.url}\n\n_Powered by QueueSnap_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }}
>
  <MessageCircle className="mr-1 h-4 w-4" /> Share via WhatsApp
</Button>
            {shareModal?.entry.phone && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  if (!shareModal || !lobby) return;
                  sendWhatsAppToken(shareModal.entry.phone!, shareModal.entry.name, shareModal.entry.position, lobby.name, shareModal.url);
                  setShareModal(null);
                }}
              >
                <MessageCircle className="mr-1 h-4 w-4" /> Send to their WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LobbyManage;
