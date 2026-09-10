#!/usr/bin/env node
import { authPair } from "./auth/pair.js"
import { createChannel, listChannels } from "./channels.js"
import { defaultConfigPath, emptyConfig, loadConfig } from "./config.js"
import { VERSION } from "./defaults.js"
import { authStatus, authUnpair, listDevices, whoami } from "./devices.js"
import { CliError, EXIT, failJson } from "./exit.js"
import { runCommand, waitProcess } from "./exec.js"
import { HELP } from "./help.js"
import { parseArgv } from "./parse.js"
import { sendMessage } from "./send.js"

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ""
  return await new Promise((resolve) => {
    const chunks: Buffer[] = []
    process.stdin.on("data", (c) => chunks.push(c as Buffer))
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()))
  })
}

async function main(argv: string[]): Promise<number> {
  let parsed
  try {
    parsed = parseArgv(argv)
  } catch (e) {
    throw new CliError("usage", e instanceof Error ? e.message : "bad args", EXIT.usage)
  }
  const { flags, command, args } = parsed
  if (flags.version) {
    process.stdout.write(VERSION + "\n")
    return EXIT.ok
  }
  if (flags.help || command === "help") {
    process.stdout.write(HELP)
    return EXIT.ok
  }

  const configPath = flags.config ?? defaultConfigPath()
  const cfg = loadConfig(configPath)
  if (flags.server) cfg.server = flags.server
  if (!cfg.server) Object.assign(cfg, emptyConfig(flags.server))

  if (command === "auth") {
    const sub = args[0]
    if (sub === "pair") return authPair(cfg, configPath, flags)
    if (sub === "status") return authStatus(cfg, flags.json)
    if (sub === "unpair") return authUnpair(cfg, configPath, flags.json)
    throw new CliError("usage", "auth pair | status | unpair", EXIT.usage)
  }

  if (command === "whoami") return whoami(cfg, flags.json)
  if (command === "devices") return listDevices(cfg, configPath, flags.json)

  if (command === "channels") {
    if (args[0] === "create") {
      const slug = args[1]
      if (!slug) throw new CliError("usage", "channels create <slug>", EXIT.usage)
      const nameIdx = args.indexOf("--name")
      const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined
      return createChannel(cfg, configPath, slug, name, flags.json)
    }
    return listChannels(cfg, configPath, flags.json)
  }

  if (command === "run") {
    return runCommand(cfg, configPath, args, flags)
  }

  if (command === "wait" || command === "watch") {
    return waitProcess(cfg, configPath, args[0], flags)
  }

  // send (default)
  let slug = flags.channel ?? cfg.default_channel ?? "inbox"
  let bodyParts = args
  if (command === "send" && args[0] && !args[0].includes(" ") && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(args[0]) && args.length > 1) {
    slug = args[0]
    bodyParts = args.slice(1)
  }
  let body = bodyParts.join(" ").trim()
  if (!body) body = await readStdin()
  if (!body && !process.stdout.isTTY && !process.stdin.isTTY) {
    throw new CliError("missing_message", "Message body required", EXIT.usage)
  }
  if (!body && process.stdout.isTTY && args.length === 0 && command === "send") {
    process.stdout.write(HELP)
    return EXIT.ok
  }
  if (!body) throw new CliError("missing_message", "Message body required", EXIT.usage)

  return sendMessage(cfg, configPath, {
    slug,
    body,
    title: flags.title,
    priority: flags.priority,
    ttl: flags.ttl,
    click: flags.click,
    json: flags.json,
    quiet: flags.quiet,
  })
}

const argv = process.argv.slice(2)
main(argv).then(
  (code) => process.exit(code),
  (err) => {
    const jsonMode = argv.includes("--json") || process.env.CHIFLA_JSON === "1"
    failJson(err instanceof Error ? err : new Error(String(err)), jsonMode)
  },
)


