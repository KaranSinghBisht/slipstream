const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const compactUsd = (n: number) => `$${compact.format(n)}`;

export const price = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export const usd2 = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export const pct = (n: number, d = 1) => `${n >= 0 ? "" : ""}${n.toFixed(d)}%`;

export const signedPct = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

export const addr = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;

export const num = (n: number, d = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
