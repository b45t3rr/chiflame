# Spec: crypto

## Objective

Jerarquía de claves, envelope, formatos de ciphertext. Garantía: ni service role ni operadores leen title/body.

Depende de `identity` (user_id, device keys). Proveedor de wrap/unwrap para `channels` y `delivery`.

## Tech Stack

- `@noble/hashes` (argon2, sha256, hkdf) + `@noble/ciphers` (xchacha20poly1305) + `@noble/curves` (x25519, ed25519)
- Alternativa aceptable: `libsodium-wrappers`. **Una** stack, no ambas.
- Shared `packages/crypto` usado por CLI, PWA y tests. Las Edge Functions **no** descifran mensajes.

## Commands

```text
pnpm --filter @chiflame/crypto test
pnpm --filter @chiflame/crypto test -- --coverage
```

## Project Structure

```text
packages/crypto/src
  kdf.ts
  hkdf.ts
  box.ts          # x25519 seal/open
  sign.ts         # ed25519
  secret.ts       # xchacha20poly1305
  message.ts      # codec v1
  auth-hash.ts
  types.ts
packages/crypto/test
  e2e-cannot-read.test.ts
```

## Code Style

```ts
export function encryptMessage(
  cdk: Uint8Array,
  plaintext: MessagePlaintext,
  aad: string,
): { nonce: string; ciphertext: string; alg: 'xchacha20poly1305' } {
  const n = random(24)
  const pt = utf8(JSON.stringify(plaintext))
  const ct = xchacha20poly1305(cdk, n, aadBytes(aad)).encrypt(pt)
  return { nonce: b64url(n), ciphertext: b64url(ct), alg: 'xchacha20poly1305' }
}
```

AAD canónico: `${message_id}|${channel_id}|${sender_device_id}`. El CLI **genera** `messages.id` (uuid v4) antes de cifrar e INSERT. No usar `created_at` en AAD (el default `now()` del server no coincidiría).

CDKs: 32 bytes CSPRNG. Seal a X25519 public del miembro (`crypto_box_seal` equivalente).

## Testing Strategy

- Vectores: encrypt/decrypt roundtrip; AAD mismatch falla.
- Interop Node vs hex fixtures (el browser testea los mismos fixtures).
- **E2E trust test:** dado un `ciphertext` de un send real de fixture, `JSON.parse(atob(ciphertext))` no contiene `title`; un decrypt con CDK correcta sí. Un decrypt con service-role-only material (nada) lanza.
- Argon2id: params fijas v1; test de tiempo no flaky (solo params encode).

Cobertura de `packages/crypto`: ≥ 90% líneas.

## Boundaries

- Always: nonce único; no reusar nonce; no implementar AES-CBC casero.
- Ask first: cambiar KDF params (necesita versión en `profiles.kdf` + migración de wrap).
- Never: enviar Master Key, CDK, o passphrase al server; añadir “recovery key” subida en claro; descifrar en Edge Functions.

## Success Criteria

- Test `service role cannot decrypt` rojo si alguien manda title en claro.
- Pairing entrega CDKs solo dentro de sealed box hacia la CLI.
- Documentado en UI: passphrase perdida = contenido perdido.
- VAPID no forma parte de este package.

## Open Questions

Ninguna de protocolo. Librería: `@noble/*` (sin WASM). Si Argon2id > ~1s en un móvil low-end al implementar, bajar `m` con `kdf.version` — no es un fork de diseño.
