"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "motion/react";
import { BroadcastIcon, LightningIcon, ShieldCheckIcon, TrendDownIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { CandleChart, type PriceMark } from "@/components/CandleChart";
import { PnlChart } from "@/components/PnlChart";
import { TxFeed } from "@/components/TxFeed";
import { api } from "@/lib/api";
import { addr, compactUsd, price, signedPct, usd2 } from "@/lib/format";
import type { SessionInfo, VaultState } from "@/lib/types";

export function Dashboard({ session }: { session: SessionInfo }) {
  const [v, setV] = useState<VaultState | null>(null);
  const [stressing, setStressing] = useState(false);
  const busy = useRef(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    let live = true;
    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        const next = await api.state(session.session);
        if (live) setV(next);
      } catch {
        /* transient ER read; keep last state */
      } finally {
        busy.current = false;
      }
    }
    void tick();
    const id = setInterval(tick, 1200);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [session.session]);

  const marks = useMemo<PriceMark[]>(() => {
    const out: PriceMark[] = [];
    if (v && v.entryPrice > 0) out.push({ price: v.entryPrice, color: "#8a90a0", title: "entry" });
    if (v && v.trailStop > 0) out.push({ price: v.trailStop, color: v.stopFired ? "#fb7185" : "#34d399", title: "stop" });
    return out;
  }, [v?.entryPrice, v?.trailStop, v?.stopFired]);

  async function runStress() {
    setStressing(true);
    try {
      setV(await api.stress(session.session));
    } catch {
      /* surfaced by next poll */
    } finally {
      setStressing(false);
    }
  }

  if (!v) return <DashboardSkeleton />;

  const isLong = v.side === "long";
  const open = v.qty !== 0 && !v.stopFired;
  const unrealUsd = open ? v.qty * (v.markPrice - v.entryPrice) : 0;
  const unrealPct = open && v.allocationUsd ? (unrealUsd / v.allocationUsd) * 100 : 0;
  const realizedUsd = v.equityUsd - v.allocationUsd;
  const realizedPct = v.allocationUsd ? (realizedUsd / v.allocationUsd) * 100 : 0;
  const bufferPct = v.trailStop > 0 ? ((v.markPrice - v.trailStop) / v.markPrice) * 100 * (isLong ? 1 : -1) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6">
      <AnimatePresence>
        {v.stopFired && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="mb-5"
          >
            <div className="flex items-center gap-4 rounded-lg bg-short/10 p-4 ring-1 ring-short/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-short/15 text-short">
                <ShieldCheckIcon size={20} weight="fill" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold tracking-tight text-fg">Trailing stop fired on-chain. Downside capped.</p>
                <p className="text-sm text-muted">
                  The guard closed your position autonomously at {price(v.lastPrice)}. Equity locked at{" "}
                  <span className="font-mono text-fg">{usd2(v.equityUsd)}</span> ({signedPct(realizedPct)}) while the
                  leader kept riding it down.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* position header */}
          <Bezel innerClassName="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    isLong ? "bg-long/12 text-long" : "bg-short/12 text-short"
                  }`}
                >
                  {v.market} {v.side}
                </span>
                <span className="font-mono text-xs text-faint">vault {addr(v.vault, 4)}</span>
                {publicKey && (
                  <span className="hidden font-mono text-xs text-faint sm:inline">· for {addr(publicKey.toBase58(), 4)}</span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted">
                <BroadcastIcon size={13} className="text-accent" /> {v.erUrl.replace(/^https?:\/\//, "").split(".")[0]}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-faint">Mark</div>
                <div className="font-mono text-4xl font-semibold tracking-tight text-fg tnum">{price(v.markPrice)}</div>
              </div>
              <Metric label="Entry" value={price(v.entryPrice)} />
              <Metric
                label="Stop"
                value={price(v.trailStop)}
                sub={v.stopFired ? "fired" : `${bufferPct.toFixed(2)}% away`}
                tone={v.stopFired ? "down" : undefined}
              />
              <Metric
                label={open ? "Unrealised" : "Realised"}
                value={signedPct(open ? unrealPct : realizedPct)}
                tone={(open ? unrealPct : realizedPct) >= 0 ? "up" : "down"}
              />
              <Metric label="Equity" value={usd2(v.equityUsd)} />
            </div>
          </Bezel>

          {/* the pro trading view: real candles + entry/stop lines */}
          <Bezel innerClassName="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs text-fg">
                {v.market}/USD <span className="text-faint">· 15m · live</span>
              </span>
              <span className="flex items-center gap-3 font-mono text-[10px] text-faint">
                <span className="flex items-center gap-1"><span className="h-px w-3 bg-[#8a90a0]" />entry</span>
                <span className="flex items-center gap-1">
                  <span className={`h-px w-3 ${v.stopFired ? "bg-short" : "bg-accent"}`} />stop
                </span>
              </span>
            </div>
            <CandleChart market={v.market} height={260} marks={marks} />
          </Bezel>

          {/* the money shot: guarded vs held */}
          <Bezel innerClassName="p-5">
            <PnlChart samples={v.chart} firedAt={v.chartFiredAt} alloc={v.allocationUsd} />
          </Bezel>

          <Bezel innerClassName="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold tracking-tight text-fg">Stress the guard</p>
              <p className="max-w-md text-xs leading-relaxed text-faint">
                Feeds an adverse path via on-chain <span className="font-mono">apply_tick</span> so you can watch the
                stop fire. The crank reads the real Pyth feed.
              </p>
            </div>
            <Button onClick={runStress} variant="danger" disabled={!open || stressing}>
              <TrendDownIcon size={16} weight="bold" />
              {stressing ? "Draining…" : "Simulate drawdown"}
            </Button>
          </Bezel>
        </div>

        <aside className="flex flex-col gap-4">
          <Bezel innerClassName="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-faint">Autonomous guard</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  v.crankActive ? "bg-accent/12 text-accent" : "bg-white/5 text-faint"
                }`}
              >
                <LightningIcon size={11} weight="fill" />
                {v.crankActive ? "guarding @500ms" : "idle"}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <motion.span
                key={v.tickCount}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-4xl font-semibold text-fg tnum"
              >
                {v.tickCount.toLocaleString()}
              </motion.span>
              <span className="pb-1.5 text-xs text-muted">on-chain ticks</span>
            </div>
            <p className="text-[11px] leading-relaxed text-faint">
              The ER runs <span className="font-mono">check_trailing_stop</span> itself. Zero client transactions.
            </p>
          </Bezel>

          <Bezel innerClassName="flex flex-col gap-2.5 p-5">
            <span className="text-xs font-medium uppercase tracking-wider text-faint">Mirrored squad</span>
            {v.followed.length === 0 && <p className="text-xs text-faint">no leaders mirrored</p>}
            {v.followed.map((f) => (
              <div key={f.owner} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted">{addr(f.owner, 5)}</span>
                <span className="font-mono text-accent tnum">{f.allocationPct}%</span>
              </div>
            ))}
          </Bezel>

          <Bezel innerClassName="p-5">
            <TxFeed txs={v.txs} />
          </Bezel>
        </aside>
      </div>

      <p className="mt-5 text-center font-mono text-[11px] text-faint">
        live Flash leader data (mainnet) · ER risk engine on devnet · notional {compactUsd(Math.abs(v.qty) * v.markPrice)}
      </p>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-long" : tone === "down" ? "text-short" : "text-fg";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`font-mono text-lg font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-faint tnum">{sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="h-32 animate-pulse rounded-xl bg-white/[0.03] ring-1 ring-line" />
          <div className="h-72 animate-pulse rounded-xl bg-white/[0.03] ring-1 ring-line" />
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-white/[0.03] ring-1 ring-line" />
      </div>
    </div>
  );
}
