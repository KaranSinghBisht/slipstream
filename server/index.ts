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
import { LivePosition, buildHeatmap, buildLeaderboard, fetchLivePositions } from "../indexer/flash.js";
import { scoutSquad } from "../agent/scout.js";
import { getSession } from "../bridge/context.js";
import { getVaultState, startSession } from "../bridge/session.js";
import { followSquad, stress } from "../bridge/mirror.js";
import { json, readJson, sendError } from "./http.js";
import { validateConstraints, validateSquad } from "./validate.js";

const MAINNET_RPC = process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const PORT = Number(process.env.API_PORT ?? 8787);
const SWEEP_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 30_000);

const mainnet = new Connection(MAINNET_RPC, "confirmed");
let positions: LivePosition[] = [];
let lastSweep = 0;
let sweeping = false;

async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    positions = await fetchLivePositions(mainnet);
    lastSweep = Date.now();
    process.stdout.write(`[api] sweep ok: ${positions.length} positions\n`);
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
      leaders: new Set(positions.map((x) => x.owner)).size,
    });
  }
  if (p === "/leaders") return json(res, buildLeaderboard(positions).slice(0, 50));
  if (p === "/heatmap") return json(res, buildHeatmap(positions));

  const ownerMatch = p.match(/^\/positions\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (ownerMatch) return json(res, positions.filter((x) => x.owner === ownerMatch[1]));

  if (p === "/scout" && req.method === "POST") {
    const body = await readJson(req);
    const c = validateConstraints(body?.constraints);
    const result = await scoutSquad(buildLeaderboard(positions), c);
    return json(res, result);
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
  route(req, res).catch((err) => sendError(res, 400, (err as Error).message));
});

server.listen(PORT, () => {
  process.stdout.write(`[api] listening on :${PORT}, sweeping every ${SWEEP_MS}ms\n`);
  void sweep();
  setInterval(() => void sweep(), SWEEP_MS);
});
