export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function errorJson(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status)
}

export function optionsResponse(): Response {
  return new Response("ok", { headers: corsHeaders })
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
}

export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

export function verifyCode6(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const b of bytes) out += CROCKFORD[b % 32]
  return out
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}
