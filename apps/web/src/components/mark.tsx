export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" className="fill-foreground text-background" />
      <path d="M6.5 14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-background" />
      <path d="M10 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-background" />
      <path d="M13.5 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-background" />
      <path d="M17 14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-background" />
    </svg>
  )
}

