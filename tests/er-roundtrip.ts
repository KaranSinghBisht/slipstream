/**
 * Milestone test: full ER lifecycle on devnet with deterministic prices.
 * fresh owner -> init vault (base) -> delegate (base) -> open + ticks until
 * the trailing stop fires (ER) -> undelegate (ER) -> verify state on base.
 *
 * Run: pnpm test:er
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  DELEGATION_PROGRAM_ID,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  AnchorProvider,
  BN,
  ER_FALLBACK,
  BASE_RPC,
  MAGIC_CONTEXT,
  MAGIC_PROGRAM,
  SOL_FEED,
  USD,
  Wallet,
  fundFreshOwner,
  getDelegationStatus,
  loadKeypair,
  loadProgram,
  sendIx,
  sleep,
} from "./common.js";

async function main() {
  const burner = loadKeypair("keypairs/burner-devnet.json");
  const baseConn = new Connection(BASE_RPC, "confirmed");
  const owner = await fundFreshOwner(baseConn, burner, 0.05);
  console.log(`owner  ${owner.publicKey.toBase58()} (fresh, funded 0.05)`);

  const provider = new AnchorProvider(baseConn, new Wallet(owner), { commitment: "confirmed" });
  const { program, programId } = loadProgram(provider);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.publicKey.toBuffer()],
    programId
  );
  console.log(`vault  ${vault.toBase58()}`);

  // 1. init on base: $1000 allocation, 5x cap, 1% trail, burner as operator
  const initIx = await program.methods
    .initVault(new BN(1_000 * USD), 50, 100, burner.publicKey, SOL_FEED)
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], initIx);
  console.log(`init_vault       base  ok`);

  // 2. delegate on base (router picks the validator)
  const delegateIx = await program.methods
    .delegateVault(null)
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], delegateIx);
  await sleep(3000);
  const status = await getDelegationStatus(vault);
  if (!status.isDelegated) throw new Error("vault did not delegate");
  const erConn = new Connection(status.fqdn ?? ER_FALLBACK, "confirmed");
  console.log(`delegated -> ER  ${status.fqdn ?? ER_FALLBACK}`);

  const fetchVault = async (conn: Connection) => {
    const info = await conn.getAccountInfo(vault);
    if (!info) throw new Error("vault missing");
    return program.coder.accounts.decode("followerVault", info.data);
  };

  // 3. operator (burner) mirrors a long 2 @ $150 on the ER
  const openIx = await program.methods
    .openPosition(new BN(2 * USD), new BN(150 * USD))
    .accounts({ signer: burner.publicKey, vault })
    .instruction();
  const { ms: openMs } = await sendIx(erConn, [burner], openIx);
  console.log(`open_position    ER    ${openMs}ms (operator-signed, 2 @ $150, 1% trail)`);

  // Rising prices ratchet the stop; the drop to 152.5 crosses it (peak 155 - 1%).
  const prices = [150.5, 151.2, 152.0, 153.1, 154.0, 155.0, 154.2, 153.4, 152.5];
  const latencies: number[] = [];
  let v = await fetchVault(erConn);
  for (const p of prices) {
    const ix = await program.methods
      .applyTick(new BN(Math.round(p * USD)))
      .accounts({ signer: burner.publicKey, vault })
      .instruction();
    const { ms } = await sendIx(erConn, [burner], ix);
    latencies.push(ms);
    v = await fetchVault(erConn);
    console.log(
      `tick $${p.toFixed(1).padEnd(6)} ER ${String(ms).padStart(5)}ms  stop=$${(
        v.trailStopPrice1E6.toNumber() / USD
      ).toFixed(2)} fired=${v.stopFired}`
    );
    if (v.stopFired) break;
  }
  if (!v.stopFired) throw new Error("trailing stop never fired — engine bug");
  console.log(`stop FIRED onchain. equity $1000 -> $${(v.equityUsd6.toNumber() / USD).toFixed(2)}`);

  // 4. undelegate (owner) and verify state survived on base
  const undelegateIx = await program.methods
    .undelegateVault()
    .accounts({
      payer: owner.publicKey,
      vault,
      magicProgram: MAGIC_PROGRAM,
      magicContext: MAGIC_CONTEXT,
    })
    .instruction();
  const { sig: erSig } = await sendIx(erConn, [owner], undelegateIx);
  await GetCommitmentSignature(erSig, erConn);
  await sleep(3000);

  const baseInfo = await baseConn.getAccountInfo(vault);
  if (!baseInfo) throw new Error("vault missing on base after undelegate");
  if (baseInfo.owner.equals(DELEGATION_PROGRAM_ID)) throw new Error("vault still delegated");
  const baseVault = program.coder.accounts.decode("followerVault", baseInfo.data);
  if (!baseVault.stopFired) throw new Error("state did not survive the round trip");

  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log(
    `\nROUND TRIP OK — ticks=${baseVault.tickCount.toNumber()} avg ER confirm ${avg}ms ` +
      `final equity on base: $${(baseVault.equityUsd6.toNumber() / USD).toFixed(2)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
