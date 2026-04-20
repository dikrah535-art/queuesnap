// Browser notification + chime + vibration helpers

let audioCtx: AudioContext | null = null;

export function playChime(durationMs = 1200) {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const notes = [880, 1320, 1760];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.45);
    });
  } catch (e) {
    console.warn("chime failed", e);
  }
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
  } catch {}
  return durationMs;
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
      const n = new Notification(title, { body, icon: "/favicon.ico", tag: "syncphone" });
      setTimeout(() => n.close(), 8000);
    }
  } catch (e) {
    console.warn(e);
  }
}
