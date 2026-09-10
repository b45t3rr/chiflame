import { bytesToB64url, newChannelDataKey, seal } from "@chiflame/crypto"
import { authedClient } from "./api.js"
import { requirePaired, saveConfig, type CliConfig } from "./config.js"
import { CliError, EXIT } from "./exit.js"

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/

export async function listChannels(cfg: CliConfig, configPath: string, jsonMode: boolean): Promise<number> {
  requirePaired(cfg)
  const sb = await authedClient(cfg, configPath)
  const { data, error } = await sb.from("channels").select("id, slug, name, kind").order("slug")
  if (error) throw new CliError("error", error.message)
  if (jsonMode) process.stdout.write(JSON.stringify({ ok: true, channels: data }) + "\n")
  else {
    for (const c of data ?? []) process.stdout.write(`${c.slug}\t${c.name}\t${c.kind}\n`)
  }
  return EXIT.ok
}

export async function createChannel(
  cfg: CliConfig,
  configPath: string,
  slug: string,
  name: string | undefined,
  jsonMode: boolean,
): Promise<number> {
  requirePaired(cfg)
  if (!SLUG.test(slug) || slug === "inbox") {
    throw new CliError("invalid_slug", "slug must match [a-z0-9][a-z0-9_-]{0,63} and not be inbox", EXIT.usage)
  }
  const sb = await authedClient(cfg, configPath)
  const { data: profile, error: pErr } = await sb.from("profiles").select("id, public_key").eq("id", cfg.user_id).single()
  if (pErr || !profile) throw new CliError("error", pErr?.message ?? "no profile")

  const { data: channel, error: cErr } = await sb
    .from("channels")
    .insert({ owner_id: cfg.user_id, slug, name: name ?? slug, kind: "personal" })
    .select("id, slug, name")
    .single()
  if (cErr || !channel) throw new CliError("error", cErr?.message ?? "create failed")

  const cdk = newChannelDataKey()
  const { error: mErr } = await sb.from("channel_members").insert({
    channel_id: channel.id,
    user_id: cfg.user_id,
    role: "owner",
    wrapped_channel_key: seal(profile.public_key, cdk),
  })
  if (mErr) throw new CliError("error", mErr.message)

  const { data: clis } = await sb.from("devices").select("id, public_key").eq("kind", "cli").is("revoked_at", null)
  for (const d of clis ?? []) {
    if (!d.public_key) continue
    await sb.from("device_channel_keys").upsert({
      device_id: d.id,
      channel_id: channel.id,
      wrapped_cdk: seal(d.public_key, cdk),
    })
  }

  cfg.keys!.channels[channel.id] = { slug: channel.slug, cdk: bytesToB64url(cdk) }
  saveConfig(cfg, configPath)

  if (jsonMode) process.stdout.write(JSON.stringify({ ok: true, channel }) + "\n")
  else process.stderr.write(`created ${channel.slug}\n`)
  return EXIT.ok
}
