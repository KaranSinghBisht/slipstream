/**
 * Fable-powered scout: reads live Flash leader analytics + the follower's
 * constraints, proposes a squad of 3–5 leaders with per-leader reasoning.
 * Uses the Claude (Fable) API when ANTHROPIC_API_KEY is set; otherwise falls
 * back to a deterministic ranker so the product always works.
 */

export type Risk = "conservative" | "balanced" | "aggressive";

export interface Constraints {
  market: string;
  allocationUsd: number;
  maxLeverageX10: number;
  trailBps: number;
  risk: Risk;
}

export interface LeaderLike {
  owner: string;
  positions: number;
  notionalUsd: number;
  avgLeverage: number;
  liqDistancePct: number;
  markets: string[];
}

export interface SquadPick {
  owner: string;
  allocationPct: number;
  role: string;
  reason: string;
  stats: { notionalUsd: number; avgLeverage: number; liqDistancePct: number; positions: number };
}

export interface ScoutResult {
  mode: "fable" | "rule";
  summary: string;
  squad: SquadPick[];
}

const SCOUT_MODEL = process.env.SCOUT_MODEL ?? "claude-fable-5";
const ROLES = ["Anchor", "Core", "Core", "Satellite", "Hedge"];
const MIN_NOTIONAL = 10_000; // skip dust books unless the pool is thin

export async function scoutSquad(
  leaders: LeaderLike[],
  constraints: Constraints
): Promise<ScoutResult> {
  const ranked = rankLeaders(leaders, constraints).slice(0, 12);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await fableSquad(ranked, constraints);
    } catch (err) {
      process.stderr.write(`[scout] fable fallback: ${(err as Error).message}\n`);
    }
  }
  return ruleBasedSquad(ranked, constraints);
}

function riskWeights(risk: Risk): { conviction: number; safety: number; discipline: number } {
  if (risk === "conservative") return { conviction: 0.25, safety: 0.5, discipline: 0.25 };
  if (risk === "aggressive") return { conviction: 0.55, safety: 0.15, discipline: 0.3 };
  return { conviction: 0.4, safety: 0.35, discipline: 0.25 };
}

/** 0..1 score blending book conviction, liquidation safety, leverage discipline. */
function scoreLeader(l: LeaderLike, c: Constraints): number {
  const w = riskWeights(c.risk);
  const conviction = Math.min(1, Math.log10(Math.max(10, l.notionalUsd)) / 6); // ~$1M → 1.0
  const safety = Math.min(1, l.liqDistancePct / 50); // 50%+ away → fully safe
  const userMax = c.maxLeverageX10 / 10;
  const over = Math.max(0, l.avgLeverage - userMax);
  const discipline = 1 / (1 + over * 0.4); // penalize leverage above the follower's ceiling
  return w.conviction * conviction + w.safety * safety + w.discipline * discipline;
}

function rankLeaders(leaders: LeaderLike[], c: Constraints): LeaderLike[] {
  const live = leaders.filter((l) => l.notionalUsd > 0 && l.positions > 0);
  const serious = live.filter((l) => l.notionalUsd >= MIN_NOTIONAL);
  const pool = serious.length >= 5 ? serious : live;
  return [...pool].sort((a, b) => scoreLeader(b, c) - scoreLeader(a, c));
}

function allocate(scores: number[]): number[] {
  const total = scores.reduce((a, s) => a + s, 0) || 1;
  const raw = scores.map((s) => (s / total) * 100);
  const floored = raw.map((r) => Math.max(8, Math.floor(r)));
  let drift = 100 - floored.reduce((a, r) => a + r, 0);
  for (let i = 0; drift !== 0; i = (i + 1) % floored.length) {
    floored[i] += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
  }
  return floored;
}

function reasonFor(l: LeaderLike, role: string): string {
  const notional = `$${Math.round(l.notionalUsd).toLocaleString()}`;
  const lev = `${l.avgLeverage.toFixed(1)}×`;
  const liq = `${l.liqDistancePct.toFixed(0)}%`;
  const book = l.positions === 1 ? "one conviction position" : `${l.positions} positions`;
  if (role === "Anchor")
    return `${notional} book at ${lev} with ${book} — nearest liquidation ${liq} away, outside a normal daily move. Your anchor allocation.`;
  if (role === "Hedge")
    return `Runs ${lev} across ${book}; liquidation only ${liq} out, so a small, ring-fenced slice to capture upside without leaning on it.`;
  if (role === "Satellite")
    return `${notional} at ${lev} — a satellite tilt; ${liq} liquidation buffer keeps the copied risk inside your trail.`;
  return `${notional} deployed at ${lev}, ${liq} from liquidation — disciplined sizing that fits your ceiling. Core of the squad.`;
}

function ruleBasedSquad(ranked: LeaderLike[], c: Constraints): ScoutResult {
  const picks = ranked.slice(0, Math.min(4, ranked.length));
  const allocations = allocate(picks.map((l) => scoreLeader(l, c)));
  const squad = picks.map((l, i) => ({
    owner: l.owner,
    allocationPct: allocations[i],
    role: ROLES[i] ?? "Core",
    reason: reasonFor(l, ROLES[i] ?? "Core"),
    stats: {
      notionalUsd: Math.round(l.notionalUsd),
      avgLeverage: Number(l.avgLeverage.toFixed(2)),
      liqDistancePct: Number(l.liqDistancePct.toFixed(1)),
      positions: l.positions,
    },
  }));
  const summary =
    `Scanned ${ranked.length} live Flash books for a ${c.risk} ${c.market} mandate at ` +
    `≤${(c.maxLeverageX10 / 10).toFixed(1)}× with a ${(c.trailBps / 100).toFixed(2)}% trail. ` +
    `Selected ${squad.length} leaders weighted toward ${
      c.risk === "conservative" ? "liquidation safety" : c.risk === "aggressive" ? "book conviction" : "balanced edge"
    }.`;
  return { mode: "rule", summary, squad };
}

async function fableSquad(ranked: LeaderLike[], c: Constraints): Promise<ScoutResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: SCOUT_MODEL,
        max_tokens: 1200,
        system:
          "You are a perps copy-trading scout. Given live Flash Trade leader analytics and a " +
          "follower's risk constraints, pick a squad of 3–5 leaders to copy. Respect the leverage " +
          "ceiling and risk tolerance. Reply with ONLY a JSON object: " +
          '{"summary": string, "squad": [{"owner": string, "allocationPct": number, "role": string, "reason": string}]}. ' +
          "allocationPct across the squad must sum to 100. Each reason cites the leader's real stats in one sentence.",
        messages: [
          {
            role: "user",
            content: JSON.stringify({ constraints: c, leaders: ranked }),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const body = (await res.json()) as { content?: { text?: string }[] };
    const text = body.content?.map((b) => b.text ?? "").join("") ?? "";
    return parseFable(text, ranked);
  } finally {
    clearTimeout(timer);
  }
}

function parseFable(text: string, ranked: LeaderLike[]): ScoutResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON in scout reply");
  const parsed = JSON.parse(match[0]) as {
    summary: string;
    squad: { owner: string; allocationPct: number; role?: string; reason: string }[];
  };
  const known = new Map(ranked.map((l) => [l.owner, l]));
  const squad = parsed.squad
    .filter((p) => known.has(p.owner))
    .slice(0, 5)
    .map((p) => {
      const l = known.get(p.owner) as LeaderLike;
      return {
        owner: p.owner,
        allocationPct: Math.round(p.allocationPct),
        role: p.role ?? "Core",
        reason: p.reason,
        stats: {
          notionalUsd: Math.round(l.notionalUsd),
          avgLeverage: Number(l.avgLeverage.toFixed(2)),
          liqDistancePct: Number(l.liqDistancePct.toFixed(1)),
          positions: l.positions,
        },
      };
    });
  if (squad.length < 3) throw new Error("scout returned too few valid leaders");
  return { mode: "fable", summary: parsed.summary, squad };
}
