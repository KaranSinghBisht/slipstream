"use client";
import { motion } from "motion/react";
import { BroadcastIcon, LightningIcon } from "@phosphor-icons/react";
import { PnlChart } from "@/components/PnlChart";

// The real money-shot, from a verified devnet run.
const SAMPLES = [
  { you: 0, leader: 0 },
  { you: 0, leader: 0 },
  { you: -6, leader: -6 },
  { you: -13, leader: -13 },
  { you: -23, leader: -23 },
  { you: -23, leader: -39 },
  { you: -23, leader: -59 },
  { you: -23, leader: -82 },
];

const TXS = [
  { k: "stress", d: "adverse tick → $67.21", ms: 412, c: "#fbbf24" },
  { k: "crank", d: "check_trailing_stop", ms: 318, c: "#34d399" },
  { k: "mirror", d: "30.15 SOL long @ $68.13", ms: 134, c: "#34d399" },
];

export function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative mt-16 w-full"
    >
      <div aria-hidden className="absolute inset-x-10 -bottom-6 top-16 -z-10 rounded-[2.5rem] glow-flash" />
      <div className="bezel rounded-[1.25rem] p-2 ring-1 ring-line-strong">
        {/* window chrome */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-short/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-long/70" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-black/40 px-3 py-1 font-mono text-[11px] text-faint ring-1 ring-line">
            <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring" /> app.slipstream.trade · devnet ER
          </div>
        </div>

        {/* body */}
        <div className="grid grid-cols-1 gap-2 rounded-[0.85rem] bg-ink-2 p-2 lg:grid-cols-[1.55fr_1fr]">
          {/* main: position + chart */}
          <div className="flex flex-col gap-4 rounded-lg bg-panel/60 p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-long/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-long">
                  SOL long
                </span>
                <span className="font-mono text-xs text-faint">vault HFzP…5tRb</span>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                <BroadcastIcon size={12} className="text-accent" /> devnet-as
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-faint">Mark</div>
                <div className="font-mono text-3xl font-semibold tracking-tight text-fg tnum">$68.13</div>
              </div>
              <Metric label="Realised" value="−2.47%" tone="down" />
              <Metric label="Equity locked" value="$975.35" />
            </div>
            <PnlChart samples={SAMPLES} firedAt={4} alloc={1000} />
          </div>

          {/* side: guard + tx feed + squad */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5 rounded-lg bg-panel/60 p-4 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-faint">Autonomous guard</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                  <LightningIcon size={9} weight="fill" /> @500ms
                </span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="font-mono text-2xl font-semibold text-fg tnum">37</span>
                <span className="pb-1 text-[11px] text-muted">on-chain ticks</span>
              </div>
              <p className="text-[10px] leading-snug text-faint">zero client transactions</p>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 rounded-lg bg-panel/60 p-4 ring-1 ring-line">
              <span className="text-[10px] uppercase tracking-wider text-faint">ER transaction feed</span>
              {TXS.map((t) => (
                <div key={t.k} className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1.5 ring-1 ring-line">
                  <span className="w-12 shrink-0 text-[9px] font-semibold uppercase tracking-wide" style={{ color: t.c }}>
                    {t.k}
                  </span>
                  <span className="flex-1 truncate font-mono text-[10px] text-muted">{t.d}</span>
                  <span className="shrink-0 font-mono text-[10px] text-accent tnum">{t.ms}ms</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-panel/60 p-3 ring-1 ring-line">
              <span className="text-[10px] uppercase tracking-wider text-faint">Squad</span>
              <span className="font-mono text-[11px] text-muted">FSMBY 35%</span>
              <span className="font-mono text-[11px] text-muted">Ba1o5 20%</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "down" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`font-mono text-lg font-semibold tnum ${tone === "down" ? "text-short" : "text-fg"}`}>{value}</div>
    </div>
  );
}
