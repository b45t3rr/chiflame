import {
  b64urlToBytes,
  bytesToB64url,
  encryptMessage,
  messageAad,
  open,
  type MessagePlaintext,
} from "@chiflame/crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { authedClient } from "./api.js"
import { requirePaired, saveConfig, type CliConfig } from "./config.js"
import { CliError, EXIT } from "./exit.js"

const PRIORITIES = new Set(["min", "low", "default", "high", "urgent"])

function parseTtl(ttl?: string): string | null {
  if (!ttl) return null
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl)
  if (!m) throw new CliError("invalid_ttl", "ttl must look like 30s, 5m, 1h, 7d", EXIT.usage)
  const n = Number(m[1])
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "s" | "m" | "h" | "d"]
  return new Date(Date.now() + n * mult).toISOString()
}

async function cdkForSlug(
  cfg: CliConfig,
  sb: SupabaseClient,
  slug: string,
  configPath: string,
): Promise<{ id: string; cdk: Uint8Array }> {
  requirePaired(cfg)
  const local = Object.entries(cfg.keys.channels).find(([, v]) => v.slug === slug)
  if (local) return { id: local[0], cdk: b64urlToBytes(local[1].cdk) }

  const { data: keys, error } = await sb
    .from("device_channel_keys")
    .select("channel_id, wrapped_cdk")
    .eq("device_id", cfg.device_id)
  if (error) throw new CliError("error", error.message)
  const { data: channels } = await sb.from("channels").select("id, slug")
  const byId = new Map((channels ?? []).map((c) => [c.id as string, c.slug as string]))
  for (const row of keys ?? []) {
    const s = byId.get(row.channel_id as string)
    if (s !== slug) continue
    const cdk = open(cfg.keys.device_x25519_sk, row.wrapped_cdk as string)
    const id = row.channel_id as string
    cfg.keys.channels[id] = { slug, cdk: bytesToB64url(cdk) }
    saveConfig(cfg, configPath)
    return { id, cdk }
  }
  throw new CliError("unknown_channel", `Unknown channel '${slug}'`, EXIT.usage)
}

export async function sendMessage(
  cfg: CliConfig,
  configPath: string,
  opts: {
    slug: string
    body: string
    title?: string
    priority?: string
    ttl?: string
    click?: string
    json: boolean
    quiet: boolean
  },
): Promise<number> {
  requirePaired(cfg)
  if (!opts.body.trim()) throw new CliError("missing_message", "Message body required", EXIT.usage)
  const priority = opts.priority ?? "default"
  if (!PRIORITIES.has(priority)) throw new CliError("invalid_priority", "priority must be min|low|default|high|urgent", EXIT.usage)
  if (opts.click && !opts.click.startsWith("https:")) {
    throw new CliError("invalid_click", "--click must be an https URL", EXIT.usage)
  }

  const sb = await authedClient(cfg, configPath)
  const { id: channelId, cdk } = await cdkForSlug(cfg, sb, opts.slug, configPath)
  const messageId = crypto.randomUUID()
  const plaintext: MessagePlaintext = { body: opts.body }
  if (opts.title) plaintext.title = opts.title.slice(0, 80)
  if (opts.click) plaintext.click = opts.click
  const aad = messageAad(messageId, channelId, cfg.device_id)
  const enc = encryptMessage(cdk, plaintext, aad)

  const { error } = await sb.from("messages").insert({
    id: messageId,
    channel_id: channelId,
    sender_device_id: cfg.device_id,
    ciphertext: enc.ciphertext,
    nonce: enc.nonce,
    alg: enc.alg,
    priority,
    expires_at: parseTtl(opts.ttl),
  })
  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      throw new CliError("revoked", "Device revoked or cannot publish", EXIT.revoked)
    }
    throw new CliError("error", error.message)
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, id: messageId, channel: opts.slug }) + "\n")
  } else if (!opts.quiet) {
    process.stderr.write(`sent ${messageId} → ${opts.slug}\n`)
  }
  return EXIT.ok
}


