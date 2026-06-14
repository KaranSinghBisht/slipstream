# Demo runbook

A ~90-second walkthrough that lands the money shot: a trailing stop firing **on-chain** while the
leader keeps bleeding.

## Pre-flight

```bash
# devnet burner funded (~0.1 SOL per session is plenty)
solana balance -k keypairs/burner-devnet.json --url devnet

pnpm api            # terminal 1 — wait for "sweep ok: N positions"
pnpm -C web dev     # terminal 2 — open http://localhost:3000
```

Optional: set `ANTHROPIC_API_KEY` in `.env` to narrate with the live Fable scout (the badge reads
"Fable 5"); without it the deterministic ranker runs and the badge reads "Heuristic."

## Suggested framing

Split screen: **left** = flash.trade with one of the leaders' live positions open; **right** =
Slipstream. The story is "the leader holds; your guard acts."

## Script

1. **Screen 1 — Your mandate (0:00–0:15).** "Copy trading, but I'm in control." Set SOL, $1,000, 3×
   ceiling, 0.8% trailing stop, balanced. Point out the live leader count indexed from Flash.
   Click **Scout leaders**.

2. **Screen 2 — The squad (0:15–0:40).** The scout report appears with reasoning. "It scanned the
   live Flash leaderboard and proposed a squad — each pick justified by real notional, leverage and
   liquidation buffer." Hover the **liquidation heatmap**: "this is the analytics the agent reasons
   over — where leverage gets liquidated." Draft 2–3 leaders. Note the vault provisioning in the
   corner (it delegated into the ER while you were reading). Click **Deploy squad**.

3. **Screen 3 — The guard (0:40–1:30).** "My position is now live inside a MagicBlock Ephemeral
   Rollup." Point at the **Autonomous guard** counter climbing — "those are on-chain ticks; the ER
   is running `check_trailing_stop` itself every 500ms, zero transactions from me." Show the
   trailing-stop bar tracking the mark. Then click **Simulate drawdown**: the mark drops, the stop
   line holds, the mark crosses it — **the guard fires on-chain**, the banner drops: _downside
   capped, equity locked_. "The leader's still in it. I'm already out — decided on-chain, at tick
   speed."

## One-liner for the submission

> AI scouts the Flash leaderboard, you approve the squad, and an autonomous on-chain trailing stop
> guards your mirrored position inside a MagicBlock Ephemeral Rollup — firing 50ms after the tick.

## If you want to show the raw engine

`pnpm test:crank` prints the autonomous loop from the program's side: it schedules the 500ms crank
and watches `tick_count` grow with zero client transactions, then commits to base. Good B-roll.
