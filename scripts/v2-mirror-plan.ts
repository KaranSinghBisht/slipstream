// CLI mirror-plan for any Flash V2 leader — the examples-v2 copy-trade UX,
// dry-run: give a leader pubkey, see the collateral-ratio-sized mirror intents.
//   tsx scripts/v2-mirror-plan.ts <leaderPubkey> [allocationUsd] [maxFollowUsd]
import "dotenv/config";
import { ownerSnapshot } from "../flash/v2.js";
import { planFreshMirror } from "../flash/mirror-plan.js";

const owner = process.argv[2];
const allocationUsd = Number(process.argv[3] ?? "1000");
const maxFollowUsd = Number(process.argv[4] ?? "100");
const w = (s: string) => process.stdout.write(`${s}\n`);

if (!owner) {
  w("usage: tsx scripts/v2-mirror-plan.ts <leaderPubkey> [allocationUsd] [maxFollowUsd]");
  process.exit(1);
}

const snap = await ownerSnapshot(owner);
const intents = planFreshMirror(snap, allocationUsd, maxFollowUsd);

w(`leader ${owner} — ${Object.keys(snap.positionMetrics ?? {}).length} live V2 position(s)`);
w(`follower allocation $${allocationUsd}, cap $${maxFollowUsd}/mirror (dry-run)\n`);
if (intents.length === 0) w("no live V2 positions to mirror.");
for (const i of intents) {
  if (i.skipped) w(`SKIP  ${i.side} ${i.market} — ${i.skipped}`);
  else
    w(
      `OPEN  ${i.side} ${i.market} — leader $${i.leaderSizeUsd.toFixed(0)} @ ${i.leverage.toFixed(1)}x ` +
        `→ mirror $${i.mirrorUsd.toFixed(2)} (${i.mirrorCollateralUsd.toFixed(2)} USDC collateral)`
    );
}
