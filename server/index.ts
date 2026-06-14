/**
 * Unified API for the web app. Sweeps live Flash leaders, runs the Fable scout,
 * provisions ER vault sessions, mirrors approved squads, and streams vault state.
 *
 *   GET  /health
 *   GET  /leaders            top leaders by notional
 *   GET  /heatmap            liquidation heatmap bins
 *   GET  /positions/:owner   one leader's live positions
 *   POST /scout    {constraints}          -> { mode, summary, squad[] }
 *   POST /session  {constraints}          -> provisions + delegates an ER vault
 *   GET  /state?session=ID                -> live vault state + tx feed
 *   POST /follow   {session, squad}       -> scaled mirror + autonomous crank
 *   POST /stress   {session}              -> adverse walk; fires the trailing stop
 *
 * Run: pnpm api
 */
import "dotenv/config";
import http from "node:http";
import { Connection } from "@solana/web3.js";
import {
  HeatmapBin,
  LeaderStats,
  LivePosition,
  buildHeatmap,
  buildLeaderboard,
  fetchLivePositions,
} from "../indexer/flash.js";
import { rankLeaders, scoutSquad } from "../agent/scout.js";
import { ownerSnapshot } from "../flash/v2.js";
import { planFreshMirror } from "../flash/mirror-plan.js";
import { getSession, listSessions } from "../bridge/context.js";
import { getVaultState, startSession } from "../bridge/session.js";
import { followSquad, stress } from "../bridge/mirror.js";
import { loadCache, saveCache } from "./cache.js";
import { getCandles } from "./candles.js";
import { getPrices } from "./prices.js";
import { json, readJson, sendError } from "./http.js";
import { validateConstraints, validateSquad } from "./validate.js";

const MAINNET_RPC = process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const PORT = Number(process.env.API_PORT ?? 8787);
const SWEEP_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 30_000);

const mainnet = new Connection(MAINNET_RPC, "confirmed");
let positions: LivePosition[] = [];
let leaderboard: LeaderStats[] = [];
let heatmap: HeatmapBin[] = [];
let lastSweep = 0;
let sweeping = false;

// Seed from the cache so the app has leaders instantly (before the first sweep).
const cached = loadCache();
if (cached) {
  leaderboard = cached.leaderboard;
  heatmap = cached.heatmap;
  lastSweep = cached.updatedAt;
}

async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    positions = await fetchLivePositions(mainnet);
    leaderboard = buildLeaderboard(positions);
    heatmap = buildHeatmap(positions);
    lastSweep = Date.now();
    saveCache({ leaderboard, heatmap, updatedAt: lastSweep });
    process.stdout.write(`[api] sweep ok: ${positions.length} positions, ${leaderboard.length} leaders\n`);
  } catch (err) {
    process.stderr.write(`[api] sweep failed: ${(err as Error).message}\n`);
  } finally {
    sweeping = false;
  }
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === "/health") {
    return json(res, {
      ok: lastSweep > 0,
      ageSec: lastSweep ? Math.round((Date.now() - lastSweep) / 1000) : null,
      positions: positions.length,
      leaders: leaderboard.length,
    });
  }
  if (p === "/leaders") return json(res, leaderboard.slice(0, 50));
  if (p === "/heatmap") return json(res, heatmap);
  if (p === "/candles")
    return json(res, await getCandles(url.searchParams.get("market") ?? "SOL", url.searchParams.get("interval") ?? "15m"));
  if (p === "/prices") return json(res, await getPrices());

  // Live, dry-run Flash V2 mirror plan (examples-v2 copy-trade pattern): pull a
  // leader's live V2 basket and size the mirror by collateral ratio + $11 floor.
  if (p === "/mirror-plan") {
    const owner = reqString(url, "owner");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) throw new Error("invalid owner pubkey");
    const allocationUsd = Math.min(1_000_000, Math.max(1, Number(url.searchParams.get("allocationUsd") ?? 1000)));
    const maxFollowUsd = Math.min(100_000, Math.max(1, Number(url.searchParams.get("maxFollowUsd") ?? 100)));
    const snap = await ownerSnapshot(owner);
    return json(res, {
      owner,
      network: "mainnet",
      livePositions: Object.keys(snap.positionMetrics ?? {}).length,
      intents: planFreshMirror(snap, allocationUsd, maxFollowUsd),
      note: "dry-run from live Flash V2; the guarded mirror routes through the ER vault",
    });
  }

  const ownerMatch = p.match(/^\/positions\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (ownerMatch) return json(res, positions.filter((x) => x.owner === ownerMatch[1]));

  if (p === "/sessions") {
    return json(
      res,
      listSessions().map((s) => ({
        session: s.id,
        owner: s.owner.publicKey.toBase58(),
        vault: s.vault.toBase58(),
        market: s.constraints.market,
        followed: s.followed,
        crankActive: s.crankTaskId !== undefined,
      }))
    );
  }
  if (p === "/scout" && req.method === "POST") {
    const body = await readJson(req);
    const c = validateConstraints(body?.constraints);
    return json(res, await scoutSquad(leaderboard, c, heatmap));
  }
  // Swipe-deck candidates, ranked by the follower's risk tolerance.
  if (p === "/candidates" && req.method === "POST") {
    const body = await readJson(req);
    const c = validateConstraints(body?.constraints);
    return json(res, rankLeaders(leaderboard, c).slice(0, 10));
  }
  // Swipe deck: AI analyses only the leaders the user swiped to keep.
  if (p === "/analyze" && req.method === "POST") {
    const body = await readJson(req);
    const c = validateConstraints(body?.constraints);
    const owners: string[] = Array.isArray(body?.owners)
      ? body.owners
          .filter((o: unknown) => typeof o === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(o))
          .slice(0, 12)
      : [];
    const picked = leaderboard.filter((l) => owners.includes(l.owner));
    const pool = picked.length >= 2 ? picked : leaderboard.slice(0, 6);
    return json(res, await scoutSquad(pool, c, heatmap));
  }
  if (p === "/session" && req.method === "POST") {
    const body = await readJson(req);
    const c = validateConstraints(body?.constraints);
    const s = await startSession(c);
    return json(res, {
      session: s.id,
      owner: s.owner.publicKey.toBase58(),
      vault: s.vault.toBase58(),
      erUrl: s.erUrl,
      market: s.constraints.market,
      referencePrice: s.referencePriceUi,
    });
  }
  if (p === "/state") {
    const s = getSession(reqString(url, "session"));
    return json(res, await getVaultState(s));
  }
  if (p === "/follow" && req.method === "POST") {
    const body = await readJson(req);
    const s = getSession(String(body?.session ?? ""));
    const squad = validateSquad(body?.squad);
    const fill = await followSquad(s, squad);
    return json(res, { fill, state: await getVaultState(s) });
  }
  if (p === "/stress" && req.method === "POST") {
    const body = await readJson(req);
    const s = getSession(String(body?.session ?? ""));
    await stress(s);
    return json(res, await getVaultState(s));
  }
  sendError(res, 404, "not found");
}

function reqString(url: URL, key: string): string {
  const v = url.searchParams.get(key);
  if (!v) throw new Error(`missing ?${key}`);
  return v;
}

const server = http.createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  route(req, res).catch((err) => {
    // Only surface known user-facing validation messages; mask internals (RPC URLs,
    // keypair paths, upstream API errors) per the security rules.
    const msg = (err as Error)?.message ?? "";
    const safe =
      /^(missing|invalid|squad|not found|allocationUsd|maxLeverageX10|trailBps)/i.test(msg) || msg.includes("out of range")
        ? msg
        : "internal error";
    sendError(res, safe === "internal error" ? 500 : 400, safe);
  });
});

server.listen(PORT, () => {
  process.stdout.write(`[api] listening on :${PORT}, sweeping every ${SWEEP_MS}ms\n`);
  void sweep();
  setInterval(() => void sweep(), SWEEP_MS);
});
