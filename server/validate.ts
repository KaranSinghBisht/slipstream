/** Boundary validation for all client-supplied input (security rule). */
import type { Constraints, Risk, SquadPick } from "../agent/scout.js";

const RISKS: Risk[] = ["conservative", "balanced", "aggressive"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateConstraints(input: any): Constraints {
  if (!input || typeof input !== "object") throw new Error("missing constraints");
  const market = String(input.market ?? "SOL").toUpperCase().slice(0, 8);
  const allocationUsd = Number(input.allocationUsd);
  const maxLeverageX10 = Math.round(Number(input.maxLeverageX10));
  const trailBps = Math.round(Number(input.trailBps));
  const risk: Risk = RISKS.includes(input.risk) ? input.risk : "balanced";
  if (!(allocationUsd > 0 && allocationUsd <= 1_000_000)) throw new Error("allocationUsd out of range");
  if (!(maxLeverageX10 >= 10 && maxLeverageX10 <= 1000)) throw new Error("maxLeverageX10 out of range");
  if (!(trailBps > 0 && trailBps < 10_000)) throw new Error("trailBps out of range");
  return { market, allocationUsd, maxLeverageX10, trailBps, risk };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateSquad(input: any): SquadPick[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("squad must be a non-empty array");
  if (input.length > 5) throw new Error("squad too large");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return input.map((p: any, i: number) => {
    if (!p || typeof p.owner !== "string") throw new Error(`squad[${i}] missing owner`);
    const allocationPct = Number(p.allocationPct);
    const avgLeverage = Number(p?.stats?.avgLeverage ?? 1);
    if (!(allocationPct >= 0 && allocationPct <= 100)) throw new Error(`squad[${i}] bad allocationPct`);
    return {
      owner: p.owner,
      allocationPct,
      role: typeof p.role === "string" ? p.role : "Core",
      reason: typeof p.reason === "string" ? p.reason : "",
      stats: {
        notionalUsd: Number(p?.stats?.notionalUsd ?? 0),
        avgLeverage: avgLeverage > 0 ? avgLeverage : 1,
        liqDistancePct: Number(p?.stats?.liqDistancePct ?? 0),
        positions: Number(p?.stats?.positions ?? 1),
      },
    };
  });
}
