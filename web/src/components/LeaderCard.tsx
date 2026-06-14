"use client";
import { motion, useMotionValue, useTransform } from "motion/react";
import { CheckCircleIcon, GaugeIcon, ShieldIcon, StackIcon, TrendUpIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { addr, compactUsd, pct } from "@/lib/format";
import type { SquadPick } from "@/lib/types";

export function LeaderCard({
  pick,
  index,
  approved,
  onToggle,
  onSwipe,
}: {
  pick: SquadPick;
  index: number;
  approved: boolean;
  onToggle: () => void;
  onSwipe: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-7, 7]);
  const draftHint = useTransform(x, [12, 120], [0, 1]);
  const skipHint = useTransform(x, [-120, -12], [1, 0]);

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) onSwipe("right");
        else if (info.offset.x < -110) onSwipe("left");
      }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.25 } }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="relative cursor-grab touch-pan-y active:cursor-grabbing"
    >
      <motion.span
        style={{ opacity: draftHint }}
        className="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-accent px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#04130d]"
      >
        Draft
      </motion.span>
      <motion.span
        style={{ opacity: skipHint }}
        className="pointer-events-none absolute left-4 top-4 z-10 rounded-md bg-short px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1a0508]"
      >
        Skip
      </motion.span>

      <Bezel
        className={`transition-shadow duration-500 ${approved ? "ring-1 ring-accent/40" : ""}`}
        innerClassName="flex flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-accent/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              {pick.role}
            </span>
            <span className="font-mono text-sm text-fg">{addr(pick.owner, 5)}</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-fg tnum">{pick.allocationPct}%</div>
            <div className="text-[10px] uppercase tracking-wider text-faint">allocation</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat icon={<TrendUpIcon size={14} />} label="Notional" value={compactUsd(pick.stats.notionalUsd)} />
          <Stat icon={<GaugeIcon size={14} />} label="Leverage" value={`${pick.stats.avgLeverage.toFixed(1)}×`} />
          <Stat icon={<ShieldIcon size={14} />} label="Liq buffer" value={pct(pick.stats.liqDistancePct, 0)} />
          <Stat icon={<StackIcon size={14} />} label="Positions" value={`${pick.stats.positions}`} />
        </div>

        <p className="text-sm leading-relaxed text-muted">{pick.reason}</p>

        <button
          onClick={onToggle}
          className={`group mt-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
            approved ? "bg-accent text-[#04130d]" : "bg-white/[0.04] text-fg ring-1 ring-line hover:bg-white/[0.08]"
          }`}
        >
          <CheckCircleIcon size={16} weight={approved ? "fill" : "regular"} />
          {approved ? "Drafted" : "Draft into squad"}
        </button>
      </Bezel>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">
        <span className="text-muted">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-sm text-fg tnum">{value}</span>
    </div>
  );
}
