export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" className="fill-white" />
      <path d="M6.5 14V10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 17V7" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.5 19V5" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 14V10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
