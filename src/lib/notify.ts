// Browser notification + looping chime + vibration helpers
// NOTE: We intentionally avoid service workers (Lovable preview iframe constraints).
// "Push" here = foreground Notification API + looped Web Audio + vibration.

let audioCtx: AudioContext | null = null;
let loopTimer: number | null = null;
let vibrateTimer: number | null = null;
let activeOscillators: OscillatorNode[] = [];

function ensureCtx(): AudioContext | null {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function playChimeOnce() {
  const ctx = ensureCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [880, 1320, 1760, 1320];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + i * 0.18;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.45);
    activeOscillators.push(osc);
    osc.onended = () => {
      activeOscillators = activeOscillators.filter((o) => o !== osc);
    };
  });
}

/** One-shot chime (legacy export, used elsewhere). */
export function playChime() {
  try { playChimeOnce(); } catch (e) { console.warn("chime failed", e); }
  try { if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
}

/** Start a continuous looping alert (sound + vibration) until stopAlert() is called. */
export function startAlert() {
  stopAlert(); // ensure no duplicates
  try {
    playChimeOnce();
    loopTimer = window.setInterval(() => playChimeOnce(), 1400);
  } catch (e) {
    console.warn("alert loop failed", e);
  }
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([400, 150, 400, 150, 600]);
      vibrateTimer = window.setInterval(() => {
        try { navigator.vibrate([400, 150, 400, 150, 600]); } catch {}
      }, 1800);
    }
  } catch {}
}

/** Stop any active looping alert. */
export function stopAlert() {
  if (loopTimer !== null) { clearInterval(loopTimer); loopTimer = null; }
  if (vibrateTimer !== null) { clearInterval(vibrateTimer); vibrateTimer = null; }
  try { if ("vibrate" in navigator) navigator.vibrate(0); } catch {}
  activeOscillators.forEach((o) => { try { o.stop(); } catch {} });
  activeOscillators = [];
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied")
    return Notification.permission;
  return await Notification.requestPermission();
}

export function pushNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "queuesnap",
        // @ts-expect-error - vibrate is supported in some browsers
        vibrate: [400, 150, 400, 150, 600],
      });
      setTimeout(() => n.close(), 10000);
    }
  } catch (e) {
    console.warn(e);
  }
}
