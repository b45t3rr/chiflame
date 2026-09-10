import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { DEFAULT_ANON_KEY, DEFAULT_SERVER } from "./defaults.js"
import { CliError, EXIT } from "./exit.js"

export type ChannelKey = { slug: string; cdk: string }

export type CliConfig = {
  version: 1
  server: string
  anon_key: string
  user_id?: string
  device_id?: string
  default_channel: string
  session?: { access_token: string; refresh_token: string }
  keys?: {
    device_x25519_sk: string
    device_ed25519_sk: string
    device_x25519_pk: string
    device_ed25519_pk: string
    channels: Record<string, ChannelKey>
  }
}

export function defaultConfigPath(): string {
  if (process.env.CHIFLA_CONFIG) return process.env.CHIFLA_CONFIG
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    return join(base, "chiflame", "config.json")
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(xdg, "chiflame", "config.json")
}

export function emptyConfig(server?: string, anon?: string): CliConfig {
  return {
    version: 1,
    server: server ?? process.env.CHIFLA_SERVER ?? DEFAULT_SERVER,
    anon_key: anon ?? process.env.CHIFLA_ANON_KEY ?? DEFAULT_ANON_KEY,
    default_channel: process.env.CHIFLA_CHANNEL ?? "inbox",
  }
}

export function loadConfig(path = defaultConfigPath()): CliConfig {
  if (!existsSync(path)) return emptyConfig()
  const raw = JSON.parse(readFileSync(path, "utf8")) as CliConfig
  return { ...emptyConfig(), ...raw, version: 1 }
}

export function saveConfig(cfg: CliConfig, path = defaultConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cfg, null, 2), { encoding: "utf8" })
  try {
    chmodSync(path, 0o600)
  } catch {
    /* windows */
  }
}

export function requirePaired(cfg: CliConfig): asserts cfg is CliConfig & {
  user_id: string
  device_id: string
  session: { access_token: string; refresh_token: string }
  keys: NonNullable<CliConfig["keys"]>
} {
  if (!cfg.user_id || !cfg.device_id || !cfg.session || !cfg.keys) {
    throw new CliError("not_paired", "Run chifla auth pair", EXIT.usage)
  }
}
