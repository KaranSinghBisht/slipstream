"use client";
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceMark {
  price: number;
  color: string;
  title: string;
}

/** A trade event to pin on the time axis — e.g. "You in" / "Stop fired". */
export interface ChartEvent {
  time: number; // unix seconds (ms is normalised)
  label: string;
  tone: "you" | "stop";
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";
const TFS: [string, string][] = [
  ["1m", "1m"],
  ["5m", "5m"],
  ["15m", "15m"],
  ["1H", "1h"],
  ["4H", "4h"],
  ["1D", "1d"],
];

function fmtPrice(p: number): string {
  return p >= 100
    ? p.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : p.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Pro trading-terminal chart: live OHLC + volume from the API, an instrument
 *  header (symbol · last · change), switchable timeframes, entry/stop lines,
 *  and optional trade-event markers on the time axis. */
export function CandleChart({
  market = "SOL",
  height = 300,
  marks = [],
  events = [],
}: {
  market?: string;
  height?: number;
  marks?: PriceMark[];
  events?: ChartEvent[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const rangeRef = useRef<{ first: number; last: number } | null>(null);
  const [tf, setTf] = useState("15m");
  const [last, setLast] = useState<number | null>(null);
  const [chg, setChg] = useState<number | null>(null);

  // create the chart once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#868da0",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)" },
        horzLines: { color: "rgba(255,255,255,0.035)" },
      },
      timeScale: { borderColor: "rgba(255,255,255,0.07)", timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.07)" },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
    });
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    chartRef.current = chart;
    seriesRef.current = series;
    volRef.current = vol;
    markersRef.current = createSeriesMarkers(series, []);
    return () => {
      chartRef.current = null;
      seriesRef.current = null;
      volRef.current = null;
      markersRef.current = null;
      linesRef.current = [];
      chart.remove();
    };
  }, []);

  // (re)load candles when the market or timeframe changes
  useEffect(() => {
    const series = seriesRef.current;
    const vol = volRef.current;
    const chart = chartRef.current;
    if (!series || !vol || !chart) return;
    let alive = true;
    fetch(`${BASE}/candles?market=${encodeURIComponent(market)}&interval=${tf}`)
      .then((r) => r.json())
      .then((data: Candle[]) => {
        if (!alive || !data?.length) return;
        series.setData(data.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
        vol.setData(
          data.map((c) => ({
            time: c.time as Time,
            value: c.volume ?? 0,
            color: c.close >= c.open ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)",
          }))
        );
        chart.timeScale().fitContent();
        rangeRef.current = { first: data[0].time, last: data[data.length - 1].time };
        const lc = data[data.length - 1].close;
        const fc = data[0].open || lc;
        setLast(lc);
        setChg(fc ? ((lc - fc) / fc) * 100 : 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [market, tf]);

  // entry/stop price lines, updated without rebuilding the chart
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const ln of linesRef.current) series.removePriceLine(ln);
    linesRef.current = marks
      .filter((m) => m.price > 0)
      .map((m) =>
        series.createPriceLine({
          price: m.price,
          color: m.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: m.title,
        })
      );
  }, [marks]);

  // trade-event markers ("You in", "Stop fired"), clamped into the candle range
  useEffect(() => {
    const m = markersRef.current;
    if (!m) return;
    const range = rangeRef.current;
    const norm = (t: number) => (t > 1e12 ? Math.floor(t / 1000) : Math.floor(t));
    const placed = events
      .map((e) => {
        let t = norm(e.time);
        if (range) t = Math.min(Math.max(t, range.first), range.last);
        return {
          time: t as Time,
          position: e.tone === "you" ? ("belowBar" as const) : ("aboveBar" as const),
          color: e.tone === "you" ? "#34d399" : "#fb7185",
          shape: e.tone === "you" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: e.label,
        };
      })
      .sort((a, b) => (a.time as number) - (b.time as number));
    m.setMarkers(placed);
  }, [events, last]);

  const up = (chg ?? 0) >= 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-sm font-semibold text-fg">{market}-USD</span>
          {last !== null && <span className="font-mono text-sm text-fg tnum">${fmtPrice(last)}</span>}
          {chg !== null && (
            <span className={`font-mono text-xs tnum ${up ? "text-accent" : "text-short"}`}>
              {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-black/30 p-0.5 ring-1 ring-line">
          {TFS.map(([label, val]) => (
            <button
              key={val}
              onClick={() => setTf(val)}
              className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors ${
                tf === val ? "bg-accent/15 text-accent" : "text-faint hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="w-full" style={{ height }} />
    </div>
  );
}
