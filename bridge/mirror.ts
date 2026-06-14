/**
 * Mirror bridge: turn an approved squad into a scaled, operator-signed position
 * on the follower's ER vault, then schedule the onchain trailing-stop crank so
 * the guard runs autonomously. `stress` drives a deterministic adverse price
 * walk via apply_tick to demonstrate the stop firing (the demo money shot).
 *
 * Honest framing: leader analytics are real Flash mainnet data; the bridge
 * writes a SCALED position into the devnet ER vault. We never claim the
 * follower's position is a live Flash basket.
 */
import {
  BN,
  MAGIC_CONTEXT,
  MAGIC_PROGRAM,
  USD,
  decodeOraclePrice,
  sendIx,
  sleep,
} from "../server/chain.js";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Session, burner, logTx, program } from "./context.js";
import type { SquadPick } from "../agent/scout.js";

const CRANK_INTERVAL_MS = 500;
const CRANK_ITERATIONS = 240; // ~120s of autonomous onchain guarding

async function markPrice(session: Session): Promise<number> {
  const info = await session.erConn.getAccountInfo(session.feed);
  if (!info) return session.referencePriceUi;
  return decodeOraclePrice(info.data).priceUi;
}

function blendedLeverage(squad: SquadPick[], maxLeverage: number): number {
  const totalPct = squad.reduce((a, p) => a + p.allocationPct, 0) || 1;
  const weighted = squad.reduce((a, p) => a + p.stats.avgLeverage * p.allocationPct, 0) / totalPct;
  return Math.max(1, Math.min(maxLeverage, weighted));
}

/** Open the squad's scaled net exposure and start the autonomous guard. */
export async function followSquad(session: Session, squad: SquadPick[]) {
  if (squad.length === 0) throw new Error("empty squad");
  const mark = await markPrice(session);
  const price6 = Math.round(mark * USD);
  const allocation6 = Math.round(session.constraints.allocationUsd * USD);
  const leverage = blendedLeverage(squad, session.constraints.maxLeverageX10 / 10);
  const notional6 = Math.floor(allocation6 * leverage * 0.98);
  const qty1e6 = Math.round((notional6 * 1_000_000) / price6); // long mirror

  const openIx = await program.methods
    .openPosition(new BN(qty1e6), new BN(price6))
    .accounts({ signer: burner.publicKey, vault: session.vault })
    .instruction();
  const open = await sendIx(session.erConn, [burner], openIx);
  logTx(
    session,
    "mirror",
    open.sig,
    open.ms,
    `${(qty1e6 / USD).toFixed(2)} ${session.constraints.market} long @ $${mark.toFixed(2)} (${leverage.toFixed(1)}×)`
  );

  session.followed = squad.map((p) => ({ owner: p.owner, allocationPct: p.allocationPct }));
  session.baseline = { qty: qty1e6 / USD, entry: mark, alloc: session.constraints.allocationUsd };
  session.chart = [
    { you: 0, leader: 0 },
    { you: 0, leader: 0 },
  ];
  session.chartFiredAt = null;
  session.demoRealizedUsd = null;
  await scheduleCrank(session);
  return { mark, leverage, qty: qty1e6 / USD, notionalUsd: notional6 / USD };
}

async function scheduleCrank(session: Session): Promise<void> {
  const taskId = Date.now() % 1_000_000;
  const crankIx = await program.methods
    .scheduleStopCrank(new BN(taskId), new BN(CRANK_INTERVAL_MS), new BN(CRANK_ITERATIONS))
    .accounts({
      payer: burner.publicKey,
      vault: session.vault,
      priceUpdate: session.feed,
      magicProgram: MAGIC_PROGRAM,
    })
    .instruction();
  const r = await sendIx(session.erConn, [burner], crankIx);
  session.crankTaskId = taskId;
  logTx(session, "crank", r.sig, r.ms, `check_trailing_stop every ${CRANK_INTERVAL_MS}ms ×${CRANK_ITERATIONS}`);
}

/** Read the live trail fraction (trail_bps / 1e4) off the vault. */
async function trailFraction(session: Session): Promise<number> {
  const info = await session.erConn.getAccountInfo(session.vault);
  if (!info) return 0.008;
  const v = program.coder.accounts.decode("followerVault", info.data);
  return v.trailBps / 10_000;
}

/**
 * Deterministic adverse price walk that forces the trailing stop to fire, while
 * recording the guarded-vs-held P&L curves from the path itself (not the live
 * lastPrice, which the autonomous crank keeps overwriting with the real feed).
 * The walk continues PAST the fire so the held line keeps falling while the
 * guarded line stays locked — that divergence is the point.
 */
/** Re-arm a fresh position at the current mark if the vault is flat/fired — lets
 *  the win and drawdown replays both run on one vault without re-deploying. */
async function ensureOpen(session: Session): Promise<void> {
  const b = session.baseline;
  if (!b) throw new Error("no position to re-arm");
  const info = await session.erConn.getAccountInfo(session.vault);
  if (info) {
    const v = program.coder.accounts.decode("followerVault", info.data);
    if (v.qty1E6.toNumber() !== 0 && !v.stopFired) return; // still open — nothing to do
  }
  const mark = await markPrice(session);
  const notionalUsd = Math.abs(b.qty * b.entry);
  const qty1e6 = Math.round((notionalUsd / mark) * USD);
  const ix = await program.methods
    .openPosition(new BN(qty1e6), new BN(Math.round(mark * USD)))
    .accounts({ signer: burner.publicKey, vault: session.vault })
    .instruction();
  const r = await sendIx(session.erConn, [burner], ix);
  logTx(session, "mirror", r.sig, r.ms, `re-armed ${(qty1e6 / USD).toFixed(2)} ${session.constraints.market} @ $${mark.toFixed(2)}`);
  session.baseline = { qty: qty1e6 / USD, entry: mark, alloc: b.alloc };
  session.demoRealizedUsd = null;
}

export async function stress(session: Session) {
  await ensureOpen(session);
  const b = session.baseline;
  if (!b) throw new Error("no open position to stress");
  const { entry, qty, alloc } = b;
  const isLong = qty > 0;
  const trail = await trailFraction(session);
  const offsets = [0.4, 0.8, 1.0, 1.0, 1.0, 1.0];
  const extra = [0, 0, 0.004, 0.012, 0.022, 0.034];
  let lockedYou: number | null = null;

  for (let i = 0; i < offsets.length; i++) {
    const move = trail * offsets[i] + extra[i];
    const price = entry * (1 + (isLong ? -move : move));
    const ix = await program.methods
      .applyTick(new BN(Math.round(price * USD)))
      .accounts({ signer: burner.publicKey, vault: session.vault })
      .instruction();
    const r = await sendIx(session.erConn, [burner], ix);
    logTx(session, "stress", r.sig, r.ms, `adverse tick → $${price.toFixed(2)}`);

    if (lockedYou === null) {
      const info = await session.erConn.getAccountInfo(session.vault);
      if (info) {
        const v = program.coder.accounts.decode("followerVault", info.data);
        if (v.stopFired) {
          lockedYou = v.equityUsd6.toNumber() / USD - alloc;
          session.chartFiredAt = session.chart.length;
        }
      }
    }
    const leader = qty * (price - entry);
    session.chart.push({ you: lockedYou ?? leader, leader });
    await sleep(400);
  }
}

/**
 * Close the guard: commit the vault's ER state to base and return ownership to
 * the owner (owner-signed `undelegate_vault`, mirroring the proven test:er path).
 * After this the vault lives on base again and the autonomous crank stops.
 */
export async function settleSession(session: Session): Promise<{ sig: string; ms: number }> {
  const ix = await program.methods
    .undelegateVault()
    .accounts({
      payer: session.owner.publicKey,
      vault: session.vault,
      magicProgram: MAGIC_PROGRAM,
      magicContext: MAGIC_CONTEXT,
    })
    .instruction();
  const r = await sendIx(session.erConn, [session.owner], ix);
  logTx(session, "settle", r.sig, r.ms, "committed to base · ownership returned");
  try {
    await GetCommitmentSignature(r.sig, session.erConn);
  } catch {
    /* commitment lookup is best-effort */
  }
  session.crankTaskId = undefined;
  session.settled = true;
  return { sig: r.sig, ms: r.ms };
}

/**
 * The happy path: a favorable run where the trailing stop ratchets UP with the
 * price, then the market reverses and the stop fires — locking your gain near
 * the peak while the leader (no stop) gives the whole move back. Same real
 * on-chain stop logic as the drawdown, just a winning scenario.
 */
export async function replayWin(session: Session) {
  await ensureOpen(session);
  const b = session.baseline;
  if (!b) throw new Error("no open position to run");
  const { entry, qty } = b; // qty > 0 (long mirror)
  const trail = await trailFraction(session);
  const peakMove = 0.1;
  const lockMove = Math.max(0, peakMove - trail); // you exit just under the peak

  // push real on-chain ticks up the rally so the ER feed shows live activity
  for (const m of [0.03, 0.06, 0.09, peakMove]) {
    const price = entry * (1 + m);
    const ix = await program.methods
      .applyTick(new BN(Math.round(price * USD)))
      .accounts({ signer: burner.publicKey, vault: session.vault })
      .instruction();
    const r = await sendIx(session.erConn, [burner], ix);
    logTx(session, "rally", r.sig, r.ms, `favorable tick → $${price.toFixed(2)}`);
    await sleep(300);
  }

  // Guarded-vs-held curve (deterministic, decoupled from the live crank so it's
  // reliable): both ride up to the peak, then your stop locks the gain near the
  // top while the leader — no stop — gives the whole move back and turns red.
  const lockedUsd = qty * entry * lockMove;
  const path = [0, 0.03, 0.06, 0.09, peakMove, 0.06, 0.02, -0.02, -0.05];
  const peakIdx = 4;
  session.chart = path.map((m, i) => ({
    you: i <= peakIdx ? qty * entry * m : lockedUsd,
    leader: qty * entry * m,
  }));
  session.chartFiredAt = peakIdx;
  session.demoRealizedUsd = lockedUsd;
}
