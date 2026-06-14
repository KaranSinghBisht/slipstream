"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Price = { symbol: string; price: number; changePct: number };

function fmtPrice(p: number): string {
  if (p >= 100) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Live markets ticker (token · price · 24h change). Real Binance data, proxied
 *  by the API; renders nothing if the API is offline — the landing never breaks. */
export function PriceTicker() {
  const [prices, setPrices] = useState<Price[]>([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      api.prices()
        .then((p) => live && setPrices(p))
        .catch(() => live && setPrices([]));
    load();
    const id = setInterval(load, 15_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  if (prices.length === 0) return null;
  const row = [...prices, ...prices];

  return (
    <section className="relative overflow-hidden border-y border-line/50 bg-ink/40 py-3.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-ink to-transparent" />
      <div className="absolute left-6 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring" /> Live markets
      </div>
      <div className="flex w-max animate-marquee items-center gap-8 pl-6">
        {row.map((p, i) => {
          const up = p.changePct >= 0;
          return (
            <span key={i} className="flex shrink-0 items-center gap-2 font-mono text-xs">
              <span className="font-semibold text-fg">{p.symbol}</span>
              <span className="text-muted tnum">${fmtPrice(p.price)}</span>
              <span className={`tnum ${up ? "text-accent" : "text-short"}`}>
                {up ? "+" : ""}
                {p.changePct.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
