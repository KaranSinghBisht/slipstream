"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Backdrop } from "@/components/Backdrop";
import { Brand } from "@/components/Brand";
import { Stepper } from "@/components/Stepper";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Intake } from "@/screens/Intake";
import { Scout } from "@/screens/Scout";
import { Dashboard } from "@/screens/Dashboard";
import { api } from "@/lib/api";
import type { Constraints, SessionInfo } from "@/lib/types";

type Stage = "intake" | "scout" | "dashboard";
const STAGE_INDEX: Record<Stage, number> = { intake: 0, scout: 1, dashboard: 2 };

export default function AppPage() {
  const [stage, setStage] = useState<Stage>("intake");
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const sessionPromise = useRef<Promise<SessionInfo> | null>(null);

  function onIntake(c: Constraints) {
    setConstraints(c);
    const p = api.createSession(c).then((s) => {
      setSession(s);
      return s;
    });
    p.catch(() => undefined); // failures surfaced at deploy time
    sessionPromise.current = p;
    setStage("scout");
  }

  function ensureSession(): Promise<SessionInfo> {
    if (!sessionPromise.current) return Promise.reject(new Error("vault session not started"));
    return sessionPromise.current;
  }

  function reset() {
    sessionPromise.current = null;
    setSession(null);
    setConstraints(null);
    setStage("intake");
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <Backdrop />

      <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Brand />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <Stepper active={STAGE_INDEX[stage]} />
            </div>
            {stage !== "intake" && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-line transition-colors hover:text-fg"
              >
                <ArrowLeftIcon size={12} weight="bold" /> Restart
              </button>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 flex-col"
          >
            {stage === "intake" && <Intake onSubmit={onIntake} />}
            {stage === "scout" && constraints && (
              <Scout
                constraints={constraints}
                session={session}
                ensureSession={ensureSession}
                onDeployed={(s) => {
                  setSession(s);
                  setStage("dashboard");
                }}
              />
            )}
            {stage === "dashboard" && session && <Dashboard session={session} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-line/60 px-6 py-4">
        <p className="mx-auto max-w-6xl text-center font-mono text-[11px] text-faint">
          live Flash leader data on mainnet · ER trailing-stop engine on devnet · built on MagicBlock Ephemeral Rollups
        </p>
      </footer>
    </div>
  );
}
