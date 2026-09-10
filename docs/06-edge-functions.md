# Edge Functions — contratos

Runtime: Deno / Supabase Edge Functions. CORS acotado al origen de la PWA + CLI (CLI no es browser; CORS irrelevante). JSON UTF-8.

Ninguna function, salvo las de pairing init/poll **antes** de Auth, usa service role para leer ciphertext con el fin de descifrar: **nadie descifra en el server**.

`dispatch-push` es la única que carga `VAPID_PRIVATE_KEY`.

## Convenciones

Errores:

```json
{ "error": { "code": "pairing_expired", "message": "…" } }
```

Códigos estables para la CLI (`--json`). HTTP 4xx/5xx coherentes.

Rate limits (aprox. v1, en function o Cloudflare delante):

| Function | Límite |
|---|---|
| `pair-init` | 10 / IP / hora |
| `pair-poll` | 1 / s por `pairing_id` |
| `pair-complete` | 20 / user / hora |
| `dispatch-push` | N/A (webhook interno; secret) |
| `push-register` | 30 / user / hora |

---

## `pair-init`

**Caller:** CLI. **Auth:** none (anon).

Request:

```json
{
  "cli_public_key": "<b64url X25519>",
  "cli_sign_public_key": "<b64url Ed25519>",
  "cli_name": "dev-laptop"
}
```

Response `201`:

```json
{
  "id": "uuid",
  "verify_code": "K7F2Q9",
  "expires_at": "2026-09-08T12:00:00Z",
  "qr_url": "https://app.chiflame.dev/pair/uuid",
  "poll_after_ms": 1000
}
```

La CLI añade `#<cli_public_key>` al abrir/mostrar el QR.

Server: insert `pairing_sessions` pending, `expires_at = now() + 3 min`, genera `verify_code` (Crockford, sin I/L/O/U).

---

## `pair-poll`

**Caller:** CLI. **Auth:** proof-of-possession, no JWT todavía.

Request:

```json
{
  "pairing_id": "uuid",
  "cli_public_key": "<b64url>",
  "nonce": "<b64url 32B>",
  "signature": "<b64url firma Ed25519 o box.sign del pairing_id||nonce>"
}
```

**Decisión de firma:** el par de device es X25519 (key exchange). Para PoP usar `crypto_sign` Ed25519 **aparte** o un challenge X25519 (`box` con ephemeral server). Spec de implementación: **par Ed25519 de device + X25519 derivado / segundo par**. Más simple para v1: **dos pares**, `cli_public_key` en pairing es X25519; `cli_sign_public_key` extra en `pair-init`.

Ajuste de schema: `pairing_sessions.cli_sign_public_key text`. Documentado aquí; `05-supabase.md` debe incluir la columna al migrar (`cli_sign_public_key`).

Response:

- `204` pending
- `200` completed: ver payload cerrado más abajo (`channel_keys_sealed` + `session`)
- `410` expired / denied / consumed
- `401` bad proof

Una vez leído `completed`, el server nullifica `wrapped_result` (un uso).

---

## `pair-complete`

**Caller:** PWA. **Auth:** user JWT (vault unlocked en cliente).

Request:

```json
{
  "pairing_id": "uuid",
  "verify_code": "K7F2Q9",
  "device_name": "dev-laptop",
  "wrapped_result": "<sealed box hacia cli_public_key, producido en el cliente>"
}
```

La PWA **construye** `wrapped_result` en el cliente (tiene las CDKs). El server **no** envuelve claves: solo almacena el blob que el cliente ya selló. Así el service role nunca ve CDKs en claro.

**Cerrado — dos canales, no un sealed box mixto:**

- CDKs: las sella la PWA en el cliente (`channel_keys_sealed`). El server no las ve.
- Auth: el server mint una **sesión GoTrue normal del mismo user** (no `app_metadata.device_id`: en GoTrue es por usuario, no por sesión, y rompería N CLIs).
- `device_id` vive en la config de la CLI y viaja como `sender_device_id` en cada INSERT. RLS: el device es del `auth.uid()` y no está revoked.

Mint de sesión (Edge):

1. Todo user Auth tiene email (el real o el sintético `u{uuid32}@chiflame.app`).
2. `auth.admin.generateLink({ type: 'magiclink', email })` en el **service client** → `hashed_token`.
3. `verifyOtp({ token_hash, type: 'magiclink' })` en un **anon client aparte** (`mintClient`). Nunca en el service client: `verifyOtp` pisa `Authorization` con el JWT del user y el UPDATE de `pairing_sessions` (sin policy UPDATE para `authenticated`) matchea 0 filas y el poll se queda en 204.
4. Auth config del proyecto: **confirmación de email OFF**, **recovery/reset OFF** (un reset de GoTrue rompería el Auth Hash y no descifra el vault).
5. El UPDATE a `completed` debe `.select('id')` y fallar si no hay fila.

Pasos server:

1. Load session pending, not expired, verify_code constant-time equal.
2. Crear `devices` kind=cli (`public_key`, `sign_public_key`, name).
3. Mint sesión GoTrue (arriba).
4. Guardar `channel_keys_sealed` en `wrapped_result`.

Request:

```json
{
  "pairing_id": "uuid",
  "verify_code": "K7F2Q9",
  "device_name": "dev-laptop",
  "channel_keys_sealed": "<b64url>"
}
```

Poll `200`:

```json
{
  "status": "completed",
  "channel_keys_sealed": "<b64url>",
  "session": {
    "access_token": "…",
    "refresh_token": "…",
    "expires_in": 3600,
    "user_id": "uuid",
    "device_id": "uuid"
  }
}
```

El JWT viaja por HTTPS al CLI que demostró la clave. Las CDKs siguen E2E. Aceptable: un operador con service role **podría** mintar un JWT del user (eso ya es cierto con Admin API) pero **sigue sin CDKs**.

4. `status=completed`, guardar `channel_keys_sealed` en `wrapped_result`, `user_id`, `device_id`.

---

## `pair-deny`

**Auth:** user JWT.

```json
{ "pairing_id": "uuid" }
```

`status=denied`. Poll → 410.

---

## `dispatch-push`

**Auth:** webhook secret (`x-webhook-secret`). Service role para leer **meta** y subscriptions, no para descifrar.

Input (webhook row o payload reducido):

```json
{
  "type": "INSERT",
  "table": "messages",
  "record": {
    "id": "uuid",
    "channel_id": "uuid",
    "priority": "default",
    "created_at": "…"
  }
}
```

Si llega `ciphertext` en `record`, **descartar** el campo inmediatamente. No log.

Algoritmo:

1. Resolver `user_id`s destinatarios: members del canal con `muted = false`.
2. Load `push_subscriptions` de devices PWA no revoked.
3. Por cada sub, Web Push RFC 8030 + VAPID:
   Payload **wake-up** (≤ 1 KiB):

```json
{
  "v": 1,
  "type": "message",
  "message_id": "uuid",
  "channel_id": "uuid",
  "priority": "default"
}
```

4. Urgency: `min/low` → `very-low`/`low`; `default` → `normal`; `high/urgent` → `high`.
5. HTTP 404/410 → delete subscription.
6. No retry infinito; cola corta (1-2 retries).

---

## `device-revoke`

**Auth:** user JWT.

```json
{ "device_id": "uuid" }
```

Set `revoked_at`, delete `push_subscriptions` de ese device. SignOut/admin invalidate refresh si es posible (GoTrue: borrar refresh tokens de ese device requiere tracking; v1: el CLI falla al refresh y al INSERT RLS porque `current_device_id` está revoked — chequear en policy).

Policy extra: `owns_active_device(sender_device_id)` (ver [05-supabase.md](./05-supabase.md)). Revoke no invalida el refresh GoTrue en v1; el INSERT falla y la CLI sale exit 4. Rotar CDKs para cortar **lectura** es v1.1.

---

## `push-register`

**Auth:** user JWT. Device PWA.

```json
{
  "device_id": "uuid",
  "subscription": {
    "endpoint": "https://…",
    "expirationTime": null,
    "keys": { "p256dh": "…", "auth": "…" }
  }
}
```

Upsert by `endpoint`. Validar `device_id` own + kind=pwa.

`push-unregister`: delete by endpoint o device_id.

---

## Lo que no existe

- Function `send` que reciba title/body. El send es `INSERT` PostgREST desde el CLI.
- Function que descifre “para armar el push rico”.
- Function de search.

## Tests de contrato (fase impl)

- `dispatch-push` unit: payload sin `title`/`body`/`ciphertext`.
- `pair-complete` con código malo → 403, no completed.
- `pair-poll` sin PoP → 401.
- Webhook sin secret → 401.
