import type { ReactNode } from "react";

/** The app uses a local demo account chip (no wallet-adapter), so there's no
 *  provider here — keeps stray browser wallets (e.g. MetaMask) from probing. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
