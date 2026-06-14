"use client";
import { motion } from "motion/react";
import { compactUsd } from "@/lib/format";
import type { HeatmapBin } from "@/lib/types";

function color(distPct: number): string {
  if (distPct < 10) return "#fb7185"; // danger — liquidates on a small move
  if (distPct < 25) return "#fbbf24";
  return "#34d399";
}

export function Heatmap({ bins }: { bins: HeatmapBin[] }) {
  const shown = bins.slice(0, 12);
  const max = Math.max(1, ...shown.map((b) => b.notionalUsd));
  const atRisk = bins
    .filter((b) => b.priceHigh <= 10)
    .reduce((a, b) => a + b.notionalUsd, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-fg">Liquidation heatmap</h3>
          <p className="text-xs text-faint">notional by distance to liquidation</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-short tnum">{compactUsd(atRisk)}</div>
          <div className="text-[10px] uppercase tracking-wider text-faint">within 10%</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {shown.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-faint tnum">
              {b.priceLow}–{b.priceHigh}%
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-white/[0.03]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ background: color(b.priceHigh), opacity: 0.85 }}
                initial={{ width: 0 }}
                animate={{ width: `${(b.notionalUsd / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="w-12 shrink-0 font-mono text-[11px] text-muted tnum">
              {b.notionalUsd > 0 ? compactUsd(b.notionalUsd) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
