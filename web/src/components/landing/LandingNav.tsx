"use client";
import Link from "next/link";
import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react";
import { Brand } from "@/components/Brand";

const REPO = "https://github.com/KaranSinghBisht/slipstream";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <nav className="flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-line bg-ink/60 py-2 pl-5 pr-2 backdrop-blur-xl">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Brand />
        </Link>
        <div className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-fg">How it works</a>
          <a href="#guard" className="transition-colors hover:text-fg">The guard</a>
          <a href="#mcp" className="transition-colors hover:text-fg">Claude MCP</a>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-muted ring-1 ring-line transition-colors hover:text-fg sm:flex"
          >
            <GithubLogoIcon size={16} />
          </a>
          <Link
            href="/app"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold tracking-tight text-[#04130d] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#43e0a6] active:scale-[0.98]"
          >
            Launch app
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15 transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRightIcon size={12} weight="bold" />
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
