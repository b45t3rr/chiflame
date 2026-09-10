import { get, set } from "idb-keyval"
import { b64urlToBytes, decryptMessage, messageAad, unwrapSecret } from "@chiflame/crypto"

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] }

if (typeof console !== "undefined" && console.debug) console.debug("wb_manifest", self.__WB_MANIFEST)

const SUPABASE_URL = "https://tnormabytsycjwnwrvip.supabase.co"
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRub3JtYWJ5dHN5Y2p3bndydmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MDc3NjAsImV4cCI6MjEwNDQ4Mzc2MH0.Rg3OyB210pEz94J5PyHrseWRxx_DYuspdqrROmJZ824"
const VAPID_PUBLIC_KEY = "BJ7pxrVger9PpshdHTJ6NnDIuD8nwkBXUGUWfGgkrJq9r8o8esms_UhqprxhWxze4cfWIzK0UKFh54GI2yClv3M"

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()))
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))
self.addEventListener("push", (event) => event.waitUntil(handlePush(event)))
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const data = event.notification.data as { slug?: string; messageId?: string } | undefined
  const url = data?.slug && data.messageId ? `/c/${data.slug}/m/${data.messageId}` : "/inbox"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => "focus" in client) as WindowClient | undefined
      if (existing) {
        await existing.focus()
        await existing.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    }),
  )
})
self.addEventListener("pushsubscriptionchange", (event) => event.waitUntil(renewPushSubscription()))

const FALLBACK = { title: "Chiflame", body: "Nuevo mensaje" }

async function handlePush(event: PushEvent) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  if (windows.some((client) => client.visibilityState === "visible")) return
  const payload = readPayload(event)
  const preview = (await get<boolean>("previewOn")) !== false
  const deviceKeyB64 = await get<string>("deviceKey")
  const wrapped = (await get<Record<string, string>>("wrappedCdks")) ?? {}
  const index = (await get<Record<string, { slug: string }>>("channelIndex")) ?? {}
  const tag = payload.message_id
  const data = { slug: index[payload.channel_id ?? ""]?.slug ?? "inbox", messageId: payload.message_id }
  if (!preview || !deviceKeyB64 || !payload.message_id || !payload.channel_id) {
    await self.registration.showNotification(FALLBACK.title, { body: FALLBACK.body, tag, data })
    return
  }
  try {
    const wrappedCdk = wrapped[payload.channel_id]
    if (!wrappedCdk) throw new Error("no cdk")
    const row = await fetchMessage(payload.message_id)
    if (!row) throw new Error("no msg")
    const cdk = unwrapSecret(b64urlToBytes(deviceKeyB64), wrappedCdk)
    const pt = decryptMessage(cdk, { alg: "xchacha20poly1305", nonce: row.nonce, ciphertext: row.ciphertext }, messageAad(row.id, row.channel_id, row.sender_device_id))
    const slug = index[payload.channel_id]?.slug ?? "inbox"
    await self.registration.showNotification(pt.title?.trim() || FALLBACK.title, { body: pt.body?.trim() || FALLBACK.body, tag, data: { slug, messageId: payload.message_id } })
  } catch {
    await self.registration.showNotification(FALLBACK.title, { body: FALLBACK.body, tag, data })
  }
}

function readPayload(event: PushEvent): { message_id?: string; channel_id?: string } {
  if (!event.data) return {}
  try { return event.data.json() as { message_id?: string; channel_id?: string } } catch {
    try { return JSON.parse(event.data.text()) as { message_id?: string; channel_id?: string } } catch { return {} }
  }
}

function jwtExpired(token: string): boolean {
  try {
    const part = token.split(".")[1]
    if (!part) return true
    const pad = "=".repeat((4 - (part.length % 4)) % 4)
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/") + pad)
    const exp = (JSON.parse(json) as { exp?: number }).exp
    return typeof exp !== "number" || exp * 1000 < Date.now() + 15_000
  } catch { return true }
}

async function accessToken(): Promise<string | null> {
  let access = (await get<string>("accessToken")) ?? null
  const refresh = (await get<string>("refreshToken")) ?? null
  if (access && !jwtExpired(access)) return access
  if (!refresh) return access
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }) })
  if (!res.ok) return access
  const data = (await res.json()) as { access_token?: string; refresh_token?: string }
  if (data.access_token) { await set("accessToken", data.access_token); access = data.access_token }
  if (data.refresh_token) await set("refreshToken", data.refresh_token)
  return access
}

async function renewPushSubscription() {
  const deviceId = await get<string>("deviceId")
  const access = await accessToken()
  if (!deviceId || !access) return
  const padding = "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4)
  const raw = atob((VAPID_PUBLIC_KEY + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const key = Uint8Array.from(raw, (char) => char.charCodeAt(0))
  const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await fetch(`${SUPABASE_URL}/functions/v1/push-register`, { method: "POST", headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify({ device_id: deviceId, subscription: subscription.toJSON() }) })
}

async function fetchMessage(id: string): Promise<{ id: string; channel_id: string; sender_device_id: string; ciphertext: string; nonce: string } | null> {
  const token = (await accessToken()) ?? SUPABASE_ANON
  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${encodeURIComponent(id)}&select=*`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, Accept: "application/json" } })
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ id: string; channel_id: string; sender_device_id: string; ciphertext: string; nonce: string }>
  return rows[0] ?? null
}
