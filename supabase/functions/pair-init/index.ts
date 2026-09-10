import { clientIp, errorJson, json, optionsResponse, readJson, verifyCode6 } from "../_shared/http.ts"
import { originFrom, serviceClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  let body: { cli_public_key?: string; cli_sign_public_key?: string; cli_name?: string; app_origin?: string }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  if (!body.cli_public_key || !body.cli_sign_public_key) {
    return errorJson("invalid_request", "cli_public_key and cli_sign_public_key required", 400)
  }

  const ip = clientIp(req)
  const db = serviceClient()
  const { data: allowed, error: rateError } = await db.rpc("consume_edge_rate_limit", {
    p_bucket: `pair-init:${ip}`,
    p_limit: 10,
    p_window_seconds: 3600,
  })
  if (rateError || !allowed) {
    return errorJson("rate_limited", "Too many pairing attempts", 429)
  }

  const verify_code = verifyCode6()
  const expires_at = new Date(Date.now() + 3 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from("pairing_sessions")
    .insert({
      cli_public_key: body.cli_public_key,
      cli_sign_public_key: body.cli_sign_public_key,
      cli_name: body.cli_name ?? "cli",
      verify_code,
      status: "pending",
      expires_at,
      client_ip: ip,
    })
    .select("id, verify_code, expires_at")
    .single()

  if (error || !data) {
    return errorJson("server_error", error?.message ?? "insert failed", 500)
  }

  return json(
    {
      id: data.id,
      verify_code: data.verify_code,
      expires_at: data.expires_at,
      qr_url: `${originFrom(body.app_origin)}/pair/${data.id}`,
      poll_after_ms: 1000,
    },
    201,
  )
})
