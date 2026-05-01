import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Looping "ring" tone via Web Audio API.
 * No asset needed — generates a soft repeating chime in-browser.
 * Stops only when stop() is called or the component unmounts.
 */
export function useRingTone() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [ringing, setRinging] = useState(false);

  const cleanup = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try { gainRef.current?.disconnect(); } catch {}
    gainRef.current = null;
    if (ctxRef.current) {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      try { ctx.close(); } catch {}
    }
  }, []);

  const playChime = useCallback((ctx: AudioContext, master: GainNode) => {
    const now = ctx.currentTime;
    // Two-note chime: A5 -> E6
    const notes: Array<[number, number]> = [
      [880, 0],
      [1318.5, 0.18],
    ];
    notes.forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + offset);
      g.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
      osc.connect(g).connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.4);
    });
  }, []);

  const start = useCallback(() => {
    if (ringing) return;
    try {
      const Ctx: typeof AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = master;
      // resume in case it's suspended (autoplay policies)
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      // immediate first chime
      playChime(ctx, master);
      // repeat every 1.2s
      intervalRef.current = window.setInterval(() => {
        if (ctxRef.current && gainRef.current) {
          playChime(ctxRef.current, gainRef.current);
        }
      }, 1200);
      setRinging(true);
    } catch {
      // Audio unsupported — fail quietly
      cleanup();
    }
  }, [ringing, playChime, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setRinging(false);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { ringing, start, stop };
}
