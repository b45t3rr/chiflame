import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { loadConfig, saveConfig, type CliConfig } from "./config.js"
import { CliError, EXIT } from "./exit.js"

export async function fn<T>(
  cfg: CliConfig,
  slug: string,
  body: unknown,
  opts: { auth?: string } = {},
): Promise<{ status: number; data: T | null }> {
  const url = `${cfg.server}/functions/v1/${slug}`
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anon_key,
        Authorization: `Bearer ${opts.auth ?? cfg.anon_key}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new CliError("network", e instanceof Error ? e.message : "network", EXIT.network)
  }
  if (res.status === 204) return { status: 204, data: null }
  const data = (await res.json()) as T
  return { status: res.status, data }
}

export function userClient(cfg: CliConfig): SupabaseClient {
  return createClient(cfg.server, cfg.anon_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function authedClient(cfg: CliConfig, configPath: string): Promise<SupabaseClient> {
  if (!cfg.session) throw new CliError("not_paired", "Run chifla auth pair", EXIT.usage)
  const sb = userClient(cfg)
  const { data, error } = await sb.auth.setSession({
    access_token: cfg.session.access_token,
    refresh_token: cfg.session.refresh_token,
  })
  if (error || !data.session) {
    throw new CliError("revoked", "Session expired or device revoked. Run chifla auth pair", EXIT.revoked)
  }
  cfg.session = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }
  saveConfig(cfg, configPath)
  return sb
}

export function log(quiet: boolean, msg: string): void {
  if (!quiet) process.stderr.write(msg + "\n")
}

export { loadConfig, saveConfig }
