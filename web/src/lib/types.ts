export type Risk = "conservative" | "balanced" | "aggressive";

export interface Constraints {
  market: string;
  allocationUsd: number;
  maxLeverageX10: number;
  trailBps: number;
  risk: Risk;
}

export interface LeaderStats {
  owner: string;
  positions: number;
  notionalUsd: number;
  collateralUsd: number;
  avgLeverage: number;
  markets: string[];
  liqDistancePct: number;
}

export interface HeatmapBin {
  priceLow: number;
  priceHigh: number;
  notionalUsd: number;
  positions: number;
}

export interface SquadStats {
  notionalUsd: number;
  avgLeverage: number;
  liqDistancePct: number;
  positions: number;
}

export interface SquadPick {
  owner: string;
  allocationPct: number;
  role: string;
  reason: string;
  stats: SquadStats;
}

export interface ScoutResult {
  mode: "ai" | "rule";
  model?: string;
  summary: string;
  squad: SquadPick[];
}

export interface SessionInfo {
  session: string;
  owner: string;
  vault: string;
  erUrl: string;
  market: string;
  referencePrice: number;
}

export interface TxLog {
  kind: string;
  sig: string;
  ms: number;
  ts: number;
  detail: string;
}

export interface VaultState {
  sessionId: string;
  owner: string;
  vault: string;
  feed: string;
  market: string;
  erUrl: string;
  layer: "ER" | "base";
  allocationUsd: number;
  maxLeverage: number;
  trailBps: number;
  equityUsd: number;
  qty: number;
  side: "long" | "short" | "flat";
  entryPrice: number;
  peakPrice: number;
  trailStop: number;
  lastPrice: number;
  markPrice: number;
  stopFired: boolean;
  tickCount: number;
  crankActive: boolean;
  followed: { owner: string; allocationPct: number }[];
  chart: { you: number; leader: number }[];
  chartFiredAt: number | null;
  txs: TxLog[];
}

export interface Health {
  ok: boolean;
  ageSec: number | null;
  positions: number;
  leaders: number;
}
