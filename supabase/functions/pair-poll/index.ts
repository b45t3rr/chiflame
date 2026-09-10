import { corsHeaders, errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { verifyPairingPop } from "../_shared/pop.ts"
import { serviceClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  let body: {
    pairing_id?: string
    cli_public_key?: string
    nonce?: string
    signature?: string
  }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  if (!body.pairing_id || !body.cli_public_key || !body.nonce || !body.signature) {
    return errorJson("invalid_request", "pairing_id, cli_public_key, nonce, signature required", 400)
  }

  const db = serviceClient()
  await db.rpc("expire_pairings")

  const { data: session, error } = await db
    .from("pairing_sessions")
    .select("*")
    .eq("id", body.pairing_id)
    .maybeSingle()

  if (error) return errorJson("server_error", error.message, 500)
  if (!session) return errorJson("not_found", "Unknown pairing session", 410)

  if (session.cli_public_key !== body.cli_public_key) {
    return errorJson("unauthorized", "CLI key mismatch", 401)
  }

  const ok = verifyPairingPop({
    signPublicKey: session.cli_sign_public_key,
    pairingId: body.pairing_id,
    nonce: body.nonce,
    signature: body.signature,
  })
  if (!ok) return errorJson("unauthorized", "Invalid proof of possession", 401)

  if (session.status === "pending") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (
    session.status !== "completed" ||
    !session.wrapped_result ||
    !session.poll_access_token ||
    !session.poll_refresh_token
  ) {
    return errorJson(
      session.status === "denied" ? "pairing_denied" : "pairing_expired",
      `Pairing ${session.status}`,
      410,
    )
  }

  const channel_keys_sealed = session.wrapped_result
  const access_token = session.poll_access_token
  const refresh_token = session.poll_refresh_token
  await db
    .from("pairing_sessions")
    .update({ wrapped_result: null, poll_access_token: null, poll_refresh_token: null })
    .eq("id", session.id)

  return json({
    status: "completed",
    channel_keys_sealed,
    session: {
      access_token,
      refresh_token,
      expires_in: 3600,
      user_id: session.user_id,
      device_id: session.device_id,
    },
  })
})
