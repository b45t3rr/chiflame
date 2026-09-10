import { errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { serviceClient, userClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const users = userClient(req)
  const { data: authData } = await users.auth.getUser()
  if (!authData.user) return errorJson("unauthorized", "Sign in required", 401)

  let body: { device_id?: string }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }
  if (!body.device_id) return errorJson("invalid_request", "device_id required", 400)

  const db = serviceClient()
  const { data: device } = await db
    .from("devices")
    .select("id, user_id")
    .eq("id", body.device_id)
    .maybeSingle()
  if (!device || device.user_id !== authData.user.id) {
    return errorJson("not_found", "Device not found", 404)
  }

  await db.from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", device.id)
  await db.from("push_subscriptions").delete().eq("device_id", device.id)
  return json({ ok: true })
})
