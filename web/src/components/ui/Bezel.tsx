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
    <div className={`bezel rounded-[14px] p-1 ${className}`}>
      <div
        className={`h-full rounded-[10px] bg-panel-2/70 ring-1 ring-line ${innerClassName}`}
        style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.06)" }}
      >
        {children}
      </div>
    </div>
  );
}
