import {
  fingerprintPublicKey,
  generateEd25519,
  generateX25519,
  newNonce32,
  open,
  pairingPopMessage,
  signBytes,
  utf8decode,
} from "@chiflame/crypto"
import qrcode from "qrcode-terminal"
import { fn, log } from "../api.js"
import { saveConfig, type CliConfig } from "../config.js"
import { DEFAULT_APP_URL } from "../defaults.js"
import { CliError, EXIT } from "../exit.js"

type InitRes = {
  id: string
  verify_code: string
  expires_at: string
  qr_url: string
  poll_after_ms: number
  error?: { code: string; message: string }
}

type PollRes = {
  status?: string
  channel_keys_sealed?: string
  session?: {
    access_token: string
    refresh_token: string
    user_id: string
    device_id: string
  }
  error?: { code: string; message: string }
}

type SealedChannels = {
  channels: { id: string; slug: string; cdk: string }[]
}

export async function authPair(cfg: CliConfig, configPath: string, flags: { json: boolean; quiet: boolean }): Promise<number> {
  const tty = Boolean(process.stdout.isTTY) && process.env.CI !== "1"
  if (!tty) throw new CliError("pairing_requires_tty", "chifla auth pair requires a TTY", EXIT.usage)

  const x = generateX25519()
  const e = generateEd25519()
  const hostname = process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "cli"

  const appOrigin = (process.env.CHIFLA_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "")
  const init = await fn<InitRes>(cfg, "pair-init", {
    cli_public_key: x.publicKey,
    cli_sign_public_key: e.publicKey,
    cli_name: hostname,
    app_origin: appOrigin,
  })
  if (init.status !== 201 || !init.data || init.data.error) {
    throw new CliError(init.data?.error?.code ?? "error", init.data?.error?.message ?? "pair-init failed")
  }

  const qrUrl = `${appOrigin}/pair/${init.data.id}`
  const fp = fingerprintPublicKey(x.publicKey)
  if (!flags.quiet) {
    process.stderr.write("\n  \x1b[1mChiflame Pairing\x1b[0m\n\n")
    process.stderr.write("  Escaneá este código con tu teléfono:\n\n")
    qrcode.generate(qrUrl, { small: true }, (qr) => {
      const indented = qr
        .split("\n")
        .map((l) => "    " + l)
        .join("\n")
      process.stderr.write(indented + "\n\n")
    })
    process.stderr.write(`  O abrí este enlace:\n    \x1b[4m\x1b[36m${qrUrl}\x1b[0m\n\n`)
    process.stderr.write(
      `  Código de confirmación en la app:\n\n      \x1b[1m\x1b[32m${init.data.verify_code.split("").join(" ")}\x1b[0m\n\n`,
    )
    process.stderr.write(`  Huella: \x1b[2m${fp}\x1b[0m\n`)
    process.stderr.write(`  \x1b[2mEsperando confirmación...\x1b[0m\n\n`)
  }

  const deadline = Date.parse(init.data.expires_at) + 5000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, init.data!.poll_after_ms ?? 1000))
    const nonce = newNonce32()
    const sig = signBytes(e.secretKey, pairingPopMessage(init.data.id, nonce))
    const poll = await fn<PollRes>(cfg, "pair-poll", {
      pairing_id: init.data.id,
      cli_public_key: x.publicKey,
      nonce,
      signature: sig,
    })
    if (poll.status === 204) continue
    if (poll.status === 410) {
      throw new CliError(poll.data?.error?.code ?? "pairing_expired", poll.data?.error?.message ?? "expired", EXIT.pairing)
    }
    if (poll.status === 401) {
      throw new CliError(poll.data?.error?.code ?? "unauthorized", poll.data?.error?.message ?? "poll unauthorized", EXIT.pairing)
    }
    if (poll.status >= 500) continue
    if (poll.status !== 200 || !poll.data?.channel_keys_sealed || !poll.data.session?.access_token) {
      throw new CliError(poll.data?.error?.code ?? "error", poll.data?.error?.message ?? "poll failed")
    }

    const opened = open(x.secretKey, poll.data.channel_keys_sealed)
    const payload = JSON.parse(utf8decode(opened)) as SealedChannels
    const channels: Record<string, { slug: string; cdk: string }> = {}
    for (const ch of payload.channels ?? []) {
      channels[ch.id] = { slug: ch.slug, cdk: ch.cdk }
    }

    cfg.user_id = poll.data.session.user_id
    cfg.device_id = poll.data.session.device_id
    cfg.session = {
      access_token: poll.data.session.access_token,
      refresh_token: poll.data.session.refresh_token,
    }
    cfg.keys = {
      device_x25519_sk: x.secretKey,
      device_x25519_pk: x.publicKey,
      device_ed25519_sk: e.secretKey,
      device_ed25519_pk: e.publicKey,
      channels,
    }
    saveConfig(cfg, configPath)
    const slugs = Object.values(channels).map((c) => c.slug)
    if (flags.json) {
      process.stdout.write(
        JSON.stringify({ ok: true, device_id: cfg.device_id, user_id: cfg.user_id, channels: slugs }) + "\n",
      )
    } else {
      log(flags.quiet, `Paired as ${hostname}. Channels: ${slugs.join(", ") || "(none)"}`)
    }
    return EXIT.ok
  }
  throw new CliError("pairing_expired", "Timed out waiting for the app to confirm", EXIT.pairing)
}


