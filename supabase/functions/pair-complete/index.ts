import { errorJson, json, optionsResponse, readJson, timingSafeEqual } from "../_shared/http.ts"
import { mintClient, serviceClient, userClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const users = userClient(req)
  const { data: authData, error: authErr } = await users.auth.getUser()
  if (authErr || !authData.user) return errorJson("unauthorized", "Sign in required", 401)
  const user = authData.user

  let body: {
    pairing_id?: string
    verify_code?: string
    device_name?: string
    channel_keys_sealed?: string
  }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  if (!body.pairing_id || !body.verify_code || !body.channel_keys_sealed) {
    return errorJson("invalid_request", "pairing_id, verify_code, channel_keys_sealed required", 400)
  }

  const db = serviceClient()
  await db.rpc("expire_pairings")

  const { data: session, error } = await db
    .from("pairing_sessions")
    .select("*")
    .eq("id", body.pairing_id)
    .maybeSingle()

  if (error) return errorJson("server_error", error.message, 500)
  if (!session) return errorJson("not_found", "Unknown pairing session", 404)
  if (session.status !== "pending") {
    return errorJson("pairing_expired", `Pairing ${session.status}`, 410)
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.from("pairing_sessions").update({ status: "expired" }).eq("id", session.id)
    return errorJson("pairing_expired", "Pairing expired", 410)
  }
  if (!timingSafeEqual(session.verify_code, body.verify_code.toUpperCase())) {
    return errorJson("forbidden", "Verify code mismatch", 403)
  }

  const { data: profile } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle()
  if (!profile) return errorJson("no_vault", "Create a vault before pairing", 409)

  const { data: device, error: devErr } = await db
    .from("devices")
    .insert({
      user_id: user.id,
      kind: "cli",
      name: body.device_name ?? session.cli_name ?? "cli",
      public_key: session.cli_public_key,
      sign_public_key: session.cli_sign_public_key,
    })
    .select("id")
    .single()
  if (devErr || !device) return errorJson("server_error", devErr?.message ?? "device insert", 500)

  const email = user.email
  if (!email) return errorJson("server_error", "User has no email for session mint", 500)

  const { data: link, error: linkErr } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (linkErr || !link.properties?.hashed_token) {
    return errorJson("server_error", linkErr?.message ?? "generateLink failed", 500)
  }

  // verifyOtp must NOT run on the service client: it replaces Authorization with the
  // user JWT, and pairing_sessions has no UPDATE policy for authenticated → silent 0-row write.
  const mint = mintClient()
  const { data: minted, error: otpErr } = await mint.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  })
  if (otpErr || !minted.session?.access_token || !minted.session.refresh_token) {
    return errorJson("server_error", otpErr?.message ?? "verifyOtp failed", 500)
  }

  const { data: updated, error: upErr } = await db
    .from("pairing_sessions")
    .update({
      status: "completed",
      user_id: user.id,
      device_id: device.id,
      wrapped_result: body.channel_keys_sealed,
      poll_access_token: minted.session.access_token,
      poll_refresh_token: minted.session.refresh_token,
    })
    .eq("id", session.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (upErr) return errorJson("server_error", upErr.message, 500)
  if (!updated) return errorJson("server_error", "pairing session update matched 0 rows", 500)

  return json({ ok: true, device_id: device.id })
})
