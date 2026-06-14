// ─────────────────────────────────────────────────────────────────────────────
// flash/mirror-plan.ts — mirror sizing & diff, ported from the judge's
// flash-trade/examples-v2 copy-trade example. The hard-won rules it encodes:
//   • never copy raw size — scale by COLLATERAL RATIO and hard-cap it, or a
//     whale's $50k open becomes your liquidation;
//   • respect the $11 collateral floor (GOTCHAS §14): below it TP/SL placement
//     fails, and flooring collateral while keeping leader leverage would inflate
//     the position — so a too-small mirror is SKIPPED, not faked;
//   • diff only `basket` frames (GOTCHAS §7); a "0" close is a full close (§4).
// ─────────────────────────────────────────────────────────────────────────────
import type { V2OwnerSnapshot, V2Position } from "./v2.js";

/** examples-v2 RECOMMENDED_MIN_COLLATERAL_USD — the $11 rule (GOTCHAS §14). */
export const MIN_COLLATERAL_USD = 11;

export type MirrorKind = "OPEN" | "GROW" | "SHRINK" | "CLOSE";

export interface MirrorIntent {
  kind: MirrorKind;
  market: string;
  side: "LONG" | "SHORT";
  leaderSizeUsd: number;
  leaderCollateralUsd: number;
  leverage: number;
  mirrorUsd: number; // sized notional after ratio + cap
  mirrorCollateralUsd: number;
  skipped?: string; // reason, if below the floor
}

export interface DiffEvent {
  kind: MirrorKind;
  market: string;
  side: "LONG" | "SHORT";
  deltaUsd: number;
}

function leverageOf(p: V2Position): number {
  const lv = Number.parseFloat(p.leverageUi ?? "");
  if (lv > 0) return lv;
  const size = Number(p.sizeUsdUi);
  const col = Number(p.collateralUsdUi);
  return col > 0 ? size / col : 1;
}

function sideOf(p: V2Position): "LONG" | "SHORT" {
  return p.sideUi.toUpperCase().startsWith("S") ? "SHORT" : "LONG";
}

/** Collateral-ratio sizing with a hard cap — the judge's sizeFor(), never raw size. */
function sized(leaderSizeUsd: number, leverage: number, ratio: number, maxFollowUsd: number) {
  const mirrorUsd = Math.min(leaderSizeUsd * ratio, maxFollowUsd);
  const mirrorCollateralUsd = leverage > 0 ? mirrorUsd / leverage : mirrorUsd;
  return { mirrorUsd, mirrorCollateralUsd };
}

/**
 * Plan a fresh follow: every live leader position becomes an OPEN, sized to the
 * follower's collateral and capped. (A running follow uses diffBaskets instead.)
 */
export function planFreshMirror(
  snapshot: V2OwnerSnapshot,
  followerCollateralUsd: number,
  maxFollowUsd: number
): MirrorIntent[] {
  const positions = Object.values(snapshot.positionMetrics ?? {});
  const leaderCollateralTotal = positions.reduce((s, p) => s + Number(p.collateralUsdUi), 0);
  const ratio = leaderCollateralTotal > 0 ? followerCollateralUsd / leaderCollateralTotal : 0;

  return positions.map((p) => {
    const leverage = leverageOf(p);
    const leaderSizeUsd = Number(p.sizeUsdUi);
    const { mirrorUsd, mirrorCollateralUsd } = sized(leaderSizeUsd, leverage, ratio, maxFollowUsd);
    const intent: MirrorIntent = {
      kind: "OPEN",
      market: p.marketSymbol,
      side: sideOf(p),
      leaderSizeUsd,
      leaderCollateralUsd: Number(p.collateralUsdUi),
      leverage,
      mirrorUsd,
      mirrorCollateralUsd,
    };
    if (mirrorCollateralUsd < MIN_COLLATERAL_USD) {
      intent.skipped = `mirror collateral $${mirrorCollateralUsd.toFixed(2)} < $${MIN_COLLATERAL_USD} floor`;
    }
    return intent;
  });
}

/** diff two basket snapshots → OPEN/GROW/SHRINK/CLOSE (examples-v2 copy-trade). */
export function diffBaskets(prev: V2OwnerSnapshot | undefined, next: V2OwnerSnapshot): DiffEvent[] {
  const key = (p: V2Position) => `${p.marketSymbol}:${sideOf(p)}`;
  const before = new Map(Object.values(prev?.positionMetrics ?? {}).map((p) => [key(p), p]));
  const after = new Map(Object.values(next.positionMetrics ?? {}).map((p) => [key(p), p]));
  const out: DiffEvent[] = [];

  for (const [k, now] of after) {
    const was = before.get(k);
    const sizeNow = Number(now.sizeUsdUi);
    if (!was) {
      out.push({ kind: "OPEN", market: now.marketSymbol, side: sideOf(now), deltaUsd: sizeNow });
    } else {
      const d = sizeNow - Number(was.sizeUsdUi);
      if (Math.abs(d) > 0.01) {
        out.push({ kind: d > 0 ? "GROW" : "SHRINK", market: now.marketSymbol, side: sideOf(now), deltaUsd: Math.abs(d) });
      }
    }
  }
  for (const [k, was] of before) {
    if (!after.has(k)) out.push({ kind: "CLOSE", market: was.marketSymbol, side: sideOf(was), deltaUsd: Number(was.sizeUsdUi) });
  }
  return out;
}
