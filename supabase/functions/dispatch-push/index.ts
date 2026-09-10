import { errorJson, json, optionsResponse, timingSafeEqual } from "../_shared/http.ts"
import { serviceClient } from "../_shared/supabase.ts"

const URGENCY: Record<string, string> = {
  min: "very-low",
  low: "low",
  default: "normal",
  high: "high",
  urgent: "high",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse()
  if (req.method !== "POST") return errorJson("method_not_allowed", "POST only", 405)

  const db = serviceClient()
  const { data: settingsRows } = await db.from("app_settings").select("key, value")
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key as string, r.value as string]))

  const secret = Deno.env.get("WEBHOOK_SECRET") ?? settings.webhook_secret
  const got = req.headers.get("x-webhook-secret")
  if (!secret || !got || !timingSafeEqual(got, secret)) {
    return errorJson("unauthorized", "Bad webhook secret", 401)
  }

  let payload: { record?: Record<string, unknown>; type?: string }
  try {
    payload = await req.json()
  } catch {
    return errorJson("bad_json", "Invalid JSON", 400)
  }

  const record = { ...(payload.record ?? {}) }
  delete record.ciphertext
  delete record.nonce

  const messageId = record.id as string | undefined
  const channelId = record.channel_id as string | undefined
  const priority = (record.priority as string | undefined) ?? "default"
  if (!messageId || !channelId) return errorJson("invalid_request", "record.id and channel_id required", 400)

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? settings.vapid_public
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? settings.vapid_private
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? settings.vapid_subject ?? "mailto:hello@chiflame.dev"
  if (!vapidPublic || !vapidPrivate) {
    return json({ ok: true, skipped: "vapid_not_configured" })
  }

  const { data: members } = await db
    .from("channel_members")
    .select("user_id, muted")
    .eq("channel_id", channelId)
    .eq("muted", false)

  const userIds = (members ?? []).map((m) => m.user_id as string)
  if (userIds.length === 0) return json({ ok: true, sent: 0 })

  const { data: activeDevices } = await db
    .from("devices")
    .select("id")
    .in("user_id", userIds)
    .is("revoked_at", null)
  const activeDeviceIds = new Set((activeDevices ?? []).map((d) => d.id as string))

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, device_id")
    .in("user_id", userIds)

  const activeSubs = (subs ?? []).filter((s) => activeDeviceIds.has(s.device_id as string))
  if (!activeSubs.length) return json({ ok: true, sent: 0 })

  const webpush = await import("npm:web-push@3.6.7")
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const body = JSON.stringify({
    v: 1,
    type: "message",
    message_id: messageId,
    channel_id: channelId,
    priority,
  })
  if ("title" in JSON.parse(body) || "body" in JSON.parse(body) || "ciphertext" in JSON.parse(body)) {
    return errorJson("invariant", "push payload must not include content", 500)
  }

  let sent = 0
  for (const sub of activeSubs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { urgency: URGENCY[priority] ?? "normal", TTL: 86400 },
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db.from("push_subscriptions").delete().eq("id", sub.id)
      }
    }
  }

  return json({ ok: true, sent })
})
