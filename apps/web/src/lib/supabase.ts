import { createClient } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export async function callFn<T>(slug: string, body: unknown): Promise<{ status: number; data: T }> {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token ?? SUPABASE_ANON_KEY
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network"
    throw new Error(`network:${slug}:${msg}`)
  }
  const data = (await res.json().catch(() => ({}))) as T
  return { status: res.status, data }
}
