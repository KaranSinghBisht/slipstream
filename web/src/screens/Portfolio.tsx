"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LightningIcon, PlusIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { addr, usd2 } from "@/lib/format";
import type { SessionInfo, VaultState } from "@/lib/types";

/** Portfolio of the user's guarded ER vaults — run several squads, switch
 *  between them, open any to its live dashboard, or start a new one. */
export function Portfolio({
  vaults,
  onOpen,
  onNew,
}: {
  vaults: SessionInfo[];
  onOpen: (s: SessionInfo) => void;
  onNew: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-fg">Your vaults</h2>
          <p className="mt-1 text-sm text-muted">
            {vaults.length} guarded {vaults.length === 1 ? "position" : "positions"} on the Ephemeral Rollup.
          </p>
        </div>
        <Button onClick={onNew} arrow>
          New squad
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vaults.map((s, i) => (
          <VaultCard key={s.session} session={s} index={i} onOpen={() => onOpen(s)} />
        ))}
        <button
          onClick={onNew}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong text-muted transition-colors hover:border-accent/40 hover:text-fg"
        >
          <PlusIcon size={22} />
          <span className="text-sm font-medium">New squad</span>
        </button>
      </div>
    </div>
  );
}

function VaultCard({ session, index, onOpen }: { session: SessionInfo; index: number; onOpen: () => void }) {
  const [st, setSt] = useState<VaultState | null>(null);
  useEffect(() => {
    let live = true;
    api.state(session.session).then((x) => live && setSt(x)).catch(() => {});
    return () => {
      live = false;
    };
  }, [session.session]);

  const guarding = st?.crankActive ?? false;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Bezel className="group transition-all duration-500 hover:-translate-y-1 hover:ring-1 hover:ring-accent/30" innerClassName="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-long/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-long">
            {session.market} long
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${guarding ? "text-accent" : "text-faint"}`}>
            {guarding ? <LightningIcon size={11} weight="fill" /> : <ShieldCheckIcon size={11} weight="fill" />}
            {guarding ? "guarding @500ms" : "settled"}
          </span>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-faint">Equity</div>
          <div className="font-mono text-2xl font-semibold text-fg tnum">{st ? usd2(st.equityUsd) : "—"}</div>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
          <span>vault {addr(session.vault, 4)}</span>
          {st && <span className="text-accent tnum">{st.tickCount.toLocaleString()} ticks</span>}
        </div>

        <Button onClick={onOpen} variant="ghost" arrow className="mt-1 w-full">
          Open
        </Button>
      </Bezel>
    </motion.div>
  );
}
