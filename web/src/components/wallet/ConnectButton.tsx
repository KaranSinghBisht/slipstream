"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SignOutIcon, WalletIcon } from "@phosphor-icons/react";

export function ConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid a hydration mismatch — wallet state only exists client-side.
  if (!mounted) return <div className="h-9 w-[132px] rounded-full bg-white/[0.04] ring-1 ring-line" />;

  const addr = publicKey?.toBase58();
  if (addr) {
    return (
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className="group inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2 text-xs font-medium text-fg ring-1 ring-line transition-colors hover:bg-white/[0.08]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring" />
        <span className="font-mono">{addr.slice(0, 4)}…{addr.slice(-4)}</span>
        <SignOutIcon size={13} className="text-muted transition-colors group-hover:text-short" />
      </button>
    );
  }
  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-sm font-semibold tracking-tight text-fg ring-1 ring-line transition-colors hover:bg-white/[0.08] disabled:opacity-60"
    >
      <WalletIcon size={15} weight="fill" className="text-accent" />
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
