/** Persist the computed leaderboard + heatmap so the app has data instantly,
 *  even before the first (~30s) Flash sweep and across restarts.
 *  Live runs write data/leaders-cache.json (gitignored); a committed seed
 *  (data/leaders.json) gives a fresh clone instant data. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { HeatmapBin, LeaderStats } from "../indexer/flash.js";

const LIVE = "data/leaders-cache.json";
const SEED = "data/leaders.json";

export interface LeaderCache {
  leaderboard: LeaderStats[];
  heatmap: HeatmapBin[];
  updatedAt: number;
}

export function loadCache(): LeaderCache | null {
  for (const file of [LIVE, SEED]) {
    try {
      const c = JSON.parse(readFileSync(file, "utf8")) as LeaderCache;
      if (c.leaderboard?.length) return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function saveCache(c: LeaderCache): void {
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(LIVE, JSON.stringify(c));
  } catch (e) {
    process.stderr.write(`[cache] save failed: ${(e as Error).message}\n`);
  }
}
