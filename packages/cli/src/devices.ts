import { authedClient, fn } from "./api.js"
import { requirePaired, saveConfig, type CliConfig } from "./config.js"
import { CliError, EXIT } from "./exit.js"

export async function listDevices(cfg: CliConfig, configPath: string, jsonMode: boolean): Promise<number> {
  requirePaired(cfg)
  const sb = await authedClient(cfg, configPath)
  const { data, error } = await sb
    .from("devices")
    .select("id, kind, name, revoked_at, last_seen_at, created_at")
    .order("created_at")
  if (error) throw new CliError("error", error.message)
  if (jsonMode) process.stdout.write(JSON.stringify({ ok: true, devices: data }) + "\n")
  else {
    for (const d of data ?? []) {
      const mark = d.id === cfg.device_id ? " (this)" : ""
      const rev = d.revoked_at ? " revoked" : ""
      process.stdout.write(`${d.kind}\t${d.name}${mark}${rev}\t${d.id}\n`)
    }
  }
  return EXIT.ok
}

export async function whoami(cfg: CliConfig, jsonMode: boolean): Promise<number> {
  if (jsonMode) {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        paired: Boolean(cfg.device_id),
        user_id: cfg.user_id ?? null,
        device_id: cfg.device_id ?? null,
        server: cfg.server,
      }) + "\n",
    )
  } else if (!cfg.device_id) {
    process.stdout.write("not paired\n")
  } else {
    process.stdout.write(`user ${cfg.user_id}\ndevice ${cfg.device_id}\nserver ${cfg.server}\n`)
  }
  return EXIT.ok
}

export async function authStatus(cfg: CliConfig, jsonMode: boolean): Promise<number> {
  return whoami(cfg, jsonMode)
}

export async function authUnpair(cfg: CliConfig, configPath: string, jsonMode: boolean): Promise<number> {
  if (cfg.device_id && cfg.session) {
    await fn(cfg, "device-revoke", { device_id: cfg.device_id }, { auth: cfg.session.access_token })
  }
  const next: CliConfig = {
    version: 1,
    server: cfg.server,
    anon_key: cfg.anon_key,
    default_channel: "inbox",
  }
  saveConfig(next, configPath)
  if (jsonMode) process.stdout.write(JSON.stringify({ ok: true, unpaired: true }) + "\n")
  else process.stderr.write("unpaired\n")
  return EXIT.ok
}
