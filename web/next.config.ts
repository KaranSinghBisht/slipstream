import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this app (repo root also has a lockfile).
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
