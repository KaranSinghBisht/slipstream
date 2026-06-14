/** Fixed ambient backdrop: a strong top-center green glow (Flash / Drift feel),
 *  a lime tint, corner glows, and fine film grain. Fixed + pointer-events-none. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div
        className="absolute left-1/2 -top-[30rem] h-[54rem] w-[82rem] -translate-x-1/2 rounded-full opacity-[0.20] blur-[150px]"
        style={{ background: "radial-gradient(closest-side, #34d399, transparent)" }}
      />
      <div
        className="absolute left-1/2 -top-[22rem] h-[34rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.10] blur-[120px]"
        style={{ background: "radial-gradient(closest-side, #c2f25e, transparent)" }}
      />
      <div
        className="absolute -left-44 top-1/3 h-[34rem] w-[34rem] rounded-full opacity-[0.07] blur-[140px]"
        style={{ background: "radial-gradient(closest-side, #0f9b73, transparent)" }}
      />
      <div
        className="absolute -right-44 top-2/3 h-[34rem] w-[34rem] rounded-full opacity-[0.07] blur-[140px]"
        style={{ background: "radial-gradient(closest-side, #34d399, transparent)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.04), transparent 55%)" }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.025] mix-blend-soft-light">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
