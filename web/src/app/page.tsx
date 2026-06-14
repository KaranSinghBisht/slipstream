import { Backdrop } from "@/components/Backdrop";
import { LandingNav } from "@/components/landing/LandingNav";
import { LeaderTicker } from "@/components/landing/LeaderTicker";
import { Guard, Hero, HowItWorks, Mcp, LandingFooter } from "@/components/landing/sections";

export default function Landing() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <Backdrop />
      <LandingNav />
      <main className="flex flex-col">
        <Hero />
        <LeaderTicker />
        <HowItWorks />
        <Guard />
        <Mcp />
      </main>
      <LandingFooter />
    </div>
  );
}
