/** Slipstream wordmark + a minimal "draft lines" mark (single geometric glyph). */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <SlipstreamMark className="h-5 w-5" />
      <span className="text-[15px] font-semibold tracking-tight text-fg">Slipstream</span>
    </div>
  );
}

export function SlipstreamMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 7h14" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 12h18" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" opacity="0.78" />
      <path d="M3 17h10" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
