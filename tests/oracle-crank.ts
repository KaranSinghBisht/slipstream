/**
 * THE SHOWCASE TEST: autonomous onchain guard loop.
 * fresh owner -> init + delegate -> operator opens a position at the LIVE
 * oracle price -> manual check_trailing_stop reads the feed onchain ->
 * schedule a 500ms crank INSIDE the ER -> watch tick_count grow with zero
 * client transactions -> commit state to base.
 *
 * Run: pnpm test:crank
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  AnchorProvider,
  BN,
  BASE_RPC,
  ER_FALLBACK,
  MAGIC_CONTEXT,
  MAGIC_PROGRAM,
  SOL_FEED,
  USD,
  Wallet,
  decodeOraclePrice,
  fundFreshOwner,
  getDelegationStatus,
  loadKeypair,
  loadProgram,
  sendIx,
  sleep,
} from "./common.js";

const TRAIL_BPS = 10; // 0.10% — tight, so live jitter can plausibly fire it

async function main() {
  const burner = loadKeypair("keypairs/burner-devnet.json"); // = operator
  const baseConn = new Connection(BASE_RPC, "confirmed");
  const owner = await fundFreshOwner(baseConn, burner, 0.05);

  const provider = new AnchorProvider(baseConn, new Wallet(owner), { commitment: "confirmed" });
  const { program, programId } = loadProgram(provider);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.publicKey.toBuffer()],
    programId
  );
  console.log(`owner ${owner.publicKey.toBase58()}\nvault ${vault.toBase58()}`);

  // init + delegate
  const initIx = await program.methods
    .initVault(new BN(1_000 * USD), 50, TRAIL_BPS, burner.publicKey, SOL_FEED)
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], initIx);
  const delegateIx = await program.methods
    .delegateVault(null)
    .accounts({ payer: owner.publicKey })
    .instruction();
  await sendIx(baseConn, [owner], delegateIx);
  await sleep(3000);
  const status = await getDelegationStatus(vault);
  if (!status.isDelegated) throw new Error("vault did not delegate");
  const erUrl = status.fqdn ?? ER_FALLBACK;
  const erConn = new Connection(erUrl, "confirmed");
  console.log(`delegated -> ER ${erUrl}`);

  // live oracle price from the ER
  const feedInfo = await erConn.getAccountInfo(SOL_FEED);
  if (!feedInfo) throw new Error("feed not found on ER");
  const { priceUi, publishTime } = decodeOraclePrice(feedInfo.data);
  const ageSec = Math.round(Date.now() / 1000 - publishTime);
  console.log(`live SOL/USD on ER: $${priceUi.toFixed(4)} (published ${ageSec}s ago)`);

  // operator opens 1 SOL long at the live price
  const openIx = await program.methods
    .openPosition(new BN(1 * USD), new BN(Math.round(priceUi * USD)))
    .accounts({ signer: burner.publicKey, vault })
    .instruction();
  await sendIx(erConn, [burner], openIx);
  console.log(`open_position 1 SOL long @ $${priceUi.toFixed(2)}, trail ${TRAIL_BPS}bps`);

  const fetchVault = async () => {
    const info = await erConn.getAccountInfo(vault);
    if (!info) throw new Error("vault missing on ER");
    return program.coder.accounts.decode("followerVault", info.data);
  };

  // manual oracle-driven ticks: program reads the feed account onchain
  for (let i = 0; i < 3; i++) {
    const ix = await program.methods
      .checkTrailingStop()
      .accounts({ vault, priceUpdate: SOL_FEED })
      .instruction();
    const { ms } = await sendIx(erConn, [burner], ix);
    const v = await fetchVault();
    console.log(
      `manual check ${i + 1}: ${ms}ms  onchain price=$${(v.lastPrice1E6.toNumber() / USD).toFixed(
        4
      )} stop=$${(v.trailStopPrice1E6.toNumber() / USD).toFixed(4)}`
    );
    await sleep(700);
  }

  // schedule the crank INSIDE the ER: every 500ms, 120 iterations (~60s)
  const taskId = Date.now() % 1_000_000;
  const crankIx = await program.methods
    .scheduleStopCrank(new BN(taskId), new BN(500), new BN(120))
    .accounts({ payer: burner.publicKey, vault, priceUpdate: SOL_FEED, magicProgram: MAGIC_PROGRAM })
    .instruction();
  await sendIx(erConn, [burner], crankIx);
  console.log(`\ncrank scheduled (task ${taskId}): check_trailing_stop every 500ms x120`);
  console.log(`watching vault WITHOUT sending any transactions…`);

  let before = (await fetchVault()).tickCount.toNumber();
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    await sleep(3000);
    const v = await fetchVault();
    const ticks = v.tickCount.toNumber();
    const rate = ((ticks - before) / ((Date.now() - t0) / 1000)).toFixed(1);
    console.log(
      `t+${Math.round((Date.now() - t0) / 1000)}s  ticks=${ticks} (+${ticks - before}, ${rate}/s)` +
        `  price=$${(v.lastPrice1E6.toNumber() / USD).toFixed(4)}` +
        `  stop=$${(v.trailStopPrice1E6.toNumber() / USD).toFixed(4)}` +
        `  fired=${v.stopFired}`
    );
    if (v.stopFired) {
      console.log(`>>> TRAILING STOP FIRED AUTONOMOUSLY — equity $${(v.equityUsd6.toNumber() / USD).toFixed(2)}`);
      break;
    }
  }

  const grew = (await fetchVault()).tickCount.toNumber() - before;
  if (grew <= 0) throw new Error("crank did not tick — autonomous loop NOT working");
  console.log(`\nAUTONOMOUS GUARD LOOP OK — ${grew} onchain ticks with zero client transactions`);

  // flush state to base layer (stay delegated for future runs)
  const commitIx = await program.methods
    .commitVault()
    .accounts({
      payer: owner.publicKey,
      vault,
      magicProgram: MAGIC_PROGRAM,
      magicContext: MAGIC_CONTEXT,
    })
    .instruction();
  await sendIx(erConn, [owner], commitIx);
  console.log(`state committed to base layer`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
