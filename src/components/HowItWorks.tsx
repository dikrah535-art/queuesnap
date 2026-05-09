import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate, useMotionValue, useTransform } from "framer-motion";
import { Building2, Smartphone, Zap, Bell, QrCode, ScanLine, Bell as BellIcon } from "lucide-react";
import { FlowDemo } from "@/components/FlowDemo";

/* ---------- Reusable phone frame ---------- */
const Phone = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto w-[260px] md:w-[300px] aspect-[9/19] rounded-[2.5rem] bg-[#0b1220] border border-white/10 shadow-2xl shadow-primary/20 overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-28 bg-black rounded-b-2xl z-20" />
    <div className="absolute inset-2 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
      <div className="h-full w-full p-4 pt-8">{children}</div>
    </div>
  </div>
);

/* ---------- Step 1: Admin creates queue ---------- */
const TypingLine = ({ label, value, delay }: { label: string; value: string; delay: number }) => {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setText(value.slice(0, i));
        if (i >= value.length) clearInterval(id);
      }, 60);
    }, delay);
    return () => clearTimeout(start);
  }, [value, delay]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className="rounded-md bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-white font-medium min-h-[28px]">
        {text}
        <span className="ml-0.5 inline-block w-[1px] h-3 bg-primary animate-pulse align-middle" />
      </div>
    </div>
  );
};

const Step1Mock = () => (
  <Phone>
    <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">Create Queue</div>
    <div className="mt-3 space-y-3">
      <TypingLine label="Name" value="Reception Desk" delay={300} />
      <TypingLine label="Capacity" value="50" delay={1400} />
    </div>
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: [0, 0, 1], scale: [0.7, 0.7, 1] }}
      transition={{ duration: 2.5, times: [0, 0.7, 1], repeat: Infinity, repeatDelay: 0.5 }}
      className="mt-4 mx-auto w-24 h-24 grid place-items-center rounded-xl bg-white shadow-[0_0_40px_rgba(99,102,241,0.5)]"
    >
      <QrCode className="h-16 w-16 text-slate-900" />
    </motion.div>
  </Phone>
);

/* ---------- Step 2: People scan & join ---------- */
const Step2Mock = () => (
  <Phone>
    <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">Scan QR</div>
    <div className="mt-3 relative h-32 rounded-lg bg-black/50 border border-white/10 overflow-hidden grid place-items-center">
      <QrCode className="h-20 w-20 text-white/80" />
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      />
    </div>
    <motion.div
      className="mt-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0, 1, 1, 0] }}
      transition={{ duration: 3, times: [0, 0.4, 0.5, 0.85, 1], repeat: Infinity }}
    >
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Your name</div>
      <div className="rounded-md bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-white">Alex</div>
    </motion.div>
    <motion.div
      className="mt-3 grid place-items-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 0, 1.1, 1], opacity: [0, 0, 1, 1] }}
      transition={{ duration: 3, times: [0, 0.7, 0.85, 1], repeat: Infinity }}
    >
      <div className="rounded-2xl bg-primary/15 border border-primary/40 px-4 py-2 text-primary font-bold text-2xl">
        Token #7
      </div>
    </motion.div>
  </Phone>
);

/* ---------- Step 3: Track real-time ---------- */
const Step3Mock = () => {
  const [n, setN] = useState(3);
  useEffect(() => {
    const id = setInterval(() => {
      setN((v) => (v <= 0 ? 3 : v - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Phone>
      <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">Your Status</div>
      <div className="mt-6 text-center text-white/60 text-xs">You are</div>
      <motion.div
        key={n}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.2, 1], opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mt-1 text-center text-6xl font-bold text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
      >
        #{Math.max(n, 1)}
      </motion.div>
      <div className="mt-1 text-center text-white/60 text-xs">in line</div>
      {n <= 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-5 mx-auto rounded-xl bg-success/20 border border-success/50 px-3 py-2 text-success text-center text-xs font-semibold"
        >
          🎉 It's your turn!
        </motion.div>
      )}
    </Phone>
  );
};

/* ---------- Step 4: Admin rings next ---------- */
const Step4Mock = () => (
  <Phone>
    <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">Admin Panel</div>
    <div className="mt-3 space-y-2">
      {["#5 · Priya", "#6 · Jordan", "#7 · Alex"].map((s) => (
        <div key={s} className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80">
          {s}
        </div>
      ))}
    </div>
    <motion.button
      className="relative mt-4 w-full rounded-xl bg-primary text-primary-foreground font-semibold text-sm py-3 overflow-hidden"
      animate={{ scale: [1, 0.95, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.4, 0.5] }}
    >
      Call Next ➜
      <motion.span
        className="absolute inset-0 bg-white/30 rounded-xl"
        initial={{ scale: 0, opacity: 0.6 }}
        animate={{ scale: [0, 2.5], opacity: [0.6, 0] }}
        transition={{ duration: 1, repeat: Infinity, repeatDelay: 1.5 }}
      />
    </motion.button>
    <motion.div
      className="mt-4 rounded-xl bg-white/5 border border-white/10 p-2.5 flex items-center gap-2"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: [100, 0, 0, 100], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.5, times: [0, 0.3, 0.85, 1], repeat: Infinity }}
    >
      <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary">
        <BellIcon className="h-3.5 w-3.5" />
      </div>
      <div className="text-[11px] text-white leading-tight">
        <div className="font-semibold">QueueSnap</div>
        <div className="text-white/70">🔔 It's your turn!</div>
      </div>
    </motion.div>
  </Phone>
);

const STEPS = [
  { icon: "🏢", title: "Set up in seconds", text: "Admin logs in, creates a queue with a name and capacity. Instantly gets a unique QR code.", Mock: Step1Mock, label: "Admin Creates a Queue" },
  { icon: "📱", title: "Scan. Join. Done.", text: "Visitors scan the QR code, enter their name, and instantly receive their token number.", Mock: Step2Mock, label: "People Scan & Join" },
  { icon: "⚡", title: "Live updates, zero refreshing", text: "Token holders see their position update live. No app download. No account needed.", Mock: Step3Mock, label: "Track in Real Time" },
  { icon: "🔔", title: "One tap to call next", text: "Admin hits 'Call Next' and the right person is instantly notified — on screen or by message.", Mock: Step4Mock, label: "Admin Rings the Next Person" },
];

/* ---------- Counter ---------- */
const Counter = ({ to, suffix = "" }: { to: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.floor(v).toLocaleString());
  useEffect(() => {
    if (inView) {
      const c = animate(mv, to, { duration: 2, ease: "easeOut" });
      return c.stop;
    }
  }, [inView, to, mv]);
  return (
    <span ref={ref}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
};

/* ---------- Step row ---------- */
const StepRow = ({ i, step, setActive }: { i: number; step: typeof STEPS[number]; setActive: (n: number) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-40% 0px -40% 0px" });
  useEffect(() => { if (inView) setActive(i); }, [inView, i, setActive]);
  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-10 md:gap-16 items-center py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className={i % 2 === 1 ? "md:order-2" : ""}
      >
        <div className="text-4xl mb-3">{step.icon}</div>
        <div className="text-xs uppercase tracking-wider text-primary/80 mb-2">Step {i + 1} · {step.label}</div>
        <h3 className="text-2xl md:text-4xl font-semibold text-white tracking-tight">{step.title}</h3>
        <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed max-w-md">{step.text}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={`flex justify-center ${i % 2 === 1 ? "md:order-1" : ""}`}
      >
        <step.Mock />
      </motion.div>
    </div>
  );
};

/* ---------- Main ---------- */
export const HowItWorks = () => {
  const [active, setActive] = useState(0);

  return (
    <section className="relative bg-[#0f172a] text-white">
      <div className="container py-20 md:py-28">
        <div className="text-center mb-10 md:mb-16">
          <div className="text-xs uppercase tracking-wider text-primary mb-3">How It Works</div>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight bg-gradient-to-r from-white via-white to-primary/80 bg-clip-text text-transparent">
            How QueueSnap Works
          </h2>
          <p className="mt-4 text-white/60 max-w-xl mx-auto">From setup to “you’re up next” in four simple steps.</p>
        </div>

        <div className="relative md:flex md:gap-10">
          {/* Vertical progress rail (desktop) */}
          <div className="hidden md:block sticky top-24 self-start">
            <div className="relative h-[420px] w-10">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2" />
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${(i / (STEPS.length - 1)) * 100}%` }}
                >
                  <div
                    className={[
                      "h-3 w-3 rounded-full transition-all duration-500",
                      active === i
                        ? "bg-primary shadow-[0_0_18px_hsl(var(--primary))] scale-150"
                        : active > i
                        ? "bg-primary/60"
                        : "bg-white/20",
                    ].join(" ")}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-white/5">
            {STEPS.map((s, i) => (
              <StepRow key={i} i={i} step={s} setActive={setActive} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { v: 500, suffix: "+", l: "Queues Created" },
            { v: 10000, suffix: "+", l: "Tokens Issued" },
            { v: 0, suffix: "", l: "App Downloads Needed" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary tabular-nums">
                <Counter to={s.v} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-sm text-white/60 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Mini summary using existing flow */}
        <div className="mt-14">
          <div className="text-center text-xs uppercase tracking-wider text-white/40 mb-2">At a glance</div>
          <div className="rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden">
            <FlowDemo />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
