"use client";
import { signedPct } from "@/lib/format";

export interface PnlSample {
  you: number;
  leader: number;
}

/** Dual-line P&L: "you (guarded)" vs "leader (held, no stop)". The lines move
 *  together through the drawdown, then yours locks at the stop while the
 *  leader's keeps bleeding — the value of the guard, drawn. */
export function PnlChart({
  samples,
  firedAt,
  alloc,
}: {
  samples: PnlSample[];
  firedAt: number | null;
  alloc: number;
}) {
  if (samples.length < 2) return <Placeholder />;

  const W = 620;
  const H = 210;
  const padL = 10;
  const padR = 60;
  const padT = 16;
  const padB = 16;
  const n = samples.length;

  const vals = samples.flatMap((s) => [s.you, s.leader]).concat([0]);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const span = max - min || Math.max(1, Math.abs(max) || 1);
  min -= span * 0.12;
  max += span * 0.12;

  const xAt = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const yAt = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const poly = (key: "you" | "leader") =>
    samples.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s[key]).toFixed(1)}`).join(" ");
  const area =
    `M ${xAt(0).toFixed(1)},${(H - padB).toFixed(1)} ` +
    samples.map((s, i) => `L ${xAt(i).toFixed(1)},${yAt(s.you).toFixed(1)}`).join(" ") +
    ` L ${xAt(n - 1).toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const last = samples[n - 1];
  const y0 = yAt(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">Guarded vs held · P&amp;L</span>
        <div className="flex items-center gap-3 text-[11px]">
          <Legend color="#34d399" label="You" value={last.you} alloc={alloc} />
          <Legend color="#fb7185" label="Leader" value={last.leader} alloc={alloc} />
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="youfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padL} y1={y0} x2={W - padR} y2={y0} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        <text x={W - padR + 5} y={y0 + 3} fill="#565d70" fontSize="9" fontFamily="monospace">
          $0
        </text>
        {firedAt !== null && firedAt < n && (
          <g>
            <line
              x1={xAt(firedAt)}
              y1={padT}
              x2={xAt(firedAt)}
              y2={H - padB}
              stroke="#fb7185"
              strokeOpacity="0.45"
              strokeDasharray="2 3"
            />
            <text x={xAt(firedAt) + 3} y={padT + 8} fill="#fb7185" fontSize="8.5" fontFamily="monospace">
              stop fired
            </text>
          </g>
        )}
        <path d={area} fill="url(#youfill)" />
        <polyline
          points={poly("leader")}
          fill="none"
          stroke="#fb7185"
          strokeWidth="1.6"
          strokeOpacity="0.85"
          strokeLinejoin="round"
        />
        <polyline points={poly("you")} fill="none" stroke="#34d399" strokeWidth="2.1" strokeLinejoin="round" />
        <circle cx={xAt(n - 1)} cy={yAt(last.leader)} r="2.6" fill="#fb7185" />
        <circle cx={xAt(n - 1)} cy={yAt(last.you)} r="3.2" fill="#34d399" />
      </svg>
    </div>
  );
}

function Legend({ color, label, value, alloc }: { color: string; label: string; value: number; alloc: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
      <span className="font-mono tnum" style={{ color }}>
        {signedPct(alloc ? (value / alloc) * 100 : 0)}
      </span>
    </span>
  );
}

function Placeholder() {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-faint">Guarded vs held · P&amp;L</span>
      <div className="flex h-[180px] items-center justify-center rounded-xl bg-white/[0.02] ring-1 ring-line">
        <span className="font-mono text-xs text-faint">collecting on-chain ticks…</span>
      </div>
    </div>
  );
}
