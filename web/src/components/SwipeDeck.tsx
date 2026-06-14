"use client";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { CheckIcon, SparkleIcon, XIcon } from "@phosphor-icons/react";
import { addr, compactUsd, pct } from "@/lib/format";
import type { LeaderStats } from "@/lib/types";

const CARD = "flex h-full flex-col overflow-hidden rounded-[14px] border border-line-strong bg-[#0c0f17] p-6";

function strategyOf(l: LeaderStats): string {
  if (l.avgLeverage >= 10) return "High leverage";
  if (l.liqDistancePct >= 40) return "Capital preservation";
  if (l.notionalUsd >= 100_000) return "High conviction";
  if (l.markets.length >= 2) return "Diversified";
  return "Momentum";
}

export function SwipeDeck({ leaders, onComplete }: { leaders: LeaderStats[]; onComplete: (kept: string[]) => void }) {
  const [i, setI] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const [dir, setDir] = useState<1 | -1>(1);
  const done = i >= leaders.length;
  const behind = leaders.slice(i + 1, i + 3);

  function decide(keep: boolean) {
    if (done) return;
    setDir(keep ? 1 : -1);
    if (keep) setKept((k) => [...k, leaders[i].owner]);
    setI((x) => x + 1);
  }

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-5">
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className="text-faint">
          {Math.min(i + 1, leaders.length)} / {leaders.length}
        </span>
        <span className="text-accent">{kept.length} drafted</span>
      </div>

      <div className="relative h-[420px] w-full">
        {behind.map((l, idx) => (
          <div
            key={l.owner}
            aria-hidden
            className="absolute inset-0 rounded-[14px] border border-line bg-[#0a0c12]"
            style={{ transform: `scale(${1 - (idx + 1) * 0.045}) translateY(${(idx + 1) * 16}px)`, zIndex: 1, opacity: 0.6 - idx * 0.25 }}
          />
        ))}
        <AnimatePresence>{!done && <TopCard key={leaders[i].owner} leader={leaders[i]} dir={dir} onDecide={decide} />}</AnimatePresence>
        {done && (
          <div className={`${CARD} absolute inset-0 items-center justify-center gap-4 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
              <SparkleIcon size={24} weight="fill" />
            </span>
            <p className="text-sm font-semibold tracking-tight text-fg">You drafted {kept.length} leaders.</p>
            <p className="max-w-xs text-sm text-muted">Fable will analyse their live positions and size your squad.</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-5">
        <DeckButton onClick={() => decide(false)} disabled={done} variant="pass">
          <XIcon size={22} weight="bold" />
        </DeckButton>
        <DeckButton onClick={() => decide(true)} disabled={done} variant="keep">
          <CheckIcon size={22} weight="bold" />
        </DeckButton>
      </div>

      {kept.length >= 1 && (
        <button
          onClick={() => onComplete(kept)}
          className="group inline-flex items-center gap-2 rounded-full bg-flash px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
        >
          <SparkleIcon size={15} weight="fill" />
          Analyse my {kept.length} {kept.length === 1 ? "pick" : "picks"}
        </button>
      )}
    </div>
  );
}

function TopCard({ leader, dir, onDecide }: { leader: LeaderStats; dir: 1 | -1; onDecide: (keep: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const keepOp = useTransform(x, [30, 130], [0, 1]);
  const passOp = useTransform(x, [-130, -30], [1, 0]);
  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) onDecide(true);
        else if (info.offset.x < -110) onDecide(false);
      }}
      initial={{ scale: 0.97, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ x: dir * 480, opacity: 0, rotate: dir * 16, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
    >
      <Card leader={leader} keepOp={keepOp} passOp={passOp} />
    </motion.div>
  );
}

function Card({ leader, keepOp, passOp }: { leader: LeaderStats; keepOp?: MotionValue<number>; passOp?: MotionValue<number> }) {
  return (
    <div className={CARD} style={{ boxShadow: "0 30px 70px -32px rgba(0,0,0,0.95)" }}>
      {keepOp && (
        <motion.span style={{ opacity: keepOp }} className="absolute right-5 top-5 z-10 rounded-md border-2 border-accent px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-accent">
          Draft
        </motion.span>
      )}
      {passOp && (
        <motion.span style={{ opacity: passOp }} className="absolute left-5 top-5 z-10 rounded-md border-2 border-short px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-short">
          Pass
        </motion.span>
      )}

      <div className="flex items-center justify-between">
        <span className="whitespace-nowrap rounded-md bg-accent/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          {strategyOf(leader)}
        </span>
        <span className="font-mono text-xs text-muted">{addr(leader.owner, 4)}</span>
      </div>

      <div className="mt-8">
        <div className="text-[10px] uppercase tracking-wider text-faint">Open notional</div>
        <div className="whitespace-nowrap font-mono text-4xl font-semibold tracking-tight text-fg tnum">{compactUsd(leader.notionalUsd)}</div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Avg leverage" value={`${leader.avgLeverage.toFixed(1)}×`} />
        <Stat label="Liq buffer" value={pct(leader.liqDistancePct, 0)} />
        <Stat label="Positions" value={`${leader.positions}`} />
        <Stat label="Markets" value={`${leader.markets.length}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
      <span className="font-mono text-xl font-semibold text-fg tnum">{value}</span>
    </div>
  );
}

function DeckButton({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick: () => void; disabled: boolean; variant: "keep" | "pass" }) {
  const color = variant === "keep" ? "text-accent ring-accent/40 hover:bg-accent/10" : "text-short ring-short/40 hover:bg-short/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={variant}
      className={`flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03] ring-1 transition-all duration-200 active:scale-95 disabled:opacity-30 ${color}`}
    >
      {children}
    </button>
  );
}
