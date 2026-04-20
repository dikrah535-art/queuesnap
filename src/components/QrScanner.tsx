import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onResult: (text: string) => void;
  onError?: (msg: string) => void;
}

export const QrScanner = ({ onResult, onError }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const id = `qr-${Math.random().toString(36).slice(2)}`;
    ref.current.id = id;
    const scanner = new Html5Qrcode(id, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onResult(decoded);
        },
        () => {},
      )
      .catch((err) => onError?.(String(err)));

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {}));
    };
  }, [onResult, onError]);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl border-2 border-accent" />;
};
