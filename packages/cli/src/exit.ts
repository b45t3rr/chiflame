export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  pairing: 3,
  revoked: 4,
  network: 5,
} as const

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode: number = EXIT.error,
  ) {
    super(message)
    this.name = "CliError"
  }
}

export function failJson(err: CliError | Error, jsonMode: boolean): never {
  const code = err instanceof CliError ? err.code : "error"
  const message = err.message
  const exitCode = err instanceof CliError ? err.exitCode : EXIT.error
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }) + "\n")
  } else {
    process.stderr.write(`error: ${message}\n`)
  }
  process.exit(exitCode)
}
