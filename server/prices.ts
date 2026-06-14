/** Live spot prices + 24h change for the landing markets ticker.
 *  Binance 24h ticker, cached server-side; degrades to last cache on failure. */
export interface Price {
  symbol: string;
  price: number;
  changePct: number;
}

// label -> Binance USDT pair. SOL/BTC/ETH are the tradable markets; the rest are
// majors shown purely as live market context on the landing ticker.
const SYMBOLS: [string, string][] = [
  ["SOL", "SOLUSDT"],
  ["BTC", "BTCUSDT"],
  ["ETH", "ETHUSDT"],
  ["BNB", "BNBUSDT"],
  ["XRP", "XRPUSDT"],
  ["DOGE", "DOGEUSDT"],
  ["AVAX", "AVAXUSDT"],
  ["LINK", "LINKUSDT"],
  ["SUI", "SUIUSDT"],
  ["NEAR", "NEARUSDT"],
  ["ADA", "ADAUSDT"],
  ["TON", "TONUSDT"],
  ["TRX", "TRXUSDT"],
  ["APT", "APTUSDT"],
];

let cache: { at: number; data: Price[] } | null = null;
const TTL_MS = 15_000;

export async function getPrices(): Promise<Price[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const pairs = SYMBOLS.map(([, pair]) => pair);
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`binance ${res.status}`);
    const raw = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string }[];
    const bySym = new Map(raw.map((r) => [r.symbol, r]));
    const data: Price[] = [];
    for (const [label, pair] of SYMBOLS) {
      const r = bySym.get(pair);
      if (r) data.push({ symbol: label, price: Number(r.lastPrice), changePct: Number(r.priceChangePercent) });
    }
    if (data.length > 0) cache = { at: Date.now(), data };
    return data.length > 0 ? data : (cache?.data ?? []);
  } catch {
    return cache?.data ?? [];
  }
}
