# Spec: cli

## Objective

Paquete npm `chiflame`, binario `chifla`. Pairing, send, channels, devices. Agent-first: `chifla "msg"` basta.

Ver [07-cli.md](./07-cli.md) y [11-agent-first.md](./11-agent-first.md).

## Tech Stack

- Node 20+, TypeScript, ESM
- CLI parser: `citty` o `commander` (uno)
- `@chiflame/crypto`, `@supabase/supabase-js`
- QR: `qrcode-terminal`
- Distribución: npm global (`bin` en package.json)

## Commands

```text
pnpm --filter @chiflame/cli build
pnpm --filter @chiflame/cli test
pnpm --filter @chiflame/cli exec chifla -- --help
node ./packages/cli/dist/index.js "hello" --json
```

## Project Structure

```text
packages/cli
  src/index.ts          argv router
  src/auth/*.ts
  src/send.ts
  src/config.ts
  test/*.test.ts
```

Binarios: `chifla`, `chiflame` → mismo entry.

## Code Style

```ts
// default verb
if (args[0] && !COMMANDS.has(args[0])) {
  return send({ channel: envChannel ?? 'inbox', body: args.join(' ') })
}
```

Humanos → stderr. `--json` → stdout. Tokens nunca a stdout (ni `--json` status: solo fingerprints).

## Testing Strategy

- Parse argv: `chifla "hola"`, `chifla send deploys hola`, flags.
- Config chmod en posix (skip windows o assert que no es world-readable si el FS lo permite).
- Pairing: mock pair-init/poll.
- Send: mock PostgREST, assert insert body tiene `ciphertext` y no `title`.
- Exit codes tabla de [07-cli.md](./07-cli.md).
- `CI=1` `auth pair` → exit 2.

## Boundaries

- Always: `--json` estable; no QR en no-TTY.
- Ask first: cambiar nombre del paquete npm; añadir `chifla listen`.
- Never: embebido service role; print de CDK; `eval` de mensajes.

## Success Criteria

- `npx chiflame --help` lista send y pairing.
- Tras pair (test harness), `chifla "hola"` hace INSERT cifrado y exit 0.
- Snippet AGENTS.md del repo docs es suficiente para un agente.
- Windows, macOS, Linux: mismos comandos (paths de config distintos).

## Open Questions

Ninguna de producto. Nombre npm: intentar `chiflame`; si está tomado, `@chiflame/cli`. Se verifica al publicar.
