"use client";
import type { ReactNode } from "react";
import { WalletProviders } from "@/components/wallet/WalletProviders";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
