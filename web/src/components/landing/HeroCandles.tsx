"use client";

/** Ambient candlestick field that lines the base of the hero — the single
 *  element that makes the page read as a trading product, not a SaaS template.
 *  Deterministic (seeded, computed once) so SSR and client markup match. */

type Candle = { o: number; c: number; hi: number; lo: number; bull: boolean };

function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 76;
const CANDLES: Candle[] = (() => {
  const r = seeded(11);
  let price = 38;
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = price;
    // mean-revert toward the band centre so candles line the full width evenly
    const drift = (38 - price) * 0.08 + (r() - 0.5) * 14;
    price = Math.max(14, Math.min(62, price + drift));
    const c = price;
    const hi = Math.min(70, Math.max(o, c) + r() * 5);
    const lo = Math.max(6, Math.min(o, c) - r() * 5);
    out.push({ o, c, hi, lo, bull: c >= o });
  }
  return out;
})();

export function HeroCandles({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex h-full w-full items-end gap-[3px] ${className}`}>
      {CANDLES.map((k, i) => {
        const top = Math.max(k.o, k.c);
        const bot = Math.min(k.o, k.c);
        return (
          <div key={i} className="relative h-full flex-1">
            <span
              className="absolute left-1/2 w-px -translate-x-1/2 bg-white/12"
              style={{ top: `${100 - k.hi}%`, height: `${k.hi - k.lo}%` }}
            />
            <span
              className={`absolute inset-x-[24%] rounded-[1px] ${k.bull ? "bg-accent/80" : "bg-accent/15"}`}
              style={{
                top: `${100 - top}%`,
                height: `${Math.max(top - bot, 1.6)}%`,
                boxShadow: k.bull ? "0 0 12px -3px rgba(52,211,153,0.55)" : "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
