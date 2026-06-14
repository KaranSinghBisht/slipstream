/** Fixed ambient backdrop: emerald mesh orbs on OLED black + fine film grain.
 *  Pointer-events-none and fixed so it never repaints on scroll. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div
        className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: "radial-gradient(circle at center, #34d399, transparent 65%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[38rem] w-[38rem] rounded-full opacity-[0.10] blur-[130px]"
        style={{ background: "radial-gradient(circle at center, #0f9b73, transparent 60%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.04), transparent 55%)",
        }}
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
