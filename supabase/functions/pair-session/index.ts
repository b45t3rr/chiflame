import { errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { serviceClient, userClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const users = userClient(req)
  const { data: authData, error: authErr } = await users.auth.getUser()
  if (authErr || !authData.user) return errorJson("unauthorized", "Sign in required", 401)

  let body: { pairing_id?: string }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }
  if (!body.pairing_id) return errorJson("invalid_request", "pairing_id required", 400)

  const db = serviceClient()
  await db.rpc("expire_pairings")
  const { data: session, error } = await db
    .from("pairing_sessions")
    .select("id, cli_public_key, cli_name, verify_code, status, expires_at")
    .eq("id", body.pairing_id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) return errorJson("server_error", "Unable to load pairing session", 500)
  if (!session) return errorJson("not_found", "Unknown or expired pairing session", 404)
  return json({ session })
})
