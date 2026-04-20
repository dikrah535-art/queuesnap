import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Hash, ListOrdered, ScanLine, Smartphone } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, label: "Submit Device" },
  { icon: Hash, label: "Get Token" },
  { icon: ListOrdered, label: "Wait in Queue" },
  { icon: ScanLine, label: "Scan & Collect" },
];

const SAMPLE = [
  { name: "Alex", token: "A7K2" },
  { name: "Priya", token: "B3X9" },
  { name: "Jordan", token: "C8M4" },
  { name: "Sam", token: "D5N1" },
  { name: "Mei", token: "E2Q6" },
];

export const FlowDemo = () => {
  const [active, setActive] = useState(0);
  const [serving, setServing] = useState(0);

  // Cycle highlighted step
  useEffect(() => {
    const id = setInterval(() => setActive((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(id);
  }, []);

  // Advance the simulated queue
  useEffect(() => {
    const id = setInterval(() => setServing((s) => (s + 1) % SAMPLE.length), 2600);
    return () => clearInterval(id);
  }, []);

  const nowServing = SAMPLE[serving];
  const waiting = [
    ...SAMPLE.slice(serving + 1),
    ...SAMPLE.slice(0, serving),
  ].slice(0, 4);

  return (
    <section className="container py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">How it works</h2>
        <p className="mt-3 text-muted-foreground">Four simple steps from drop-off to pickup.</p>
      </div>

      {/* Step flow */}
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-2 md:gap-4 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const isActive = i === active;
            const isPast = i < active;
            return (
              <div key={s.label} className="flex items-center gap-2 md:gap-4 shrink-0">
                <div className="flex flex-col items-center gap-2 w-20 md:w-28">
                  <div
                    className={[
                      "grid h-12 w-12 md:h-14 md:w-14 place-items-center rounded-2xl transition-all duration-500",
                      isActive
                        ? "bg-primary text-primary-foreground scale-110 shadow-glow"
                        : isPast
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground",
                    ].join(" ")}
                  >
                    <s.icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span
                    className={[
                      "text-[11px] md:text-xs font-medium text-center leading-tight transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    className={[
                      "h-4 w-4 md:h-5 md:w-5 shrink-0 transition-colors duration-500",
                      i < active ? "text-primary" : "text-border",
                    ].join(" ")}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue simulation */}
      <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live demo</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Simulated · no real data</span>
        </div>

        {/* Now serving */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 text-center overflow-hidden">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Now serving</div>
          <div key={nowServing.token} className="mt-2 animate-scale-in">
            <div className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Token #{nowServing.token}
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> {nowServing.name}
            </div>
          </div>
        </div>

        {/* Waiting list */}
        <div className="mt-6">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Up next
          </div>
          <ul className="space-y-2">
            {waiting.map((p, i) => (
              <li
                key={`${p.token}-${serving}`}
                className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-background text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                </div>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  #{p.token}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default FlowDemo;
