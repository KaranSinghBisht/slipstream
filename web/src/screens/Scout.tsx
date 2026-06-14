"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeftIcon,
  GaugeIcon,
  ShieldIcon,
  SparkleIcon,
  SpinnerGapIcon,
  StackIcon,
  TrendUpIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { SwipeDeck } from "@/components/SwipeDeck";
import { Heatmap } from "@/components/Heatmap";
import { api } from "@/lib/api";
import { addr, compactUsd, pct } from "@/lib/format";
import type { Constraints, HeatmapBin, LeaderStats, ScoutResult, SessionInfo, SquadPick } from "@/lib/types";

const MODEL_NAMES: Record<string, string> = {
  "claude-fable-5": "Fable 5",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-8": "Claude Opus 4.8",
};
const prettyModel = (m?: string) => (m ? (MODEL_NAMES[m] ?? "Claude") : "Heuristic");

type Stage = "deck" | "analyzing" | "squad";

export function Scout({
  constraints,
  session,
  ensureSession,
  onDeployed,
}: {
  constraints: Constraints;
  session: SessionInfo | null;
  ensureSession: () => Promise<SessionInfo>;
  onDeployed: (s: SessionInfo) => void;
}) {
  const [stage, setStage] = useState<Stage>("deck");
  const [candidates, setCandidates] = useState<LeaderStats[] | null>(null);
  const [bins, setBins] = useState<HeatmapBin[]>([]);
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    let live = true;
    // Candidates are ranked by the follower's risk tolerance — conservative
    // surfaces high-buffer / low-leverage books, aggressive surfaces conviction.
    Promise.all([api.candidates(constraints), api.heatmap()])
      .then(([ls, h]) => {
        if (!live) return;
        setCandidates(ls.slice(0, 10));
        setBins(h);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [constraints.market, constraints.allocationUsd, constraints.maxLeverageX10, constraints.trailBps, constraints.risk]);

  async function onSwiped(kept: string[]) {
    setStage("analyzing");
    setError(null);
    try {
      setResult(await api.analyze(constraints, kept));
      setStage("squad");
    } catch (e) {
      setError((e as Error).message);
      setStage("deck");
    }
  }

  async function deploy() {
    if (!result) return;
    setDeploying(true);
    setError(null);
    try {
      const s = await ensureSession();
      await api.follow(s.session, result.squad);
      onDeployed(s);
    } catch (e) {
      setError((e as Error).message);
      setDeploying(false);
    }
  }

  if (error && !candidates) return <ErrorState message={error} />;
  if (!candidates) return <LoadingState />;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      {stage === "deck" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-fg">Draft your squad.</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Swipe right to keep a leader, left to pass. Fable analyses the ones you keep and sizes them.
              </p>
            </div>
            <SwipeDeck leaders={candidates} onComplete={onSwiped} />
            {error && <p className="text-xs text-short">{error}</p>}
          </div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <Bezel innerClassName="p-5">
              <Heatmap bins={bins} />
            </Bezel>
            <Bezel innerClassName="flex flex-col gap-2 p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-faint">Your mandate</span>
              <p className="text-xs leading-relaxed text-muted">
                ${constraints.allocationUsd.toLocaleString()} on {constraints.market} at ≤
                {(constraints.maxLeverageX10 / 10).toFixed(1)}×, {(constraints.trailBps / 100).toFixed(2)}% trail,{" "}
                {constraints.risk}.
              </p>
              <SessionLine session={session} />
            </Bezel>
          </aside>
        </div>
      )}

      {stage === "analyzing" && <Analyzing />}

      {stage === "squad" && result && (
        <SquadStage
          result={result}
          bins={bins}
          session={session}
          deploying={deploying}
          error={error}
          constraints={constraints}
          onDeploy={deploy}
          onBack={() => {
            setResult(null);
            setStage("deck");
          }}
        />
      )}
    </div>
  );
}

function Analyzing() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent"
      >
        <SparkleIcon size={22} weight="fill" />
      </motion.span>
      <p className="text-sm font-semibold tracking-tight text-fg">Fable is analysing your picks…</p>
      <p className="max-w-sm text-sm text-muted">Reading their live positions, leverage, and the liquidation heatmap to size your squad.</p>
    </div>
  );
}

function SquadStage({
  result,
  bins,
  session,
  deploying,
  error,
  constraints,
  onDeploy,
  onBack,
}: {
  result: ScoutResult;
  bins: HeatmapBin[];
  session: SessionInfo | null;
  deploying: boolean;
  error: string | null;
  constraints: Constraints;
  onDeploy: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg">
        <ArrowLeftIcon size={12} weight="bold" /> back to deck
      </button>

      <Bezel innerClassName="flex items-start gap-4 p-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
          <SparkleIcon size={18} weight="fill" />
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-fg">Scout report</span>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line">
              {prettyModel(result.model)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted">{result.summary}</p>
        </div>
      </Bezel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.squad.map((p, i) => (
            <PickCard key={p.owner} pick={p} index={i} allocationUsd={constraints.allocationUsd} />
          ))}
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Bezel innerClassName="p-5">
            <Heatmap bins={bins} />
          </Bezel>
          <Bezel innerClassName="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold tracking-tight text-fg">Deploy squad</span>
              <span className="font-mono text-sm text-accent tnum">{result.squad.length} leaders</span>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Slipstream mirrors their net exposure into your ER vault, scaled to your $
              {constraints.allocationUsd.toLocaleString()}, then guards it on-chain.
            </p>
            <SessionLine session={session} />
            {error && <p className="text-xs text-short">{error}</p>}
            <Button onClick={onDeploy} arrow disabled={deploying} className="w-full">
              {deploying ? "Deploying to ER…" : "Deploy squad"}
            </Button>
          </Bezel>
        </aside>
      </div>
    </div>
  );
}

function PickCard({ pick, index, allocationUsd }: { pick: SquadPick; index: number; allocationUsd: number }) {
  const size = Math.round((pick.allocationPct / 100) * allocationUsd);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <Bezel innerClassName="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-accent/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              {pick.role}
            </span>
            <span className="font-mono text-sm text-fg">{addr(pick.owner, 5)}</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-fg tnum">{pick.allocationPct}%</div>
            <div className="font-mono text-[10px] text-faint tnum">${size.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Mini icon={<TrendUpIcon size={14} />} value={compactUsd(pick.stats.notionalUsd)} />
          <Mini icon={<GaugeIcon size={14} />} value={`${pick.stats.avgLeverage.toFixed(1)}×`} />
          <Mini icon={<ShieldIcon size={14} />} value={pct(pick.stats.liqDistancePct, 0)} />
          <Mini icon={<StackIcon size={14} />} value={`${pick.stats.positions}`} />
        </div>
        <p className="text-sm leading-relaxed text-muted">{pick.reason}</p>
      </Bezel>
    </motion.div>
  );
}

function Mini({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted">{icon}</span>
      <span className="font-mono text-sm text-fg tnum">{value}</span>
    </div>
  );
}

function SessionLine({ session }: { session: SessionInfo | null }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs ring-1 ring-line">
      {session ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring" />
          <span className="text-muted">Vault</span>
          <span className="font-mono text-fg">{addr(session.vault, 4)}</span>
          <span className="ml-auto text-faint">live on ER</span>
        </>
      ) : (
        <>
          <SpinnerGapIcon size={13} className="animate-spin text-muted" />
          <span className="text-muted">Provisioning ER vault…</span>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 px-6 py-20">
      <div className="h-[400px] w-full animate-pulse rounded-3xl bg-white/[0.03] ring-1 ring-line" />
      <div className="h-12 w-32 animate-pulse rounded-full bg-white/[0.03] ring-1 ring-line" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-20">
      <Bezel innerClassName="flex flex-col items-center gap-3 p-8 text-center">
        <WarningCircleIcon size={28} className="text-short" />
        <p className="text-sm text-fg">Could not reach the scout.</p>
        <p className="font-mono text-xs text-faint">{message}</p>
        <p className="text-xs text-muted">Start the backend with `pnpm api`, then reload.</p>
      </Bezel>
    </div>
  );
}
