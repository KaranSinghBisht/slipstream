"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { SparkleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { Button } from "@/components/ui/Button";
import { LeaderCard } from "@/components/LeaderCard";
import { Heatmap } from "@/components/Heatmap";
import { api } from "@/lib/api";
import { addr } from "@/lib/format";
import type { Constraints, HeatmapBin, ScoutResult, SessionInfo } from "@/lib/types";

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
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [bins, setBins] = useState<HeatmapBin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([api.scout(constraints), api.heatmap()])
      .then(([r, h]) => {
        if (!live) return;
        setResult(r);
        setBins(h);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [constraints]);

  const picks = useMemo(() => result?.squad.filter((p) => approved.has(p.owner)) ?? [], [result, approved]);

  function toggle(owner: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(owner)) next.delete(owner);
      else next.add(owner);
      return next;
    });
  }

  async function deploy() {
    if (picks.length === 0) return;
    setDeploying(true);
    setError(null);
    try {
      const s = await ensureSession();
      await api.follow(s.session, picks);
      onDeployed(s);
    } catch (e) {
      setError((e as Error).message);
      setDeploying(false);
    }
  }

  if (error && !result) return <ErrorState message={error} />;
  if (!result) return <LoadingState />;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Bezel innerClassName="flex items-start gap-4 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <SparkleIcon size={18} weight="fill" />
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-fg">Scout report</span>
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line">
                {result.mode === "fable" ? "Fable 5" : "Heuristic"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{result.summary}</p>
          </div>
        </Bezel>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_330px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.squad.map((pick, i) => (
            <LeaderCard
              key={pick.owner}
              pick={pick}
              index={i}
              approved={approved.has(pick.owner)}
              onToggle={() => toggle(pick.owner)}
            />
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Bezel innerClassName="p-5">
            <Heatmap bins={bins} />
          </Bezel>

          <Bezel innerClassName="flex flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold tracking-tight text-fg">Your squad</span>
              <span className="font-mono text-sm text-accent tnum">{picks.length} drafted</span>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Draft the leaders you trust. Slipstream mirrors their net exposure into your ER vault,
              scaled to your ${constraints.allocationUsd.toLocaleString()} at ≤
              {(constraints.maxLeverageX10 / 10).toFixed(1)}× — then guards it on-chain.
            </p>
            <SessionLine session={session} />
            {error && <p className="text-xs text-short">{error}</p>}
            <Button onClick={deploy} arrow disabled={picks.length === 0 || deploying} className="w-full">
              {deploying ? "Deploying to ER…" : "Deploy squad"}
            </Button>
          </Bezel>
        </aside>
      </div>
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="h-20 animate-pulse rounded-3xl bg-white/[0.03] ring-1 ring-line" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/[0.03] ring-1 ring-line" />
        ))}
      </div>
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
