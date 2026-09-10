# Spec: identity

## Objective

Cuentas, passphrase como unlock del vault (no como secreto del servidor), pairing CLI↔PWA, devices, revoke.

User stories:

- Puedo crear un vault con una passphrase y, opcionalmente, un email.
- Puedo pairar una CLI escaneando un QR y confirmando un código de 6 caracteres.
- Puedo revocar un device y ese CLI deja de poder insertar.
- El servidor autentica un Auth Hash derivado; nunca recibe la passphrase.

## Tech Stack

- Supabase Auth (GoTrue)
- Edge Functions: `pair-init`, `pair-poll`, `pair-complete`, `pair-deny`, `device-revoke`
- Tablas: `profiles`, `devices`, `pairing_sessions` ([05-supabase.md](./05-supabase.md))
- Cripto de claves: [SPEC-crypto.md](./SPEC-crypto.md)

## Commands

```text
# futura impl
pnpm --filter @chiflame/pwa test -- identity
pnpm --filter @chiflame/cli test -- auth
supabase functions serve pair-init
```

## Project Structure

```text
packages/crypto          KDF, Auth Hash, device keypairs
apps/web/src/auth        unlock, onboarding, pair pages
packages/cli/src/auth    pair, status, unpair
supabase/functions/pair-*
```

## Code Style

Auth Hash se deriva **antes** de hablar con GoTrue:

```ts
const master = await kdfArgon2id(passphrase, kdfParams)
const authPassword = hkdfSha256(master, 'chiflame-auth-v1', 32) // hex
await supabase.auth.signInWithPassword({ email, password: authPassword })
```

Nunca `signInWithPassword({ password: passphrase })`.

Pairing PoP: Ed25519 firma `pairing_id || nonce`.

## Testing Strategy

- Unit: KDF params roundtrip; verify_code charset; TTL.
- Integration (fake GoTrue o local supabase): signup inserta profile solo con `id = uid`.
- Pair: complete con código malo no emite device; poll sin PoP = 401; expired = 410.
- Revoke: INSERT messages con device revoked = 403.

Coverage: ramas de pairing (pending/completed/denied/expired) 100% en tests de function.

## Boundaries

- Always: constant-time compare del `verify_code`; TTL 3 min; un uso de `wrapped_result`.
- Ask first: cambiar claims JWT; añadir OAuth/social; hacer el email obligatorio.
- Never: loguear passphrase, Master Key, o CDKs; mint JWT sin PoP en poll; pair-complete sin user JWT.

## Success Criteria

- QR + código → CLI con `user_id` + `device_id` + CDK inbox.
- `profiles` tiene `kdf`, `wrapped_user_key`, `public_key`; no hay passphrase.
- Dos CLIs paired simultáneos funcionan hasta revoke.
- Email UI opcional. En Auth **siempre** hay email: el que escribió el humano, o `user_{uuid}@users.chiflame.invalid` (no se muestra). Sirve para mintir la sesión de la CLI (`generateLink` + `verifyOtp`).
- v1: una PWA por vault. Segunda PWA = v1.1.
- JWT CLI: sesión GoTrue del user, **sin** `app_metadata.device_id`.

## Open Questions

Ninguna. GoTrue + email sintético está cerrado.
