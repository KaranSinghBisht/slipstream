"use client";
import { CaretDownIcon } from "@phosphor-icons/react";

/** Local demo account chip for the app header — a logged-in feel without the
 *  connect-wallet friction. Clicking opens the portfolio of guarded vaults. */
export function AccountChip({ vaults = 0, onClick }: { vaults?: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 rounded-full bg-white/[0.04] py-1.5 pl-1.5 pr-3 ring-1 ring-line transition-colors hover:bg-white/[0.08]"
    >
      <span
        className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/10"
        style={{ background: "conic-gradient(from 140deg, #c2f25e, #34d399, #0f9b73, #c2f25e)" }}
      />
      <span className="flex flex-col items-start leading-none">
        <span className="font-mono text-xs text-fg">7xKQ…b9Yz</span>
        <span className="text-[9px] uppercase tracking-wider text-faint">
          devnet{vaults > 0 ? ` · ${vaults} vault${vaults > 1 ? "s" : ""}` : ""}
        </span>
      </span>
      <CaretDownIcon size={12} className="text-faint transition-colors group-hover:text-muted" />
    </button>
  );
}
