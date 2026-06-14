"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BroadcastIcon, LightningIcon, ShieldCheckIcon, TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { CandleChart, type PriceMark, type ChartEvent } from "@/components/CandleChart";
import { PnlChart } from "@/components/PnlChart";
import { TxFeed } from "@/components/TxFeed";
import { api } from "@/lib/api";
import { addr, compactUsd, price, signedPct, usd2 } from "@/lib/format";
import type { SessionInfo, VaultState } from "@/lib/types";

export function Dashboard({ session }: { session: SessionInfo }) {
  const [v, setV] = useState<VaultState | null>(null);
  const [stressing, setStressing] = useState(false);
  const [winning, setWinning] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);
  const [settleSig, setSettleSig] = useState<string | null>(null);
  const busy = useRef(false);

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

  // real trade-event markers from the tx feed — your mirror-in and the stop fire
  const events = useMemo<ChartEvent[]>(() => {
    if (!v) return [];
    const out: ChartEvent[] = [];
    const mirror = v.txs.find((t) => t.kind.toLowerCase() === "mirror");
    if (mirror) out.push({ time: mirror.ts, label: "You in", tone: "you" });
    if (v.stopFired) {
      const fire = [...v.txs].reverse().find((t) => ["stress", "crank"].includes(t.kind.toLowerCase()));
      const t = fire ?? v.txs[v.txs.length - 1];
      if (t) out.push({ time: t.ts, label: "Stop fired", tone: "stop" });
    }
    return out;
  }, [v?.txs, v?.stopFired]);

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

  async function runWin() {
    setWinning(true);
    try {
      setV(await api.win(session.session));
    } catch {
      /* surfaced by next poll */
    } finally {
      setWinning(false);
    }
  }

  async function runSettle() {
    setSettling(true);
    try {
      const r = await api.settle(session.session);
      setSettleSig(r.sig);
      setSettled(true);
    } catch {
      /* surfaced by next poll */
    } finally {
      setSettling(false);
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
            <div className={`flex items-center gap-4 rounded-lg p-4 ring-1 ${realizedPct >= 0 ? "bg-accent/10 ring-accent/30" : "bg-short/10 ring-short/30"}`}>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                  realizedPct >= 0 ? "bg-accent/15 text-accent" : "bg-short/15 text-short"
                }`}
              >
                <ShieldCheckIcon size={20} weight="fill" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold tracking-tight text-fg">
                  {realizedPct >= 0
                    ? "Trailing stop locked your gain on-chain."
                    : "Trailing stop fired on-chain. Downside capped."}
                </p>
                <p className="text-sm text-muted">
                  The guard closed your position autonomously at {price(v.lastPrice)}. Equity locked at{" "}
                  <span className="font-mono text-fg">{usd2(v.equityUsd)}</span> ({signedPct(realizedPct)}){" "}
                  {realizedPct >= 0 ? "while the leader gave the move back." : "while the leader kept riding it down."}
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
              <Metric label="Entry" value={v.entryPrice > 0 ? price(v.entryPrice) : "—"} />
              <Metric
                label="Stop"
                value={v.trailStop > 0 ? price(v.trailStop) : "—"}
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

          {/* the pro trading view: real candles + volume + entry/stop lines */}
          <Bezel innerClassName="p-4">
            <CandleChart market={v.market} height={300} marks={marks} events={events} />
          </Bezel>

          {/* the money shot: guarded vs held */}
          <Bezel innerClassName="p-5">
            <PnlChart
              samples={v.chart}
              firedAt={v.chartFiredAt}
              alloc={v.allocationUsd}
              note={v.stopFired ? (realizedPct >= 0 ? "winning replay" : "adverse replay") : "replay"}
            />
          </Bezel>

          <Bezel innerClassName="flex items-center justify-between gap-4 p-5">
            <div>
              {settled ? (
                <>
                  <p className="text-sm font-semibold tracking-tight text-accent">Settled on-chain.</p>
                  <p className="max-w-md text-xs leading-relaxed text-faint">
                    Vault committed to base and ownership returned to you — undelegated, guard stopped.{" "}
                    {settleSig && <span className="font-mono text-[10px] text-muted">{addr(settleSig, 6)}</span>}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold tracking-tight text-fg">Replay the guard</p>
                  <p className="max-w-md text-xs leading-relaxed text-faint">
                    Run a scripted price path on-chain via <span className="font-mono">apply_tick</span> — a winning move
                    where the stop ratchets up and locks your gain, or a drawdown where it caps your loss. Real
                    trailing-stop logic + Pyth read in the rollup; the curve is an illustrative replay.
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button onClick={runWin} disabled={winning || stressing || settled}>
                <TrendUpIcon size={16} weight="bold" />
                {winning ? "Running…" : "Replay a winning move"}
              </Button>
              <Button onClick={runStress} variant="danger" disabled={stressing || winning || settled}>
                <TrendDownIcon size={16} weight="bold" />
                {stressing ? "Replaying…" : "Replay drawdown"}
              </Button>
              <Button onClick={runSettle} variant="ghost" disabled={settling || settled}>
                <ShieldCheckIcon size={15} weight="fill" />
                {settling ? "Settling…" : settled ? "Settled" : "Close & settle"}
              </Button>
            </div>
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
