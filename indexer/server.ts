/**
 * Tiny JSON API over the Flash indexer.
 *   GET /health   -> { ok, lastSweep, positions, leaders }
 *   GET /leaders  -> LeaderStats[] (top 50)
 *   GET /heatmap  -> HeatmapBin[]
 *   GET /positions/:owner -> LivePosition[]
 *
 * Run: pnpm indexer
 */
import http from "node:http";
import { Connection } from "@solana/web3.js";
import {
  LivePosition,
  buildHeatmap,
  buildLeaderboard,
  fetchLivePositions,
} from "./flash.js";

const RPC = process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const PORT = Number(process.env.INDEXER_PORT ?? 8787);
const SWEEP_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 30_000);

const conn = new Connection(RPC, "confirmed");

let positions: LivePosition[] = [];
let lastSweep = 0;
let sweeping = false;

async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    positions = await fetchLivePositions(conn);
    lastSweep = Date.now();
    process.stdout.write(
      `[indexer] sweep ok: ${positions.length} live positions, ${new Set(positions.map((p) => p.owner)).size} owners\n`
    );
  } catch (err) {
    process.stderr.write(`[indexer] sweep failed: ${(err as Error).message}\n`);
  } finally {
    sweeping = false;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");

  if (url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: lastSweep > 0,
        lastSweep,
        ageSec: lastSweep ? Math.round((Date.now() - lastSweep) / 1000) : null,
        positions: positions.length,
        leaders: new Set(positions.map((p) => p.owner)).size,
      })
    );
    return;
  }
  if (url.pathname === "/leaders") {
    res.end(JSON.stringify(buildLeaderboard(positions).slice(0, 50)));
    return;
  }
  if (url.pathname === "/heatmap") {
    res.end(JSON.stringify(buildHeatmap(positions)));
    return;
  }
  const ownerMatch = url.pathname.match(/^\/positions\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (ownerMatch) {
    res.end(JSON.stringify(positions.filter((p) => p.owner === ownerMatch[1])));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  process.stdout.write(`[indexer] listening on :${PORT}, sweeping every ${SWEEP_MS}ms\n`);
  void sweep();
  setInterval(() => void sweep(), SWEEP_MS);
});
