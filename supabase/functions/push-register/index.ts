import { errorJson, json, optionsResponse, readJson } from "../_shared/http.ts"
import { userClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const db = userClient(req)
  const { data: authData } = await db.auth.getUser()
  if (!authData.user) return errorJson("unauthorized", "Sign in required", 401)

  let body: {
    device_id?: string
    subscription?: { endpoint?: string; expirationTime?: number | null; keys?: { p256dh?: string; auth?: string } }
  }
  try {
    body = await readJson(req)
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  if (!body.device_id || !endpoint || !p256dh || !auth) {
    return errorJson("invalid_request", "device_id and subscription required", 400)
  }

  const exp = body.subscription?.expirationTime
  const { error } = await db.from("push_subscriptions").upsert(
    {
      device_id: body.device_id,
      user_id: authData.user.id,
      endpoint,
      p256dh,
      auth,
      expiration_time: typeof exp === "number" ? new Date(exp).toISOString() : null,
    },
    { onConflict: "endpoint" },
  )
  if (error) return errorJson("server_error", error.message, 500)
  return json({ ok: true })
})
