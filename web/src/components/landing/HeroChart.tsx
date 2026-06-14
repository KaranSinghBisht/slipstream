"use client";
import { PnlChart } from "@/components/PnlChart";

// The money shot, frozen: both lines fall together, then yours locks at the
// stop while the leader keeps bleeding. Sample shape from a real devnet run.
const SAMPLES = [
  { you: 0, leader: 0 },
  { you: 0, leader: 0 },
  { you: -6, leader: -6 },
  { you: -13, leader: -13 },
  { you: -23, leader: -23 },
  { you: -23, leader: -39 },
  { you: -23, leader: -59 },
  { you: -23, leader: -82 },
];

export function HeroChart() {
  return <PnlChart samples={SAMPLES} firedAt={4} alloc={1000} />;
}
