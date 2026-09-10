export function relativeTime(iso: string): string {
  const d = Date.parse(iso)
  const s = Math.round((Date.now() - d) / 1000)
  if (s < 45) return "ahora"
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  if (s < 604800) return `${Math.round(s / 86400)}d`
  return new Date(d).toLocaleDateString()
}
