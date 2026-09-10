import { VAPID_PUBLIC_KEY } from "./env"
import { pushSupported } from "./platform"
import { callFn } from "./supabase"

function vapidBytes(): Uint8Array {
  const padding = "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4)
  const b64 = (VAPID_PUBLIC_KEY + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(label)), ms)
    p.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

let cached: ServiceWorkerRegistration | null = null

function isActive(reg: ServiceWorkerRegistration | null | undefined): reg is ServiceWorkerRegistration {
  return Boolean(reg?.active && reg.pushManager)
}

async function waitActive(reg: ServiceWorkerRegistration, ms = 5000): Promise<ServiceWorkerRegistration | null> {
  if (reg.active && reg.pushManager) return reg
  const worker = reg.installing ?? reg.waiting
  if (!worker) return reg.active && reg.pushManager ? reg : null
  return new Promise((resolve) => {
    const done = () => resolve(reg.active && reg.pushManager ? reg : null)
    const t = window.setTimeout(done, ms)
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        window.clearTimeout(t)
        done()
      }
    })
  })
}

export async function warmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  if (isActive(cached)) return cached

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    const ready = await waitActive(reg)
    if (ready) {
      cached = ready
      return ready
    }
  } catch {
    /* ignore */
  }

  try {
    const { registerSW } = await import("virtual:pwa-register")
    registerSW({ immediate: true })
  } catch {
    /* ignore */
  }

  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) {
    const ready = await waitActive(existing)
    if (ready) {
      cached = ready
      return ready
    }
  }

  try {
    const ready = await withTimeout(navigator.serviceWorker.ready, 6000, "sw_ready_timeout")
    if (isActive(ready)) {
      cached = ready
      return ready
    }
  } catch {
    /* ignore */
  }

  cached = null
  return null
}

export function pushWorkerReady(): boolean {
  return isActive(cached)
}

export function osNotificationPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported() || typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

/**
 * Must be called directly from a click handler (no await before this).
 * Starts the OS permission prompt in the same tick as the tap.
 */
export function startEnablePush(deviceId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return Promise.resolve({ ok: false, reason: "unsupported" })
  if (!VAPID_PUBLIC_KEY) return Promise.resolve({ ok: false, reason: "no_vapid" })
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return Promise.resolve({ ok: false, reason: "denied" })
  }

  const permP: Promise<NotificationPermission> =
    typeof Notification !== "undefined" && Notification.permission === "default"
      ? Notification.requestPermission()
      : Promise.resolve(typeof Notification !== "undefined" ? Notification.permission : "denied")

  const subP = navigator.serviceWorker.ready
    .then((reg) => {
      cached = reg
      return subscribePush(reg)
    })

  return finishEnablePush(deviceId, permP, subP)
}

function keysEqual(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const u = new Uint8Array(a)
  if (u.length !== b.length) return false
  for (let i = 0; i < u.length; i++) {
    if (u[i] !== b[i]) return false
  }
  return true
}

async function subscribePush(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key = vapidBytes()
  if (key.byteLength !== 65 || key[0] !== 4) throw new Error("vapid_bad")
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    if (keysEqual(existing.options?.applicationServerKey, key)) {
      return existing
    }
    try {
      await existing.unsubscribe()
      await new Promise((r) => setTimeout(r, 200))
    } catch {
      /* stale FCM endpoint after reinstall */
    }
  }
  const opts: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: key as unknown as BufferSource,
  }
  try {
    return await reg.pushManager.subscribe(opts)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/push service error/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 600))
      const fallbackOpts: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
        applicationServerKey: key.buffer as ArrayBuffer,
      }
      return await reg.pushManager.subscribe(fallbackOpts)
    }
    throw err
  }
}

async function finishEnablePush(
  deviceId: string,
  permP: Promise<NotificationPermission>,
  subP: Promise<PushSubscription | null>,
): Promise<{ ok: boolean; reason?: string }> {
  let sub: PushSubscription | null = null
  try {
    const [, s] = await withTimeout(Promise.all([permP, subP]), 12000, "timeout")
    sub = s
  } catch (e) {
    const msg = e instanceof Error ? e.message : "subscribe failed"
    if (msg === "timeout") return { ok: false, reason: "timeout" }
    if (/denied|not allowed|NotAllowedError/i.test(msg)) return { ok: false, reason: "denied" }
    if (/no_sw/.test(msg)) return { ok: false, reason: "no_sw" }
    if (/push service error|registration failed/i.test(msg)) return { ok: false, reason: `push_service: ${msg}` }
    return { ok: false, reason: msg }
  }

  if (!sub) {
    if (!isActive(cached)) return { ok: false, reason: "no_sw" }
    return { ok: false, reason: osNotificationPermission() === "denied" ? "denied" : "timeout" }
  }

  if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
    return { ok: false, reason: Notification.permission }
  }

  try {
    const { status, data } = await withTimeout(
      callFn<{ error?: { message: string } }>("push-register", {
        device_id: deviceId,
        subscription: sub.toJSON(),
      }),
      10000,
      "register_timeout",
    )
    if (status >= 400) return { ok: false, reason: data.error?.message ?? `HTTP ${status}` }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register failed"
    if (msg === "register_timeout") return { ok: false, reason: "register_timeout" }
    return { ok: false, reason: msg }
  }
}

export async function enablePush(deviceId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isActive(cached)) await warmServiceWorker()
  return startEnablePush(deviceId)
}

export async function ensurePush(deviceId: string): Promise<void> {
  if (!pushSupported() || typeof Notification === "undefined") return
  if (Notification.permission !== "granted" || !VAPID_PUBLIC_KEY) return
  if (!isActive(cached)) await warmServiceWorker()
  await startEnablePush(deviceId)
}

export function pushFailureCopy(reason?: string): string {
  if (reason === "denied") {
    return "El teléfono bloqueó las notificaciones. Ajustes del sistema → Apps → Chiflame → Notificaciones, y volvé a tocar."
  }
  if (reason === "no_sw") {
    return "El service worker no arrancó. Cerrá la app y abrila otra vez desde el icono, esperá un segundo y tocá de nuevo."
  }
  if (reason === "timeout") {
    return "El cartel no apareció (Chrome se quedó esperando). Cerrá la app, abrila desde el icono y tocá de nuevo. Si sigue, activá notificaciones en Ajustes del sistema."
  }
  if (reason === "register_timeout") return "El teléfono dio permiso, pero no pudimos registrar el push. Tocá de nuevo."
  if (/network:push-register|failed to fetch/i.test(reason ?? "")) {
    return "El teléfono dio permiso, pero no llegamos al servidor de push. Tocá de nuevo."
  }
  if (reason === "default") {
    return "No salió el cartel del sistema. Tocá de nuevo."
  }
  if (reason === "unsupported") return "Este navegador no soporta push."
  if (reason?.startsWith("push_service") || reason === "vapid_bad") {
    return `No se pudo conectar con el servicio de push de Android. Si tenés un bloqueador de publicidad o DNS privado (AdGuard/NextDNS) en el teléfono, desactivalo momentáneamente y volvé a tocar.`
  }
  return reason ?? "No se pudo activar"
}
