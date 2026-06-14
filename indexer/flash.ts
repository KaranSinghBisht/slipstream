/**
 * Flash V1 position indexing: one getProgramAccounts sweep -> live positions,
 * per-owner leader stats, and liquidation-heatmap bins.
 */
import { Connection, PublicKey } from "@solana/web3.js";

export const FLASH_V1_PROGRAM = new PublicKey("FLASH6Lo6h3iasJKWDs2F8TkW2UKf3s15C8PMGuVfgBn");
const POSITION_DISC = Buffer.from([170, 188, 143, 228, 122, 64, 247, 208]);

export interface LivePosition {
  pubkey: string;
  owner: string;
  market: string;
  entryPriceUi: number;
  sizeUsd: number;
  collateralUsd: number;
  leverage: number;
  liqPriceUi: number;
  side: "long" | "short";
}

export interface LeaderStats {
  owner: string;
  positions: number;
  notionalUsd: number;
  collateralUsd: number;
  avgLeverage: number;
  markets: string[];
  liqDistancePct: number; // distance of nearest liq price from entry, %
}

export interface HeatmapBin {
  priceLow: number;
  priceHigh: number;
  notionalUsd: number;
  positions: number;
}

function readOraclePrice(buf: Buffer, off: number): number {
  const price = Number(buf.readBigUInt64LE(off));
  const expo = -Math.abs(buf.readInt32LE(off + 8));
  return price * Math.pow(10, expo);
}

export function decodePosition(pubkey: string, raw: Buffer): LivePosition | null {
  const sizeUsd = Number(raw.readBigUInt64LE(140)) / 1e6;
  if (sizeUsd <= 0) return null;
  const collateralUsd = Number(raw.readBigUInt64LE(172)) / 1e6;
  const entryPriceUi = readOraclePrice(raw, 120);
  const leverage = collateralUsd > 0 ? sizeUsd / collateralUsd : 0;
  // Without custody maintenance params, approximate: full-loss-of-collateral
  // price move = entry / leverage; flag long/short via market metadata later
  // (v0 treats every position as long for binning and labels it approx).
  const movePct = leverage > 0 ? 1 / leverage : 1;
  const liqPriceUi = entryPriceUi * (1 - 0.9 * movePct);
  return {
    pubkey,
    owner: new PublicKey(raw.subarray(8, 40)).toBase58(),
    market: new PublicKey(raw.subarray(40, 72)).toBase58(),
    entryPriceUi,
    sizeUsd,
    collateralUsd,
    leverage,
    liqPriceUi,
    side: "long",
  };
}

export async function fetchLivePositions(conn: Connection): Promise<LivePosition[]> {
  const accounts = await conn.getProgramAccounts(FLASH_V1_PROGRAM, {
    filters: [{ memcmp: { offset: 0, bytes: POSITION_DISC.toString("base64"), encoding: "base64" } }],
  });
  const live: LivePosition[] = [];
  for (const { pubkey, account } of accounts) {
    const p = decodePosition(pubkey.toBase58(), account.data as Buffer);
    if (p) live.push(p);
  }
  return live;
}

export function buildLeaderboard(positions: LivePosition[]): LeaderStats[] {
  const byOwner = new Map<string, LivePosition[]>();
  for (const p of positions) {
    const list = byOwner.get(p.owner) ?? [];
    list.push(p);
    byOwner.set(p.owner, list);
  }
  const leaders: LeaderStats[] = [];
  for (const [owner, list] of byOwner) {
    const notionalUsd = list.reduce((a, p) => a + p.sizeUsd, 0);
    const collateralUsd = list.reduce((a, p) => a + p.collateralUsd, 0);
    const liqDistancePct = Math.min(
      ...list.map((p) =>
        p.entryPriceUi > 0 ? Math.abs(p.entryPriceUi - p.liqPriceUi) / p.entryPriceUi : 1
      )
    );
    leaders.push({
      owner,
      positions: list.length,
      notionalUsd,
      collateralUsd,
      avgLeverage: collateralUsd > 0 ? notionalUsd / collateralUsd : 0,
      markets: [...new Set(list.map((p) => p.market))],
      liqDistancePct: Math.round(liqDistancePct * 1000) / 10,
    });
  }
  return leaders.sort((a, b) => b.notionalUsd - a.notionalUsd);
}

/** Bin liquidation prices (as % distance from entry) into a heatmap. */
export function buildHeatmap(positions: LivePosition[], bins = 20): HeatmapBin[] {
  const pts = positions
    .filter((p) => p.entryPriceUi > 0)
    .map((p) => ({
      distPct: ((p.entryPriceUi - p.liqPriceUi) / p.entryPriceUi) * 100,
      notional: p.sizeUsd,
    }))
    .filter((p) => p.distPct >= 0 && p.distPct <= 100);
  const out: HeatmapBin[] = [];
  const step = 100 / bins;
  for (let i = 0; i < bins; i++) {
    const lo = i * step;
    const hi = lo + step;
    const inBin = pts.filter((p) => p.distPct >= lo && p.distPct < hi);
    out.push({
      priceLow: Math.round(lo * 10) / 10,
      priceHigh: Math.round(hi * 10) / 10,
      notionalUsd: Math.round(inBin.reduce((a, p) => a + p.notional, 0)),
      positions: inBin.length,
    });
  }
  return out;
}
