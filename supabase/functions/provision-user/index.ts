import { clientIp, errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { serviceClient } from "../_shared/supabase.ts"

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

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
  const { data: allowed, error: rateError } = await db.rpc("consume_edge_rate_limit", {
    p_bucket: `provision-user:${clientIp(req)}`,
    p_limit: 10,
    p_window_seconds: 3600,
  })
  if (rateError || !allowed) return errorJson("rate_limited", "Too many account creation attempts. Try again later.", 429)
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
