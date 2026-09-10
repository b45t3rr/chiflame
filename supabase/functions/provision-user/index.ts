import { clientIp, errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { serviceClient } from "../_shared/supabase.ts"

const ipHits = new Map<string, number[]>()
function isRateLimited(ip: string, limit = 10, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now()
  const timestamps = (ipHits.get(ip) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= limit) return true
  timestamps.push(now)
  ipHits.set(ip, timestamps)
  return false
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const ip = clientIp(req)
  if (isRateLimited(ip, 10, 60 * 60 * 1000)) {
    return errorJson("rate_limited", "Too many account creation attempts. Try again later.", 429)
  }

  let body: { email?: string; password?: string }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password || password.length < 8 || password.length > 128) {
    return errorJson("invalid_request", "Valid email and password (8-128 chars) required", 400)
  }

  if (!EMAIL_RE.test(email) || email.length > 255) {
    return errorJson("invalid_request", "Invalid email format", 400)
  }

  const db = serviceClient()
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    return errorJson("server_error", error?.message ?? "createUser failed", 400)
  }
  return json({ user_id: data.user.id })
})
