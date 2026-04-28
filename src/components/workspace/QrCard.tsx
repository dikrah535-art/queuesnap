import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, QrCode as QrIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  /** Absolute URL to encode. */
  url: string;
  /** Filename stem for downloads. */
  filename?: string;
  size?: number;
}

/** Renders a QR code with PNG + SVG download and copy-link helpers. */
export const QrCard = ({ url, filename = "queuesnap-qr", size = 220 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    if (!url) return;
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: size, margin: 1, errorCorrectionLevel: "M" }).catch(() => {});
    }
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", width: size }).then(setSvg).catch(() => {});
  }, [url, size]);

  const downloadPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${filename}.png`;
    a.click();
  };
  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="rounded-2xl border border-border/60 bg-background p-3">
        <canvas ref={canvasRef} aria-label="QR code" className="block" />
      </div>
      <div className="flex-1 space-y-3 w-full">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><QrIcon className="h-3.5 w-3.5" /> Scan to join</div>
        <p className="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">{url}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" />Copy link</Button>
          <Button size="sm" variant="outline" onClick={downloadPng}><Download className="mr-1 h-4 w-4" />PNG</Button>
          <Button size="sm" variant="outline" onClick={downloadSvg}><Download className="mr-1 h-4 w-4" />SVG</Button>
        </div>
      </div>
    </div>
  );
};
