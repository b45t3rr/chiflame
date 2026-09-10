const COMMANDS = new Set(["auth", "send", "channels", "devices", "whoami", "help", "run", "wait", "watch"])

export type GlobalFlags = {
  json: boolean
  quiet: boolean
  channel?: string
  title?: string
  priority?: string
  ttl?: string
  click?: string
  config?: string
  server?: string
  help: boolean
  version: boolean
  onError?: boolean
  lines?: number
  interval?: number
}

export type Parsed = {
  flags: GlobalFlags
  command: string
  args: string[]
}

export function parseArgv(argv: string[]): Parsed {
  const flags: GlobalFlags = {
    json: process.env.CHIFLA_JSON === "1",
    quiet: false,
    help: false,
    version: false,
  }
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === "--") {
      rest.push(...argv.slice(i + 1))
      break
    }
    if (rest[0] === "run" && rest.length >= 2) {
      rest.push(a)
      continue
    }
    if (a === "--json") flags.json = true
    else if (a === "--quiet" || a === "-q") flags.quiet = true
    else if (a === "--help" || a === "-h") flags.help = true
    else if (a === "--version" || a === "-v") flags.version = true
    else if (a === "--channel" || a === "-c") flags.channel = next()
    else if (a === "--title" || a === "-t") flags.title = next()
    else if (a === "--priority" || a === "-p") flags.priority = next()
    else if (a === "--ttl") flags.ttl = next()
    else if (a === "--click") flags.click = next()
    else if (a === "--config") flags.config = next()
    else if (a === "--server") flags.server = next()
    else if (a === "--on-error") flags.onError = true
    else if (a === "--lines") flags.lines = Number(next())
    else if (a === "--interval") flags.interval = Number(next())
    else if (a.startsWith("-")) {
      throw Object.assign(new Error(`Unknown flag ${a}`), { code: "usage" })
    } else rest.push(a)
  }
  if (process.env.CHIFLA_CHANNEL && !flags.channel) flags.channel = process.env.CHIFLA_CHANNEL
  const command = rest[0] && COMMANDS.has(rest[0]) ? rest[0] : "send"
  const args = command === "send" && rest[0] && !COMMANDS.has(rest[0]) ? rest : rest.slice(1)
  return { flags, command, args }
}

export { COMMANDS }

