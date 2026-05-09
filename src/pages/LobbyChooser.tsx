import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, QrCode, ScanLine, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrScanner } from "@/components/QrScanner";
import { fetchLobby } from "@/lib/workspaces";
import { supabase } from "@/integrations/supabase/client";
import {
  DEMO_LOBBY_ID,
  DEMO_LOBBY_NAME,
  DEMO_LOBBY_DESCRIPTION,
  DEMO_LOBBY_PATH,
  fetchDemoLobbyWaitingCount,
} from "@/lib/demoLobby";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const extractLobbyId = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  // Accept full URLs like https://.../join/<id>
  try {
    const url = new URL(raw);
    const m = url.pathname.match(/\/join\/([0-9a-f-]{36})/i);
    if (m && UUID_RE.test(m[1])) return m[1];
  } catch {}
  // Accept "join/<id>" partial
  const m = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1] : null;
};

const LobbyChooser = () => {
  const navigate = useNavigate();
  const [lobbyInput, setLobbyInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCount, setDemoCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const n = await fetchDemoLobbyWaitingCount();
      if (!cancelled) setDemoCount(n);
    };
    load();
    const ch = supabase
      .channel("lobby-chooser-demo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `lobby_id=eq.${DEMO_LOBBY_ID}` },
        () => load()
      )
      .subscribe();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  const goToLobby = async (rawId: string) => {
    const id = extractLobbyId(rawId);
    if (!id) {
      setError("That doesn't look like a valid lobby ID.");
      toast.error("Invalid lobby ID");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const lobby = await fetchLobby(id);
      toast.success(`Lobby found: ${lobby.name}`);
      navigate(`/join/${lobby.id}`);
    } catch (e: any) {
      const msg = e?.message ?? "Lobby not found";
      setError("Lobby not found. Check the ID and try again.");
      toast.error(msg.includes("found") || msg.includes("rows") ? "Lobby not found" : msg);
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (!lobbyInput.trim()) {
      setError("Please enter a lobby ID first.");
      return;
    }
    goToLobby(lobbyInput);
  };

  const onScanResult = (text: string) => {
    setScannerOpen(false);
    toast.success("QR scanned");
    goToLobby(text);
  };

  const onScanError = () => {
    toast.error("Could not access camera. Check permissions.");
    setScannerOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
              aria-label="Back"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
        </div>
      </header>

      <main className="container max-w-md py-12">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Choose your lobby</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter a lobby ID or scan the QR code provided by the organizer.
          </p>
        </div>

        {/* Pinned demo lobby */}
        <Link to={DEMO_LOBBY_PATH} className="block mb-6 group">
          <Card className="relative p-5 border-2 border-primary/60 bg-gradient-to-br from-primary/5 via-card to-card shadow-glow ring-1 ring-primary/20 transition hover:-translate-y-0.5 hover:shadow-elegant animate-scale-in">
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live
            </span>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1 pr-14">
                <h3 className="font-semibold tracking-tight">{DEMO_LOBBY_NAME}</h3>
                <p className="mt-0.5 text-xs font-medium text-primary">Try For Free — No Signup Needed</p>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{DEMO_LOBBY_DESCRIPTION}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {demoCount === 0
                    ? "Queue is empty — be the first! 👋"
                    : <><span className="font-semibold tabular-nums text-foreground">{demoCount}</span> people in queue right now</>}
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Card className="p-6 animate-scale-in">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lobby-id">Lobby ID</Label>
              <Input
                id="lobby-id"
                value={lobbyInput}
                onChange={(e) => { setLobbyInput(e.target.value); if (error) setError(null); }}
                placeholder="Paste lobby ID or join link"
                autoFocus
                disabled={checking}
                aria-invalid={!!error}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={checking || !lobbyInput.trim()}>
              {checking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</> : <>Continue <ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setScannerOpen((v) => !v)}
              disabled={checking}
            >
              {scannerOpen ? <><X className="mr-1 h-4 w-4" /> Close scanner</> : <><ScanLine className="mr-1 h-4 w-4" /> Scan QR Code</>}
            </Button>

            {scannerOpen && (
              <div className="space-y-2 animate-fade-in">
                <QrScanner onResult={onScanResult} onError={onScanError} />
                <p className="text-center text-xs text-muted-foreground">
                  <QrCode className="inline h-3 w-3 mr-1" />
                  Point the camera at the lobby QR code
                </p>
              </div>
            )}
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have a lobby ID? Ask the organizer to share their join link or QR.
        </p>
      </main>
    </div>
  );
};

export default LobbyChooser;
