# Seguridad y cripto

E2E del **contenido** es v1, no un extra. Ni el dashboard de Supabase, ni una Edge Function con service role, ni los operadores de Chiflame pueden leer title/body.

Zero-knowledge del contenido, **no** invisibilidad total: metadatos de routing son visibles. No overclaim.

## Tres capas de claves (no una)

| Capa | Qué es | Dónde vive |
|---|---|---|
| Passphrase → Master Key | Argon2id. Envuelve la User Key. | Solo clientes, en memoria al unlock |
| Channel Data Key (CDK) | Cifra title/body de un canal | Envuelta por miembro; en CLI `~/.config/chiflame`; en PWA IndexedDB envuelta con Device Key |
| VAPID | Identifica al application server ante FCM/Mozilla/APNs | Secrets del deployment. **No** se deriva del passphrase |

El navegador añade `p256dh` + `auth` (RFC 8291): cifrado de **transporte** hacia el push service. No sustituye el E2E de Chiflame.

### Por qué VAPID no sale del passphrase

VAPID es un par ECDSA P-256 que el **servidor** usa para firmar cada POST al push service. Si se derivara por usuario:

- Habría que guardar VAPID private en el servidor (rompe el modelo) o mandar push desde el CLI (el CLI hablaría con FCM/APNs; peor).
- Rotar passphrase rotaría VAPID y invalidaría todas las subscriptions.

Un par por instancia. El passphrase protege **contenido**, no la identidad del app server.

## Jerarquía

```text
Passphrase
  └─ Argon2id(salt, m=64MiB, t=3, p=1) → Master Key
        ├─ Auth Hash (HKDF-SHA256, info="chiflame-auth-v1") → password de GoTrue
        └─ wrap(User Key)

User Key (CSPRNG, 256-bit)
  ├─ wrap(User Private Key X25519)
  └─ wrap(CDKs) vía channel_members.wrapped_channel_key
        (en la práctica: sealed box con public_key X25519 del miembro)

Device Key (CSPRNG, solo el device)
  └─ wrap local de CDKs para el Service Worker
     (no re-pedir passphrase en cada push)
```

Salt del KDF: 16 bytes aleatorios, guardados en `profiles.kdf`. No usar el email como salt único (el email es opcional).

Auth Hash: 32 bytes hex o equivalente. GoTrue guarda el hash a su vez (bcrypt interno). El servidor **nunca** recibe la passphrase ni la Master Key.

## Algoritmos v1

| Uso | Alg |
|---|---|
| KDF | Argon2id, m=65536 (KiB), t=3, p=1 |
| Wrap simétrico | XChaCha20-Poly1305 (libsodium secretbox / `@noble/ciphers`) |
| Asimétrico (pairing, CDK al CLI) | X25519 sealed box (libsodium `crypto_box_seal`) |
| Mensaje | XChaCha20-Poly1305, AAD = `message_id\|channel_id\|sender_device_id` |
| Fingerprint CLI | primeros 8 hex SHA-256 del public_key |

Librería compartida: `packages/crypto`. Misma implementación en Node (CLI) y browser (PWA/SW). Preferir `@noble/hashes` + `@noble/ciphers` + `@noble/ciphers/webcrypto` / `libsodium-wrappers` — elegir **una** en implementación y no mezclar.

## Formato ciphertext (mensaje)

```json
{
  "v": 1,
  "alg": "xchacha20poly1305",
  "n": "<nonce 24 bytes b64url>",
  "ct": "<ciphertext+tag b64url>"
}
```

**Canónico (cerrado):** columnas `alg`, `nonce`, `ciphertext` donde `ciphertext` es **solo** el `ct` raw (b64url), no un JSON anidado. El bloque JSON de arriba es el modelo lógico, no el on-the-wire.

Plaintext interno (solo clientes):

```json
{
  "title": "Deploy",
  "body": "prod OK",
  "tags": ["ci"],
  "click": "https://example.com",
  "actions": [{"id": "open", "title": "Abrir"}],
  "icon": "rocket"
}
```

`title` max 80 chars, `body` max 2000 chars, total UTF-8 ≤ 4 KiB.

### Metadata en claro (aceptable)

`id`, `channel_id`, `sender_device_id`, `priority` (`min|low|default|high|urgent`), `created_at`, `expires_at`.

`priority` en claro permite urgencia de push sin descifrar. Leak: el servidor sabe que algo fue `urgent`, no el qué.

## Pairing anti-MITM

1. CLI genera **dos** pares de device: X25519 (CDKs) y Ed25519 (PoP). Se vuelven permanentes al completar.
2. `pair-init`: servidor guarda `cli_public_key`, `cli_sign_public_key`, `verify_code` (6 chars), TTL 3 min.
3. Terminal muestra QR + código + fingerprint.
4. QR: `https://app.chiflame.dev/pair/{id}#<cli_pub_b64url>`
   El fragment `#` **no viaja al servidor** al abrir la URL; la PWA lo lee en cliente y lo compara con `pairing_sessions.cli_public_key`.
5. PWA desbloqueada: humana confirma que el código de la pantalla = el de la terminal.
6. PWA sella las CDKs hacia `cli_public_key` **en el cliente**. `pair-complete` guarda ese blob, crea `devices`, mint JWT (Admin API). El server no ve CDKs.
7. CLI `pair-poll` con PoP Ed25519. Recibe `channel_keys_sealed` + `session` (JWT por TLS). Unseal CDKs, persiste.

Sin confirmación del código, un QR fotografiado no alcanza (el atacante no desbloquea la PWA de la víctima). TTL corto + un uso.

El JWT **no** es E2E: un operador con service role ya puede mintar sesiones Auth. Las CDKs sí son E2E. Eso es el recorte honesto.

## Threat model v1

| Amenaza | Resultado | Mitigación |
|---|---|---|
| Supabase / operadores leen DB | Ven ciphertext + metadatos | E2E; tests de no-plaintext |
| Edge Function `dispatch-push` | Ve `message_id`, `channel_id`, `priority` | Contrato: no fetch de ciphertext; no logs de body |
| Push service (Google/Apple/Mozilla) | Ve wake-up ids | Wake-up sin title/body |
| Passphrase en network tab | No debe aparecer | Solo Auth Hash; test e2e |
| CLI token robado | Puede publicar ciphertext (no leer a menos que tenga CDK — y **sí la tiene**) | Un CLI paired **puede leer y escribir** ese vault. Revoke; rate limit |
| Device PWA desbloqueado robado | Lee inbox | Igual que Bitwarden unlocked. Lock timeout v1.1 |
| QR interceptado 3 min | Inútil sin PWA desbloqueada + código | Código + TTL |
| XSS en PWA | Puede exfiltrar CDK de IndexedDB si unlocked | CSP, no HTML en mensajes (el body es texto) |
| Passphrase perdida | Vault ilegible para siempre | Copy; no backdoor |

## Claim demostrable

Ver [SPEC-crypto.md](./SPEC-crypto.md):

- `SELECT ciphertext` con service role no parsea a JSON `{title, body}`.
- `dispatch-push` no recibe plaintext.
- Passphrase ausente en requests.
- Producto: *“Si perdés la passphrase, no hay backdoor. Ni nosotros.”*

## Recovery

| Qué | Se puede | No se puede |
|---|---|---|
| Email opcional | Recuperar **login** GoTrue (reset del Auth Hash implica **nuevo vault vacío** si no hay passphrase) | Descifrar mensajes viejos |
| Re-pair CLI | Sí, desde PWA desbloqueada | — |
| Forgot passphrase | No | — |

Reset de “password” Auth sin passphrase: la cuenta puede volver a loguearse solo si se rota a un vault nuevo; los `wrapped_user_key` viejos son basura. Producto v1: **no ofrecer reset que deje mensajes**. Mejor: “sin passphrase no hay acceso al vault; creá una cuenta nueva”.

## Alternativa rechazada

Cifrar en el servidor con una clave de Chiflame. Push rico trivial. Operadores leen todo. Descartado.
