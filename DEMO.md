# Demo runbook

A ~90-second walkthrough. The headline beat: a trailing stop **locking in a profit on-chain** (the
leader gives the move back), with a loss-capping beat as the encore. Everything runs on localhost —
there is no wallet to connect (the app uses a local demo account; the server's devnet burner signs
all on-chain actions).

## 0 · Pre-flight

```bash
# devnet burner funded (~0.1 SOL per session is plenty)
solana balance -k keypairs/burner-devnet.json --url devnet

pnpm api            # terminal 1 — wait for "sweep ok: N positions"
pnpm -C web dev     # terminal 2 — open http://localhost:3000
```

- Set `ANTHROPIC_API_KEY` in `.env` so the scout badge reads **"Claude Sonnet 4.6"** (without it the
  deterministic ranker runs and the badge reads "Heuristic").
- **Pre-warm:** do one full dry run first — it caches the Flash leaders and warms the ER, so the live
  "Deploy squad" is fast on the real take.
- **Safety net:** pre-deploy one vault so the portfolio has content and you can "Open" it instantly if
  a live deploy lags.
- Have **Claude Code open in `~/slipstream-demo`** for the MCP beat — a clean folder (one hidden
  `.mcp.json`) so the repo stays off-camera. Do one dry run first so the MCP trust prompt is already
  approved on the real take. Record the screen clean; add voiceover after.

## 1 · The path (~90s)

**Landing (0:00–0:10).** Hero + candlestick band → scroll past the live **markets ticker** and the
**"Watch it from Claude Code"** MCP section (the moat) → **Launch app**.

**Mandate (0:10–0:22).** Account chip top-right (`7xKQ…b9Yz · devnet`). Set **SOL · $1k**, toggle
**Risk** so the leverage + trail sliders snap to the profile.
> *"I set the rails — and the scout reads top traders across **all of Flash**; my guarded vault just
> runs on the market I pick."* → **Scout leaders**.

**Scout + draft (0:22–0:36).** The deck cards (strategy · notional · liquidation-buffer meter). **Tap
Draft** on ~3 (clear Pass/Draft labels), hover the **liquidation heatmap**. → **Analyse my 3 picks**
→ Scout report (**Claude Sonnet 4.6** badge + per-pick allocation %/$ + reasoning) → **Deploy squad**.

**The guard (0:36–0:48).** Vault delegated into the ER. Point at the **tick counter climbing @500ms**
+ "zero client transactions," the **candle chart** ("You in" marker), and the **ER tx feed** with real
signatures.
> *"My position's mirrored into a MagicBlock rollup, and the rollup runs my stop-loss itself — 500ms,
> on-chain, zero transactions from me."*

**💥 THE WIN money shot (0:48–1:04).** Click **Replay a winning move**. Both lines ride up together;
at the top your **green line locks** (stop-fired marker) while the **leader's red line gives the whole
move back into the red**. Banner: *"Trailing stop locked your gain on-chain."* **Freeze ~2s on:
You +20% · Leader −11%.**
> *"We both ride it up — but the leader has no stop. The trend reverses, my trailing stop locks the
> gain at the top: I bank twenty percent. The leader I copied gave the whole move back."*

**The protection side (1:04–1:12)** *(optional, strong).* On the **same vault**, just click **Replay
drawdown** — it re-arms the position automatically, no new squad needed → *"Trailing stop fired
on-chain. Downside capped."* You −2.7% vs Leader −9%.
> *"And when it goes against you, the same guard caps the loss. Win or lose, the chain protects you."*

**Portfolio + on-chain close (1:12–1:20).** Click the **account chip → "Your vaults"** (live equity,
ticks, guarding status). Open one → **Close & settle** → *"Settled on-chain · committed to base,
ownership returned"* + signature.
> *"It's a portfolio — run several squads, switch between them, and close any vault on-chain whenever;
> state commits back to base."*

**MCP flex + close (1:20–1:30).** Cut to a **clean terminal in `~/slipstream-demo`** (repo stays
off-camera) → `claude`. The `slipstream` server auto-loads its 8 tools; optionally flash
`claude mcp list` → `✓ connected`. Then ask:
*"Scout SOL leaders for a $1k conservative book, follow the top 3, and watch my guard."* — the tools
fire and return live answers (real scout→mirror→guard; the +20% replay stays on the website).
> Close on: *"AI scouts Flash. You approve. Your stop lives on-chain — and it banks your wins."*

## 2 · The one honesty rule (protects the score)

Keep these **separate** in narration — never conflate them:

- **Autonomous proof** = the **climbing tick counter** ("the chain runs my stop every 500ms, zero
  transactions") — real and live.
- **The replays** = labeled **"winning replay" / "adverse replay"** — "a scripted scenario so you can
  see it in seconds." The trailing-stop logic and the on-chain Pyth read are real; the price path is
  illustrative. Do **not** claim the autonomous crank caught it live.

## 3 · Staging + edit

- Let the lines ride **together ~2s** before the lock; **freeze ~2s on the gap** — that frame is the
  whole pitch.
- **Cold-open** on the frozen win frame (+20% / −11%) for ~3s, then jump to the landing — poses the
  hook ("how did *I* win?") and pays it off at the end.
- **Cut dead air:** the "Claude is analysing…" and "Provisioning ER vault…" waits.
- Lead with the **win** (feel-good, memorable); the drawdown is the "and it protects you too" beat.

## One-liner for the submission

> AI scouts the Flash leaderboard, you approve the squad, and an autonomous on-chain trailing stop
> guards your mirrored position inside a MagicBlock Ephemeral Rollup — locking gains and capping
> losses at tick speed. Operable end-to-end from Claude Code via an MCP server.

## Raw-engine B-roll (optional, the hardest-to-fake proof)

`pnpm test:crank` prints the autonomous loop from the program's side: it schedules the 500ms crank and
watches `tick_count` grow with **zero client transactions**, then commits to base. Two seconds of this
terminal cutaway answers any "is it really on-chain?" doubt.
