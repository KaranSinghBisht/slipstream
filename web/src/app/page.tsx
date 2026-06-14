import { Backdrop } from "@/components/Backdrop";
import { LandingNav } from "@/components/landing/LandingNav";
import { PriceTicker } from "@/components/landing/PriceTicker";
import { Guard, Hero, HowItWorks, Mcp, LandingFooter } from "@/components/landing/sections";

export default function Landing() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      <Backdrop />
      <LandingNav />
      <main className="flex flex-col">
        <Hero />
        <PriceTicker />
        <Mcp />
        <HowItWorks />
        <Guard />
      </main>
      <LandingFooter />
    </div>
  );
}
