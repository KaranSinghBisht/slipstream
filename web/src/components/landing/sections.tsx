"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRightIcon,
  HandSwipeRightIcon,
  LightningIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { Bezel } from "@/components/ui/Bezel";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { HeroCandles } from "@/components/landing/HeroCandles";

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const ctaPrimary =
  "group inline-flex items-center gap-2 rounded-full bg-flash px-6 py-3 text-sm font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]";

function Arrow() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-px">
      <ArrowRightIcon size={14} weight="bold" />
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-24 pt-36 text-center">
      {/* candlestick field lining the base of the hero (full-bleed, behind content) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[34rem] w-screen -translate-x-1/2"
        style={{
          maskImage: "linear-gradient(to top, #000 0%, #000 14%, transparent 64%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 14%, transparent 64%)",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-60 px-2 opacity-80"
          style={{
            maskImage: "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent)",
          }}
        >
          <HeroCandles />
        </div>
      </div>

      {/* soft scrim so the candle field never fights the hero copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-20 z-[1] h-[24rem] w-full max-w-3xl -translate-x-1/2"
        style={{ background: "radial-gradient(ellipse 60% 52% at 50% 42%, rgba(5,5,7,0.92) 0%, rgba(5,5,7,0.55) 48%, transparent 76%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-tight text-muted ring-1 ring-line">
          <LightningIcon size={13} weight="fill" className="text-accent" />
          Built on Flash Trade × MagicBlock
        </span>
        <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.0] tracking-tight text-fg md:text-7xl">
          Draft the best traders on Flash.
          <br />
          <span className="text-gradient">Your guard lives on-chain.</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          An AI scout reads the live leaderboard, you approve the squad, and an autonomous trailing
          stop fires inside a MagicBlock rollup, 50ms after the tick.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className={ctaPrimary}>
            Launch app
            <Arrow />
          </Link>
          <a
            href="#how"
            className="rounded-full bg-white/[0.04] px-6 py-3 text-sm font-semibold tracking-tight text-fg ring-1 ring-line transition-colors hover:bg-white/[0.08]"
          >
            How it works
          </a>
        </div>
      </motion.div>

      <HeroPreview />
    </section>
  );
}

const STEPS = [
  { icon: <SlidersHorizontalIcon size={20} />, title: "Set your guardrails", body: "Market, budget, leverage ceiling, trailing stop. The agent only acts inside them." },
  { icon: <SparkleIcon size={20} weight="fill" />, title: "The AI scouts a squad", body: "Claude reads the live leaderboard and liquidation heatmap, proposes 3–5 leaders with reasoning." },
  { icon: <HandSwipeRightIcon size={20} />, title: "Swipe to approve", body: "Draft who you trust. Nothing trades until you say so — human-in-the-loop by design." },
  { icon: <ShieldCheckIcon size={20} weight="fill" />, title: "The guard runs on-chain", body: "Your mirrored position is delegated to a rollup where a trailing stop fires at tick speed." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-6 py-24">
      <Reveal>
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Copy trading you actually control.
        </h2>
      </Reveal>
      <div className="mt-12 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08} className="h-full">
            <Bezel
              className="group h-full transition-all duration-500 hover:-translate-y-1 hover:ring-1 hover:ring-accent/30"
              innerClassName="flex h-full flex-col gap-3 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent transition-colors group-hover:bg-accent/20">
                  {s.icon}
                </div>
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
              </div>
              <h3 className="text-base font-semibold tracking-tight text-fg">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </Bezel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const GUARD_STATS = [
  { v: "500ms", l: "crank cadence" },
  { v: "0", l: "client transactions" },
  { v: "~50ms", l: "Pyth Lazer feed" },
  { v: "63 / 31s", l: "autonomous ticks" },
];

export function Guard() {
  return (
    <section id="guard" className="mx-auto w-full max-w-6xl px-6 py-24">
      <Bezel className="glow-flash" innerClassName="flex flex-col gap-10 p-8 md:p-12">
        <Reveal className="flex max-w-2xl flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 text-sm text-accent">
            <LightningIcon size={16} weight="fill" /> The differentiator
          </span>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-fg md:text-5xl">
            The guard runs itself.
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            <span className="font-mono text-fg">check_trailing_stop</span> is scheduled inside the Ephemeral Rollup. It
            reads a 50ms Pyth feed on-chain, ratchets your stop, and fires a zero-fee protective close — every 500ms,
            with no keeper and no transactions from you. Proven on devnet.
          </p>
        </Reveal>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line lg:grid-cols-4">
          {GUARD_STATS.map((s, i) => (
            <Reveal key={s.l} delay={i * 0.06} className="bg-panel">
              <div className="flex flex-col gap-1 p-5">
                <span className="font-mono text-2xl font-semibold tracking-tight text-fg tnum md:text-3xl">{s.v}</span>
                <span className="text-xs uppercase tracking-wider text-faint">{s.l}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Bezel>
    </section>
  );
}

const TOOLS = ["leaders", "heatmap", "scout", "follow", "sessions", "status", "simulate_drawdown", "mirror_plan"];

export function Mcp() {
  return (
    <section id="mcp" className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[0.95fr_1.05fr]">
      <Reveal className="flex flex-col gap-5">
        <span className="inline-flex w-fit items-center gap-2 text-sm text-accent">
          <SparkleIcon size={16} weight="fill" /> Claude-native
        </span>
        <h2 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Watch it from Claude Code.
        </h2>
        <p className="text-lg leading-relaxed text-muted">
          Slipstream ships an MCP server, so Claude becomes your copy-trading copilot — scout, follow, and monitor your
          guarded vaults without leaving chat.
        </p>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <span key={t} className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-muted ring-1 ring-line">
              slipstream_{t}
            </span>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <Bezel className="glow-flash" innerClassName="flex flex-col gap-3 p-5 font-mono text-[13px] leading-relaxed">
          <div className="flex gap-1.5 pb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-short/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-long/70" />
          </div>
          <p className="text-muted"><span className="text-faint">$</span> claude mcp add slipstream -- npx tsx mcp/server.ts</p>
          <p className="text-accent">✓ slipstream connected · 8 tools</p>
          <p className="pt-2 text-fg">&quot;Scout SOL leaders for a $1k book, follow the top 3, and watch my guard.&quot;</p>
          <p className="text-muted">→ drafted 3 leaders · vault delegated · guard ON @500ms · −0.0% and holding</p>
        </Bezel>
      </Reveal>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Draft your squad. Keep your stop on-chain.
        </h2>
        <Link href="/app" className={ctaPrimary}>
          Launch app
          <Arrow />
        </Link>
        <p className="font-mono text-[11px] text-faint">
          live Flash leader data on mainnet · ER trailing-stop engine on devnet · built on MagicBlock Ephemeral Rollups
        </p>
      </div>
    </footer>
  );
}
