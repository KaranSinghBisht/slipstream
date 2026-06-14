"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LightningIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { CandleChart } from "@/components/CandleChart";
import { api } from "@/lib/api";
import type { Constraints, Risk } from "@/lib/types";

const MARKETS = ["SOL", "BTC", "ETH"];
const RISKS: Risk[] = ["conservative", "balanced", "aggressive"];
const CHIPS = [500, 1000, 5000];
// Picking a risk profile sets sensible leverage + trail defaults (still tunable).
const RISK_PRESETS: Record<Risk, { lev: number; trail: number }> = {
  conservative: { lev: 2, trail: 0.5 },
  balanced: { lev: 3, trail: 0.8 },
  aggressive: { lev: 5, trail: 1.5 },
};

export function Intake({ onSubmit }: { onSubmit: (c: Constraints) => void }) {
  const [market, setMarket] = useState("SOL");
  const [allocationUsd, setAllocation] = useState(1000);
  const [leverageX, setLeverageX] = useState(3);
  const [trailPct, setTrailPct] = useState(0.8);
  const [risk, setRisk] = useState<Risk>("balanced");
  const [leaders, setLeaders] = useState<number | null>(null);

  useEffect(() => {
    api.health().then((h) => setLeaders(h.leaders)).catch(() => setLeaders(null));
  }, []);

  function submit() {
    if (allocationUsd <= 0) return;
    onSubmit({
      market,
      allocationUsd,
      maxLeverageX10: leverageX * 10,
      trailBps: Math.round(trailPct * 100),
      risk,
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-[1.05fr_1fr]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-6"
      >
        <span className="w-fit rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted ring-1 ring-line">
          Step 1 · Your mandate
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-fg md:text-6xl">
          Set your guardrails.<br />
          <span className="text-muted">The scout trades inside them.</span>
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted">
          The scout reads top traders across <span className="text-fg">all of Flash</span>, then drafts you a squad.
          Your mirrored position is guarded on the market you pick below — nothing moves until you approve it.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <ShieldCheckIcon size={16} className="text-accent" weight="fill" />
            On-chain trailing-stop guard
          </span>
          <span className="inline-flex items-center gap-2">
            <LightningIcon size={16} className="text-accent" weight="fill" />
            {leaders !== null ? `${leaders.toLocaleString()} leaders live on Flash` : "Indexing Flash…"}
          </span>
        </div>

        <Bezel innerClassName="p-4">
          <CandleChart market={market} height={200} />
        </Bezel>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      >
        <Bezel innerClassName="p-6 md:p-7">
          <div className="flex flex-col gap-6">
            <Segmented label="Guarded market" value={market} options={MARKETS} onChange={setMarket} />

            <div className="flex flex-col gap-2">
              <Label>Allocation</Label>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center rounded-xl bg-black/30 px-3 ring-1 ring-line focus-within:ring-accent/40">
                  <span className="text-muted">$</span>
                  <input
                    type="number"
                    min={1}
                    value={allocationUsd}
                    onChange={(e) => setAllocation(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent px-2 py-2.5 font-mono text-fg outline-none tnum"
                  />
                </div>
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAllocation(c)}
                    className={`rounded-lg px-2.5 py-2 text-xs font-medium ring-1 transition-colors ${
                      allocationUsd === c ? "bg-accent/15 text-accent ring-accent/30" : "text-muted ring-line hover:text-fg"
                    }`}
                  >
                    {c >= 1000 ? `${c / 1000}k` : c}
                  </button>
                ))}
              </div>
            </div>

            <Slider
              label="Max leverage"
              value={leverageX}
              display={`${leverageX}×`}
              min={1}
              max={10}
              step={1}
              onChange={setLeverageX}
            />
            <Slider
              label="Trailing stop"
              value={trailPct}
              display={`${trailPct.toFixed(2)}%`}
              min={0.25}
              max={3}
              step={0.05}
              onChange={setTrailPct}
            />

            <Segmented
              label="Risk tolerance"
              value={risk}
              options={RISKS}
              onChange={(v) => {
                const r = v as Risk;
                setRisk(r);
                setLeverageX(RISK_PRESETS[r].lev);
                setTrailPct(RISK_PRESETS[r].trail);
              }}
              capitalize
            />

            <Button onClick={submit} arrow className="mt-1 w-full" disabled={allocationUsd <= 0}>
              Scout leaders
            </Button>
          </div>
        </Bezel>
      </motion.div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wider text-faint">{children}</span>;
}

function Segmented({
  label,
  value,
  options,
  onChange,
  capitalize = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="grid grid-flow-col gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-line">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-lg px-3 py-2 text-sm font-medium tracking-tight transition-all duration-200 ${
              value === o ? "bg-accent text-[#04130d]" : "text-muted hover:text-fg"
            } ${capitalize ? "capitalize" : ""}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-sm text-accent tnum">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "#34d399" }}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10"
      />
    </div>
  );
}
