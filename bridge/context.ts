/**
 * Shared bridge singletons: the operator/funder burner key, base-layer
 * connection, and the Anchor program used to build instructions. The bridge
 * signs ER mutations with the operator key (the F2 honest-signing model — the
 * follower's owner key can undelegate at any time).
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  AnchorProvider,
  BASE_RPC,
  Wallet,
  WALLET_PATH,
  loadKeypair,
  loadProgram,
} from "../server/chain.js";
import type { Constraints } from "../agent/scout.js";

export interface TxLog {
  kind: string;
  sig: string;
  ms: number;
  ts: number;
  detail: string;
}

export interface ChartPoint {
  you: number;
  leader: number;
}

export interface Session {
  id: string;
  owner: Keypair;
  vault: PublicKey;
  feed: PublicKey;
  erConn: Connection;
  erUrl: string;
  constraints: Constraints;
  referencePriceUi: number;
  followed: { owner: string; allocationPct: number }[];
  baseline?: { qty: number; entry: number; alloc: number };
  chart: ChartPoint[];
  chartFiredAt: number | null;
  crankTaskId?: number;
  settled?: boolean;
  demoRealizedUsd?: number | null;
  txs: TxLog[];
}

export const burner = loadKeypair(WALLET_PATH);
export const baseConn = new Connection(BASE_RPC, "confirmed");

const provider = new AnchorProvider(baseConn, new Wallet(burner), { commitment: "confirmed" });
const loaded = loadProgram(provider);
export const program = loaded.program;
export const programId = loaded.programId;

const sessions = new Map<string, Session>();
let counter = 0;

export function newSessionId(): string {
  counter += 1;
  return `s${Date.now().toString(36)}${counter}`;
}

export function putSession(s: Session): void {
  sessions.set(s.id, s);
}

export function getSession(id: string): Session {
  const s = sessions.get(id);
  if (!s) throw new Error("session not found");
  return s;
}

export function listSessions(): Session[] {
  return [...sessions.values()];
}

export function logTx(s: Session, kind: string, sig: string, ms: number, detail: string): void {
  s.txs.unshift({ kind, sig, ms, ts: Date.now(), detail });
  s.txs = s.txs.slice(0, 24);
}
