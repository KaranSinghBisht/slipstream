"use client";
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
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
}

export interface PriceMark {
  price: number;
  color: string;
  title: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

/** Real candlestick chart (live OHLC from the API) with optional entry/stop
 *  price lines overlaid — the pro trading view. */
export function CandleChart({ market = "SOL", height = 240, marks = [] }: { market?: string; height?: number; marks?: PriceMark[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart: IChartApi = createChart(el, {
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
    seriesRef.current = series;

    let alive = true;
    fetch(`${BASE}/candles?market=${encodeURIComponent(market)}`)
      .then((r) => r.json())
      .then((data: Candle[]) => {
        if (!alive || !data?.length) return;
        series.setData(
          data.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
        );
        chart.timeScale().fitContent();
      })
      .catch(() => {});

    return () => {
      alive = false;
      seriesRef.current = null;
      linesRef.current = [];
      chart.remove();
    };
  }, [market]);

  // Update entry/stop price lines without rebuilding the chart.
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

  return <div ref={ref} className="w-full" style={{ height }} />;
}
