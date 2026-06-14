import type { ReactNode } from "react";

/** Double-bezel container: outer machined shell + concentric inner core. */
export function Bezel({
  children,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={`bezel rounded-3xl p-1.5 ${className}`}>
      <div
        className={`h-full rounded-[1.15rem] bg-panel-2/70 ring-1 ring-line ${innerClassName}`}
        style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)" }}
      >
        {children}
      </div>
    </div>
  );
}
