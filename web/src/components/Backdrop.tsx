/** Fixed ambient backdrop: a directional green god-ray from the top, a faint
 *  survey grid that fades before the fold, crosshair marks, corner glows, and
 *  fine film grain. Fixed + pointer-events-none — never intercepts input. */

const MARKS: [string, string][] = [
  ["17%", "24%"],
  ["83%", "19%"],
  ["69%", "57%"],
  ["29%", "66%"],
];

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      {/* faint survey grid, masked to fade away from the top-center */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "62px 62px",
          maskImage: "radial-gradient(130% 95% at 50% -5%, #000 0%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(130% 95% at 50% -5%, #000 0%, transparent 60%)",
        }}
      />

      {/* directional god-ray cone from top-center */}
      <div
        className="absolute left-1/2 -top-28 h-[42rem] w-[34rem] -translate-x-1/2 opacity-70 blur-[64px]"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 40%, rgba(52,211,153,0.20) 50%, transparent 60%)",
        }}
      />

      {/* top-center brand bloom */}
      <div
        className="absolute left-1/2 -top-[30rem] h-[54rem] w-[82rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-[150px]"
        style={{ background: "radial-gradient(closest-side, #34d399, transparent)" }}
      />
      <div
        className="absolute left-1/2 -top-[22rem] h-[34rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.10] blur-[120px]"
        style={{ background: "radial-gradient(closest-side, #c2f25e, transparent)" }}
      />

      {/* corner ambience */}
      <div
        className="absolute -left-44 top-1/3 h-[34rem] w-[34rem] rounded-full opacity-[0.06] blur-[140px]"
        style={{ background: "radial-gradient(closest-side, #0f9b73, transparent)" }}
      />
      <div
        className="absolute -right-44 top-2/3 h-[34rem] w-[34rem] rounded-full opacity-[0.06] blur-[140px]"
        style={{ background: "radial-gradient(closest-side, #34d399, transparent)" }}
      />

      {/* crosshair survey marks */}
      {MARKS.map(([left, top], i) => (
        <div
          key={i}
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 opacity-[0.22]"
          style={{ left, top }}
        >
          <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-accent" />
          <span className="absolute bottom-0 top-0 left-1/2 w-px -translate-x-1/2 bg-accent" />
        </div>
      ))}

      {/* top sheen */}
      <div
        className="absolute inset-0 opacity-50"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.04), transparent 55%)" }}
      />

      {/* film grain */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.025] mix-blend-soft-light">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
