"use client";
import { AnimatePresence, motion } from "motion/react";
import { addr } from "@/lib/format";
import type { TxLog } from "@/lib/types";

const KIND_COLOR: Record<string, string> = {
  delegate: "#868da0",
  mirror: "#34d399",
  crank: "#34d399",
  stress: "#fbbf24",
};

export function TxFeed({ txs }: { txs: TxLog[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">ER transaction feed</span>
        <span className="font-mono text-[10px] text-faint">zero-fee · sub-100ms</span>
      </div>
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {txs.length === 0 && <p className="font-mono text-xs text-faint">awaiting first instruction…</p>}
          {txs.map((tx) => (
            <motion.div
              key={`${tx.kind}-${tx.sig}-${tx.ts}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5 ring-1 ring-line"
            >
              <span
                className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: KIND_COLOR[tx.kind] ?? "#868da0" }}
              >
                {tx.kind}
              </span>
              <span className="flex-1 truncate text-xs text-muted">{tx.detail}</span>
              {tx.ms > 0 && <span className="shrink-0 font-mono text-[10px] text-accent tnum">{tx.ms}ms</span>}
              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-faint">
                {tx.sig === "—" ? "base" : addr(tx.sig, 4)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
