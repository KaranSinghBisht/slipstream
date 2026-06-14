import type { ReactNode } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";

type Variant = "primary" | "ghost" | "danger";

const STYLES: Record<Variant, string> = {
  primary:
    "bg-accent text-[#04130d] hover:bg-[#43e0a6] disabled:bg-accent/40 disabled:text-[#04130d]/60",
  ghost: "bg-white/[0.04] text-fg ring-1 ring-line hover:bg-white/[0.08]",
  danger: "bg-short text-[#1a0508] hover:bg-[#ff8a9c]",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  arrow = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  arrow?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed ${STYLES[variant]} ${className}`}
    >
      {children}
      {arrow && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
          <ArrowRightIcon size={14} weight="bold" />
        </span>
      )}
    </button>
  );
}
