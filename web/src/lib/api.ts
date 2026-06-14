import type {
  Constraints,
  Health,
  HeatmapBin,
  LeaderStats,
  ScoutResult,
  SessionInfo,
  SquadPick,
  VaultState,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `GET ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `POST ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<Health>("/health"),
  leaders: () => getJson<LeaderStats[]>("/leaders"),
  heatmap: () => getJson<HeatmapBin[]>("/heatmap"),
  scout: (constraints: Constraints) => postJson<ScoutResult>("/scout", { constraints }),
  analyze: (constraints: Constraints, owners: string[]) =>
    postJson<ScoutResult>("/analyze", { constraints, owners }),
  createSession: (constraints: Constraints) => postJson<SessionInfo>("/session", { constraints }),
  state: (session: string) => getJson<VaultState>(`/state?session=${encodeURIComponent(session)}`),
  follow: (session: string, squad: SquadPick[]) =>
    postJson<{ fill: unknown; state: VaultState }>("/follow", { session, squad }),
  stress: (session: string) => postJson<VaultState>("/stress", { session }),
};
