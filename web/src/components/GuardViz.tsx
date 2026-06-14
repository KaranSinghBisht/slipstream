"use client";
import { motion } from "motion/react";
import { price } from "@/lib/format";
import type { VaultState } from "@/lib/types";

/** Visualises the trailing stop ratcheting against the live mark: entry, peak
 *  high-water mark, the stop line, and the moving mark price + its buffer. */
export function GuardViz({ v }: { v: VaultState }) {
  const isLong = v.side !== "short";
  const points = [v.entryPrice, v.peakPrice, v.trailStop, v.markPrice].filter((n) => n > 0);
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const pad = (hi - lo) * 0.18 + hi * 0.0006;
  const min = lo - pad;
  const max = hi + pad;
  const at = (p: number) => Math.max(0, Math.min(100, ((p - min) / (max - min)) * 100));

  const profitLo = Math.min(at(v.entryPrice), at(v.peakPrice));
  const profitHi = Math.max(at(v.entryPrice), at(v.peakPrice));
  const bufferPct = v.trailStop > 0 ? ((v.markPrice - v.trailStop) / v.markPrice) * 100 * (isLong ? 1 : -1) : 0;
  const accent = v.stopFired ? "#fb7185" : "#34d399";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">Trailing-stop guard</span>
        <span className="font-mono text-xs tnum" style={{ color: accent }}>
          {v.stopFired ? "fired" : `${bufferPct.toFixed(2)}% buffer`}
        </span>
      </div>

      <div className="relative h-24">
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        {/* profit zone (entry → peak) */}
        <div
          className="absolute top-1/2 h-9 -translate-y-1/2 rounded-md"
          style={{
            left: `${profitLo}%`,
            width: `${Math.max(0, profitHi - profitLo)}%`,
            background: "linear-gradient(90deg, rgba(52,211,153,0.05), rgba(52,211,153,0.18))",
          }}
        />
        {/* entry tick */}
        <Marker pos={at(v.entryPrice)} label="entry" color="#565d70" />
        {/* peak high-water */}
        {v.peakPrice > 0 && Math.abs(v.peakPrice - v.entryPrice) > 1e-9 && (
          <Marker pos={at(v.peakPrice)} label="peak" color="#34d399" faint />
        )}
        {/* stop line */}
        <motion.div
          className="absolute top-1/2 h-14 w-0.5 -translate-y-1/2"
          style={{ background: accent }}
          animate={{ left: `${at(v.trailStop)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px]" style={{ color: accent }}>
            stop {price(v.trailStop)}
          </span>
        </motion.div>
        {/* live mark */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2"
          animate={{ left: `${at(v.markPrice)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <div className="relative -translate-x-1/2">
            <div className={`h-3.5 w-3.5 rounded-full ${v.stopFired ? "" : "pulse-ring"}`} style={{ background: accent }} />
            <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-fg">
              {price(v.markPrice)}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Marker({ pos, label, color, faint = false }: { pos: number; label: string; color: string; faint?: boolean }) {
  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pos}%`, opacity: faint ? 0.75 : 1 }}>
      <div className="h-9 w-px -translate-x-1/2" style={{ background: color }} />
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-faint">{label}</span>
    </div>
  );
}
