// ─────────────────────────────────────────────────────────────────────────────
// Slipstream MCP — lets Claude Code be your copy-trading copilot: scout
// the Flash leaderboard, draft a squad, and watch your guarded ER vaults live.
// A thin layer over the Slipstream API (pnpm api on :8787). MCP speaks JSON-RPC
// over stdout, so nothing here may write to stdout except the protocol itself.
// ─────────────────────────────────────────────────────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.SLIPSTREAM_API ?? "http://localhost:8787";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `GET ${path} ${res.status}`);
  return res.json() as Promise<T>;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `POST ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (e: unknown) => ({
  content: [{ type: "text" as const, text: `⚠ ${(e as Error).message}\n(Is the Slipstream API running? Start it with \`pnpm api\`.)` }],
  isError: true,
});

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;

async function latestSession(given?: string): Promise<string> {
  if (given) return given;
  const sessions = await apiGet<{ session: string }[]>("/sessions");
  if (sessions.length === 0) throw new Error("no active guarded vaults — follow a squad first (slipstream_follow)");
  return sessions[sessions.length - 1].session;
}

const CONSTRAINTS = {
  market: z.string().default("SOL").describe("market symbol, e.g. SOL/BTC/ETH"),
  allocationUsd: z.number().positive().default(1000).describe("budget in USD"),
  maxLeverageX10: z.number().int().min(10).max(1000).default(30).describe("leverage ceiling ×10 (30 = 3×)"),
  trailBps: z.number().int().min(1).max(9999).default(80).describe("trailing-stop distance in bps (80 = 0.8%)"),
  risk: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
};

const server = new McpServer({ name: "slipstream", version: "1.0.0" });

server.registerTool(
  "slipstream_leaders",
  { title: "Flash leaderboard", description: "Top live Flash Trade leaders by notional (the copy-trade universe)." },
  async () => {
    try {
      const ls = await apiGet<{ owner: string; notionalUsd: number; avgLeverage: number; liqDistancePct: number; positions: number }[]>("/leaders");
      const lines = ls.slice(0, 12).map((l, i) =>
        `${i + 1}. ${short(l.owner)} — ${usd(l.notionalUsd)} notional, ${l.avgLeverage.toFixed(1)}×, ${l.liqDistancePct.toFixed(0)}% liq buffer, ${l.positions} pos`
      );
      return ok(`Top Flash leaders (${ls.length} live):\n${lines.join("\n")}`);
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_heatmap",
  { title: "Liquidation heatmap", description: "Where Flash leverage gets liquidated, binned by distance from entry." },
  async () => {
    try {
      const bins = await apiGet<{ priceLow: number; priceHigh: number; notionalUsd: number; positions: number }[]>("/heatmap");
      const atRisk = bins.filter((b) => b.priceHigh <= 10).reduce((s, b) => s + b.notionalUsd, 0);
      const lines = bins.filter((b) => b.notionalUsd > 0).slice(0, 8).map((b) => `  ${b.priceLow}–${b.priceHigh}% out: ${usd(b.notionalUsd)} (${b.positions} pos)`);
      return ok(`Liquidation heatmap — ${usd(atRisk)} liquidates within a 10% move:\n${lines.join("\n")}`);
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_scout",
  { title: "Scout a squad", description: "AI scout: reads live leader analytics + your constraints, proposes a squad of 3–5 to copy with reasoning. Does not trade.", inputSchema: CONSTRAINTS },
  async (c) => {
    try {
      const r = await apiPost<{ mode: string; model?: string; summary: string; squad: { owner: string; role: string; allocationPct: number; reason: string }[] }>("/scout", { constraints: c });
      const lines = r.squad.map((p) => `  ${p.role} · ${short(p.owner)} · ${p.allocationPct}% — ${p.reason}`);
      return ok(`Scout (${r.model ?? "heuristic"}):\n${r.summary}\n\n${lines.join("\n")}`);
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_follow",
  {
    title: "Follow a squad",
    description: "Scout + draft in one step: provision a guarded ER vault, mirror the top `count` AI-scouted leaders into it (allocations re-normalized to 100%, scaled to your caps), and start the autonomous on-chain trailing-stop guard. Devnet. No need to call slipstream_scout first.",
    inputSchema: { ...CONSTRAINTS, count: z.number().int().min(1).max(5).default(3).describe("how many of the scouted squad to draft (the top N by weight)") },
  },
  async ({ count, ...c }) => {
    try {
      const scout = await apiPost<{ squad: Array<{ allocationPct: number; [k: string]: unknown }> }>("/scout", { constraints: c });
      const picked = scout.squad.slice(0, count);
      if (picked.length === 0) throw new Error("scout returned an empty squad");
      // The vault requires drafted allocations to sum to ~100%, so re-normalize the
      // sliced top-N subset among themselves (follow 3 of 4 → those 3 split 100%).
      const total = picked.reduce((a, p) => a + (p.allocationPct || 0), 0) || 1;
      const squad = picked.map((p) => ({ ...p, allocationPct: Math.round((p.allocationPct / total) * 100) }));
      const session = await apiPost<{ session: string }>("/session", { constraints: c });
      const r = await apiPost<{ state: VaultState }>("/follow", { session: session.session, squad });
      return ok(`Following ${squad.length} leaders in a guarded vault.\n\n${formatStatus(r.state)}`);
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_sessions",
  { title: "My guarded vaults", description: "List active guarded copy-trading vaults (your ER sessions)." },
  async () => {
    try {
      const s = await apiGet<{ session: string; vault: string; market: string; followed: { owner: string; allocationPct: number }[]; crankActive: boolean }[]>("/sessions");
      if (s.length === 0) return ok("No active guarded vaults. Use slipstream_follow to start one.");
      const lines = s.map((x) => `  ${x.session} — ${x.market} vault ${short(x.vault)}, ${x.followed.length} leaders, guard ${x.crankActive ? "ON" : "off"}`);
      return ok(`Active guarded vaults:\n${lines.join("\n")}`);
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_status",
  { title: "Vault status", description: "Live state of a guarded vault: position, equity/PnL, trailing-stop guard, autonomous tick count, and which leaders you mirror.", inputSchema: { session: z.string().optional().describe("session id; defaults to your most recent vault") } },
  async ({ session }) => {
    try {
      const s = await latestSession(session);
      return ok(formatStatus(await apiGet<VaultState>(`/state?session=${encodeURIComponent(s)}`)));
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_simulate_drawdown",
  { title: "Stress the guard", description: "Demo: drive an adverse on-chain price path so the trailing stop fires, showing the guard cap your downside while the leader keeps bleeding.", inputSchema: { session: z.string().optional() } },
  async ({ session }) => {
    try {
      const s = await latestSession(session);
      return ok(formatStatus(await apiPost<VaultState>("/stress", { session: s })));
    } catch (e) {
      return err(e);
    }
  }
);

server.registerTool(
  "slipstream_mirror_plan",
  { title: "Flash V2 mirror plan", description: "Dry-run the real Flash V2 mirror for a leader: collateral-ratio sizing + $11 floor (flash-trade/examples-v2 pattern).", inputSchema: { leader: z.string().describe("leader wallet pubkey"), allocationUsd: z.number().positive().default(1000), maxFollowUsd: z.number().positive().default(100) } },
  async ({ leader, allocationUsd, maxFollowUsd }) => {
    try {
      const r = await apiGet<{ livePositions: number; intents: { kind: string; side: string; market: string; mirrorUsd: number; mirrorCollateralUsd: number; skipped?: string }[] }>(`/mirror-plan?owner=${leader}&allocationUsd=${allocationUsd}&maxFollowUsd=${maxFollowUsd}`);
      if (r.livePositions === 0) return ok(`${short(leader)} has no live Flash V2 positions to mirror.`);
      const lines = r.intents.map((i) => (i.skipped ? `  SKIP ${i.side} ${i.market} — ${i.skipped}` : `  ${i.kind} ${i.side} ${i.market} → mirror $${i.mirrorUsd.toFixed(0)} (${i.mirrorCollateralUsd.toFixed(2)} USDC)`));
      return ok(`Mirror plan for ${short(leader)} (${r.livePositions} V2 positions, dry-run):\n${lines.join("\n")}`);
    } catch (e) {
      return err(e);
    }
  }
);

interface VaultState {
  vault: string; market: string; side: string; erUrl: string;
  markPrice: number; entryPrice: number; equityUsd: number; allocationUsd: number;
  trailStop: number; trailBps: number; stopFired: boolean; tickCount: number; crankActive: boolean;
  followed: { owner: string; allocationPct: number }[];
}

function formatStatus(v: VaultState): string {
  const region = v.erUrl.replace(/^https?:\/\//, "").split(".")[0];
  const pnlPct = v.allocationUsd ? ((v.equityUsd - v.allocationUsd) / v.allocationUsd) * 100 : 0;
  const head = `Vault ${short(v.vault)} — ${v.market} ${v.side} on ER (${region})`;
  const pos = v.side === "flat"
    ? `  position: flat`
    : `  mark $${v.markPrice.toFixed(2)} · entry $${v.entryPrice.toFixed(2)} · equity $${v.equityUsd.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`;
  const guard = v.stopFired
    ? `  guard: STOP FIRED — downside capped, equity locked`
    : `  guard: stop $${v.trailStop.toFixed(2)} (${(v.trailBps / 100).toFixed(2)}% trail) · ${v.tickCount} autonomous on-chain ticks · crank ${v.crankActive ? "ON @500ms" : "off"}`;
  const squad = v.followed.length ? `  mirroring: ${v.followed.map((f) => `${short(f.owner)} ${f.allocationPct}%`).join(", ")}` : "";
  return [head, pos, guard, squad].filter(Boolean).join("\n");
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[slipstream-mcp] connected (API ${API})\n`);
