import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Mail, MessageCircle, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getJoinUrl, getPrintUrl } from "@/lib/urls";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lobbyId: string;
  lobbyName: string;
}

export const downloadLobbyQR = (lobbyName: string, lobbyId: string) => {
  const svgElement = document.getElementById(`qr-${lobbyId}`) as unknown as SVGElement | null;
  if (!svgElement) {
    toast.error("QR not ready yet");
    return;
  }
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const size = 320;
  canvas.width = size;
  canvas.height = size + 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 32, 16, 256, 256);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(lobbyName, size / 2, size + 28);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Scan to join • QueueSnap", size / 2, size + 44);
    const link = document.createElement("a");
    link.download = `${lobbyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  img.src = URL.createObjectURL(blob);
};

export const LobbyShareModal = ({ open, onOpenChange, lobbyId, lobbyName }: Props) => {
  const url = getJoinUrl(lobbyId);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied! ✓");
    } catch {
      toast.error("Could not copy");
    }
  };

  const onWhatsApp = () => {
    const text = `Join my queue on QueueSnap! 🎫\nScan or tap to get your token:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const onEmail = () => {
    const subject = `Join the Queue — ${lobbyName}`;
    const body = `Hi!\n\nJoin the queue for ${lobbyName}.\n\nGet your token here:\n${url}\n\nPowered by QueueSnap`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">{lobbyName} Queue</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border-2 border-border bg-white p-3">
            <QRCodeSVG
              id={`qr-${lobbyId}`}
              value={url}
              size={256}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-muted-foreground">Scan to join this queue</p>
          <p className="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono text-center w-full">
            {url}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="outline" onClick={copyLink} className="min-h-[44px]">
            {copied ? <X className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <Button variant="outline" onClick={() => downloadLobbyQR(lobbyName, lobbyId)} className="min-h-[44px]">
            <Download className="mr-1 h-4 w-4" /> Download QR
          </Button>
          <Button variant="outline" onClick={onWhatsApp} className="min-h-[44px]">
            <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={onEmail} className="min-h-[44px]">
            <Mail className="mr-1 h-4 w-4" /> Email
          </Button>
          <Button asChild variant="outline" className="col-span-2 min-h-[44px]">
            <Link to={`/admin/lobby/${lobbyId}/print`} target="_blank" rel="noreferrer">
              <Printer className="mr-1 h-4 w-4" /> Print
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
