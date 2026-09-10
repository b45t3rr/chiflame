# CLI — `chifla`

Paquete npm: **`chiflame`**. Binarios: **`chifla`** y alias **`chiflame`**.

Agent-first: el verbo por defecto es send. Detalle del contrato para agentes en [11-agent-first.md](./11-agent-first.md).

## Install

```text
npm i -g chiflame
npx chiflame auth pair
```

Node 20+. Sin dependencias nativas si se elige `@noble/*` puro JS (Argon2id: `@noble/hashes/argon2` o `hash-wasm`). Preferir sin binarios nativos para `npm i -g` sin pain en Windows.

## Comandos v1

```text
chifla auth pair
chifla auth status
chifla auth unpair
chifla send [channel] <msg>
chifla <msg>
echo "done" | chifla
chifla run [flags] <cmd...>
chifla wait [flags] <PID>
chifla channels
chifla channels create <slug> [--name <name>]
chifla devices
chifla whoami
chifla --help
chifla --version
```

`chifla` sin args y TTY → help. Sin TTY y stdin con data → send inbox. Sin TTY, sin stdin → exit 2 + JSON error `not_paired` o `missing_message`.

## Flags globales

| Flag | Env | Efecto |
|---|---|---|
| `--json` | `CHIFLA_JSON=1` | stdout = JSON; humanos a stderr |
| `--quiet` / `-q` | | sin stderr salvo errores |
| `--channel` / `-c <slug>` | `CHIFLA_CHANNEL` | default override |
| `--title` / `-t <title>` | | plaintext title (se cifra) |
| `--priority` / `-p` | | `min\|low\|default\|high\|urgent` |
| `--ttl <duration>` | | `expires_at` relativo (`1h`, `7d`) |
| `--click <url>` | | URL https en el plaintext (botón Abrir en la PWA) |
| `--on-error` | | solo notificar si el comando falla (para `run`) |
| `--lines <N>` | | capturar las últimas N líneas de salida (default: 15) |
| `--interval <sec>` | | intervalo de polling en segundos (para `wait`, default: 1) |
| `--config <path>` | `CHIFLA_CONFIG` | path de config |
| `--server <url>` | `CHIFLA_SERVER` | override Supabase URL (dev) |


`--json` + `--quiet`: stdout JSON, stderr vacío si ok.

## `auth pair`

1. Genera pares X25519 + Ed25519 de device.
2. `POST pair-init`.
3. Imprime QR (ansi), `verify_code` grande, fingerprint, URL.
4. Poll 1s hasta completed / expired / denied / Ctrl+C.
5. Unseal `channel_keys_sealed`, guarda session + CDKs en config (mode 0600).
6. Exit 0. `--json`: `{ "device_id", "user_id", "channels": ["inbox"] }`.

Exige TTY. `CI=1` sin TTY → exit 2 `pairing_requires_tty`.

QR: `qr_url + '#' + cli_public_key`.

## `send`

- Resuelve channel slug → id (cache local). Si no hay CDK local, `GET device_channel_keys` para este `device_id` y unseal (canales creados en la PWA después del pair).
- Genera `message_id` uuid, cifra `{ title, body, click? }` con AAD `id|channel_id|device_id`.
- `INSERT messages` con ese `id`, `sender_device_id`, ciphertext.
- Exit 0 = **aceptado por el server**, no “el humano lo vio”.

## `channels create`

Genera CDK, INSERT canal + `channel_members` (sealed a `profiles.public_key`) + `device_channel_keys` para **todas** las CLIs activas del user (la PWA abre el member wrap; las otras CLIs el device wrap).

## `run`

Ejecuta un comando hijo, transmite su salida en vivo por consola y envía una notificación E2EE al terminar:

```text
chifla run npm test
chifla run -t "Deploy Producción" ./deploy.sh
chifla run --on-error npm run build
chifla run -- cargo build --release
```

- Mide la duración automáticamente (`12s`, `2m 45s`).
- Si termina con código 0: envía notificación de éxito (`default` priority).
- Si falla: envía notificación con prioridad `urgent` e incluye las últimas líneas de salida/error en el mensaje.
- Con `--on-error`: no envía notificación si el comando fue exitoso (solo alerta en caso de fallos).
- Retorna el mismo código de salida que el comando ejecutado (compatible con CI/scripts).

## `wait` (alias `watch`)

Monitorea un proceso ya en ejecución en el sistema operativo mediante su PID y notifica cuando finalice:

```text
chifla wait 14280
chifla wait 14280 -t "Compilación pesada"
chifla wait 14280 --interval 2
```

- Valida que el proceso exista al inicio.
- Realiza polling no invasivo sin consumir CPU.
- Cuando el proceso finaliza, mide el tiempo monitoreado y envía la alerta E2EE a la PWA.

Atajo `chifla "hola"` = `send` al canal default (`inbox` o `CHIFLA_CHANNEL`).

Si el primer arg coincide con un subcomando (`auth`, `send`, `run`, `wait`, `watch`, `channels`, `devices`, `whoami`) no se trata como mensaje.


## Config

Path default:

- Linux/mac: `~/.config/chiflame/config.json`
- Windows: `%APPDATA%\chiflame\config.json`

```json
{
  "version": 1,
  "server": "https://<project>.supabase.co",
  "anon_key": "<publishable>",
  "user_id": "uuid",
  "device_id": "uuid",
  "default_channel": "inbox",
  "session": { "access_token": "…", "refresh_token": "…" },
  "keys": {
    "device_x25519_sk": "…",
    "device_ed25519_sk": "…",
    "channels": {
      "<channel_uuid>": { "slug": "inbox", "cdk": "…" }
    }
  }
}
```

Secretos en disco: chmod 0600. Nunca print de `keys` en `auth status` (solo fingerprints).

## Exit codes

| Code | Significado |
|---|---|
| 0 | ok |
| 1 | error genérico / server |
| 2 | uso / no paired / validación |
| 3 | pairing expired / denied |
| 4 | auth revoked (device) |
| 5 | network |

`--json` error:

```json
{ "ok": false, "error": { "code": "not_paired", "message": "Run chifla auth pair" } }
```

## UX pairing (TTY)

```text
Chiflame pairing

  Scan this QR with your phone, or open:
  https://app.chiflame.dev/pair/…

  Confirm this code in the app:

      K7F2Q9

  CLI fingerprint: a1b2c3d4
  Waiting…
```

## Fuera de v1

`chifla listen`, `chifla login --email`, plugins, GitHub Action (roadmap).
