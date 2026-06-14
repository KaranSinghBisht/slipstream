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
  MAGIC_PROGRAM,
  USD,
  decodeOraclePrice,
  sendIx,
  sleep,
} from "../server/chain.js";
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

/** Read entry + side off the vault so the stress walk crosses the real stop. */
async function positionContext(session: Session) {
  const info = await session.erConn.getAccountInfo(session.vault);
  if (!info) throw new Error("vault not found on ER");
  const v = program.coder.accounts.decode("followerVault", info.data);
  const qty = v.qty1E6.toNumber();
  if (qty === 0) throw new Error("no open position to stress");
  return { entry: v.entryPrice1E6.toNumber() / USD, isLong: qty > 0, trail: v.trailBps / 10_000 };
}

/** Deterministic adverse price walk that forces the trailing stop to fire. */
export async function stress(session: Session) {
  const { entry, isLong, trail } = await positionContext(session);
  const dirs = isLong
    ? [-trail * 0.5, -trail * 0.95, -(trail + 0.006), -(trail + 0.018)]
    : [trail * 0.5, trail * 0.95, trail + 0.006, trail + 0.018];

  for (let i = 0; i < dirs.length; i++) {
    const price = entry * (1 + dirs[i]);
    const ix = await program.methods
      .applyTick(new BN(Math.round(price * USD)))
      .accounts({ signer: burner.publicKey, vault: session.vault })
      .instruction();
    const r = await sendIx(session.erConn, [burner], ix);
    logTx(session, "stress", r.sig, r.ms, `adverse tick → $${price.toFixed(2)}`);
    await sleep(450);
    const after = await session.erConn.getAccountInfo(session.vault);
    if (after) {
      const v = program.coder.accounts.decode("followerVault", after.data);
      if (v.stopFired) break;
    }
  }
}
