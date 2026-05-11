import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchLobby, type Lobby } from "@/lib/workspaces";
import { getJoinUrl, BASE_URL } from "@/lib/urls";

const LobbyPrint = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobby(lobbyId)
      .then(setLobby)
      .catch(() => setLobby(null))
      .finally(() => setLoading(false));
  }, [lobbyId]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (!lobby || !lobbyId) {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-slate-600">
        Lobby not found
      </div>
    );
  }

  const url = getJoinUrl(lobby.id);
  const displayUrl = BASE_URL.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      <style>{`@media print { .no-print { display: none !important; } @page { size: A4; margin: 18mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="no-print sticky top-0 flex justify-end p-4 border-b border-slate-200 bg-white">
        <Button onClick={() => window.print()} className="min-h-[44px]">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">QueueSnap</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{lobby.name}</h1>
        {lobby.description && (
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">{lobby.description}</p>
        )}

        <div className="mt-10 inline-block rounded-2xl border-4 border-slate-900 bg-white p-6">
          <QRCodeSVG
            value={url}
            size={300}
            bgColor="#ffffff"
            fgColor="#0f172a"
            level="H"
            includeMargin={false}
          />
        </div>

        <p className="mt-8 text-xl font-semibold">
          Scan to join the queue and get your token 🎫
        </p>
        <p className="mt-3 text-slate-500 text-sm break-all">{displayUrl}</p>
        <p className="mt-12 text-xs text-slate-400">Powered by QueueSnap</p>
      </main>
    </div>
  );
};

export default LobbyPrint;
