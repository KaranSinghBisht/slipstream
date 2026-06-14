import anchorPkg from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import path from "node:path";

export const { AnchorProvider, Wallet, Program, BN } = anchorPkg;

export const BASE_RPC = process.env.SOLANA_RPC_URL ?? "https://rpc.magicblock.app/devnet";
export const ROUTER_RPC = process.env.MAGIC_ROUTER_URL ?? "https://devnet-router.magicblock.app";
export const ER_FALLBACK = process.env.ER_RPC_URL ?? "https://devnet-as.magicblock.app";
export const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");
export const SOL_FEED = new PublicKey("ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu");

export const USD = 1_000_000;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function loadKeypair(rel: string): Keypair {
  const raw = JSON.parse(readFileSync(path.resolve(rel), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadProgram(provider: InstanceType<typeof AnchorProvider>) {
  const idl = JSON.parse(readFileSync("target/idl/copy_engine.json", "utf8"));
  return { program: new Program(idl, provider), programId: new PublicKey(idl.address) };
}

export async function getDelegationStatus(
  account: PublicKey
): Promise<{ isDelegated: boolean; fqdn?: string }> {
  const res = await fetch(ROUTER_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [account.toBase58()],
    }),
  });
  const body = (await res.json()) as {
    result?: { isDelegated: boolean; fqdn?: string };
    error?: { message: string };
  };
  if (body.error) throw new Error(`router: ${body.error.message}`);
  if (!body.result) throw new Error("router: empty result");
  return body.result;
}

export async function sendIx(
  conn: Connection,
  signers: Keypair[],
  ix: TransactionInstruction
): Promise<{ sig: string; ms: number }> {
  const tx = new Transaction().add(ix);
  tx.feePayer = signers[0].publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(...signers);
  const started = Date.now();
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return { sig, ms: Date.now() - started };
}

/** Create and fund a throwaway owner so each run gets a fresh vault PDA. */
export async function fundFreshOwner(
  baseConn: Connection,
  funder: Keypair,
  sol: number
): Promise<Keypair> {
  const owner = Keypair.generate();
  const ix = SystemProgram.transfer({
    fromPubkey: funder.publicKey,
    toPubkey: owner.publicKey,
    lamports: Math.round(sol * LAMPORTS_PER_SOL),
  });
  await sendIx(baseConn, [funder], ix);
  return owner;
}

/** Client-side decode of the 134-byte PriceUpdateV2-layout oracle account. */
export function decodeOraclePrice(data: Buffer): { priceUi: number; publishTime: number } {
  const tag = data[40];
  const msg = tag === 1 ? 41 : 42;
  const price = data.readBigInt64LE(msg + 32);
  const exponent = -Math.abs(data.readInt32LE(msg + 48));
  const publishTime = Number(data.readBigInt64LE(msg + 52));
  const priceUi = Number(price) * Math.pow(10, exponent);
  return { priceUi, publishTime };
}
