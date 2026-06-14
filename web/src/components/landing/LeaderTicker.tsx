"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { addr, compactUsd } from "@/lib/format";
import type { LeaderStats } from "@/lib/types";

/** A live marquee of top Flash leaders (real data). Renders nothing if the
 *  API is offline — the landing never depends on it. */
export function LeaderTicker() {
  const [leaders, setLeaders] = useState<LeaderStats[]>([]);
  useEffect(() => {
    api.leaders().then((l) => setLeaders(l.slice(0, 16))).catch(() => setLeaders([]));
  }, []);
  if (leaders.length === 0) return null;
  const row = [...leaders, ...leaders];

  return (
    <section className="relative overflow-hidden border-y border-line/50 bg-ink/40 py-3.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-ink to-transparent" />
      <div className="absolute left-6 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring" /> Live on Flash
      </div>
      <div className="flex w-max animate-marquee items-center gap-9 pl-6">
        {row.map((l, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2.5 font-mono text-xs">
            <span className="text-fg">{addr(l.owner, 4)}</span>
            <span className="text-muted">{compactUsd(l.notionalUsd)}</span>
            <span className="text-accent tnum">{l.avgLeverage.toFixed(1)}×</span>
            <span className="text-faint">{l.liqDistancePct.toFixed(0)}% buffer</span>
          </span>
        ))}
      </div>
    </section>
  );
}
