import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

const noSession = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) throw new Error("missing_supabase_env")
  return createClient(url, key, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${key}` } },
  })
}

/** Anon client used only to mint a GoTrue session. Never reuse the service client for verifyOtp. */
export function mintClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const anon = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anon) throw new Error("missing_supabase_env")
  return createClient(url, anon, { auth: noSession })
}

export function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")
  const anon = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anon) throw new Error("missing_supabase_env")
  const auth = req.headers.get("Authorization") ?? ""
  return createClient(url, anon, {
    auth: noSession,
    global: { headers: { Authorization: auth } },
  })
}

export function appOrigin(): string {
  return Deno.env.get("APP_ORIGIN") ?? "https://app.chifla.me"
}


export function originFrom(raw?: string): string {
  const fallback = appOrigin()
  const value = raw?.trim()
  if (!value) return fallback
  try {
    const u = new URL(value)
    // The CLI may include its current origin, but pairing links must never be
    // redirected to an attacker-controlled host.
    const allowedOrigins = [fallback]
    return allowedOrigins.includes(u.origin) ? u.origin : fallback
  } catch {
    return fallback
  }
}
