/** OHLC candles for the trading charts — fetched from a public exchange and
 *  cached server-side. Binance primary, Bybit fallback (geo-resilient). */
export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

const SYMBOL: Record<string, string> = { SOL: "SOLUSDT", BTC: "BTCUSDT", ETH: "ETHUSDT" };
const cache: Record<string, { at: number; data: Candle[] }> = {};
const TTL_MS = 20_000;

async function fromBinance(sym: string): Promise<Candle[]> {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=15m&limit=120`);
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const raw = (await res.json()) as string[][];
  return raw.map((k) => ({ time: Math.floor(Number(k[0]) / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}

async function fromBybit(sym: string): Promise<Candle[]> {
  const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=15&limit=120`);
  if (!res.ok) throw new Error(`bybit ${res.status}`);
  const body = (await res.json()) as { result?: { list?: string[][] } };
  const list = body.result?.list ?? [];
  return list
    .map((k) => ({ time: Math.floor(Number(k[0]) / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
    .reverse(); // bybit returns newest-first
}

export async function getCandles(market: string): Promise<Candle[]> {
  const sym = SYMBOL[market.toUpperCase()] ?? SYMBOL.SOL;
  const hit = cache[sym];
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  for (const src of [fromBinance, fromBybit]) {
    try {
      const data = await src(sym);
      if (data.length > 0) {
        cache[sym] = { at: Date.now(), data };
        return data;
      }
    } catch {
      /* try next source */
    }
  }
  return hit?.data ?? [];
}
