/**
 * ER session lifecycle: fund a fresh follower owner, initialise their vault
 * from the risk constraints, delegate it into the Ephemeral Rollup, and read
 * live vault state back. Mirrors the proven test flow (tests/oracle-crank.ts).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  BN,
  ER_FALLBACK,
  FEEDS,
  USD,
  decodeOraclePrice,
  fundFreshOwner,
  getDelegationStatus,
  sendIx,
  sleep,
} from "../server/chain.js";
import {
  Session,
  baseConn,
  burner,
  logTx,
  newSessionId,
  program,
  programId,
  putSession,
} from "./context.js";
import type { Constraints } from "../agent/scout.js";

const VAULT_SEED = Buffer.from("vault");

function feedFor(market: string): { key: PublicKey; market: string } {
  const m = (market || "SOL").toUpperCase();
  return { key: FEEDS[m] ?? FEEDS.SOL, market: FEEDS[m] ? m : "SOL" };
}

export async function startSession(c: Constraints): Promise<Session> {
  const { key: feed, market } = feedFor(c.market);
  const owner = await fundFreshOwner(baseConn, burner, 0.05);
  const [vault] = PublicKey.findProgramAddressSync([VAULT_SEED, owner.publicKey.toBuffer()], programId);

  const initIx = await program.methods
    .initVault(
      new BN(Math.round(c.allocationUsd * USD)),
      c.maxLeverageX10,
      c.trailBps,
      burner.publicKey,
      feed
    )
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], initIx);

  const delegateIx = await program.methods
    .delegateVault(null)
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], delegateIx);

  await sleep(3000);
  const status = await getDelegationStatus(vault);
  if (!status.isDelegated) throw new Error("vault did not delegate into the ER");
  const erUrl = status.fqdn ?? ER_FALLBACK;
  const erConn = new Connection(erUrl, "confirmed");

  const feedInfo = await erConn.getAccountInfo(feed);
  if (!feedInfo) throw new Error("price feed not found on ER");
  const { priceUi } = decodeOraclePrice(feedInfo.data);

  const session: Session = {
    id: newSessionId(),
    owner,
    vault,
    feed,
    erConn,
    erUrl,
    constraints: { ...c, market },
    referencePriceUi: priceUi,
    followed: [],
    txs: [],
  };
  logTx(session, "delegate", "—", 0, `vault delegated → ${shortUrl(erUrl)}`);
  putSession(session);
  return session;
}

async function readMark(session: Session): Promise<number> {
  const info = await session.erConn.getAccountInfo(session.feed);
  if (!info) return session.referencePriceUi;
  return decodeOraclePrice(info.data).priceUi;
}

export async function getVaultState(session: Session) {
  let info = await session.erConn.getAccountInfo(session.vault);
  let layer: "ER" | "base" = "ER";
  if (!info) {
    info = await baseConn.getAccountInfo(session.vault);
    layer = "base";
  }
  if (!info) throw new Error("vault account not found");
  const v = program.coder.accounts.decode("followerVault", info.data);
  const mark = await readMark(session);
  const qty = num(v.qty1E6) / USD;
  return {
    sessionId: session.id,
    owner: session.owner.publicKey.toBase58(),
    vault: session.vault.toBase58(),
    feed: session.feed.toBase58(),
    market: session.constraints.market,
    erUrl: session.erUrl,
    layer,
    allocationUsd: num(v.allocationUsd6) / USD,
    maxLeverage: v.maxLeverageX10 / 10,
    trailBps: v.trailBps,
    equityUsd: num(v.equityUsd6) / USD,
    qty,
    side: qty > 0 ? "long" : qty < 0 ? "short" : "flat",
    entryPrice: num(v.entryPrice1E6) / USD,
    peakPrice: num(v.peakPrice1E6) / USD,
    trailStop: num(v.trailStopPrice1E6) / USD,
    lastPrice: num(v.lastPrice1E6) / USD,
    markPrice: mark,
    stopFired: v.stopFired,
    tickCount: num(v.tickCount),
    crankActive: session.crankTaskId !== undefined && !v.stopFired,
    followed: session.followed,
    txs: session.txs,
  };
}

function num(bn: { toNumber: () => number }): number {
  return bn.toNumber();
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").split(".")[0];
}
