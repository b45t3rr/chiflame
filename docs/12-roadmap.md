# Roadmap

## v1 — “pair y mandá un test”

- E2E contenido (passphrase, CDK, ciphertext).
- Pairing QR + código.
- CLI npm `chiflame` / `chifla` send + channels + devices.
- PWA: onboarding, unlock, inbox, settings, swipe delete, install, Web Push wake-up.
- Schema con `channel_members` (un owner).
- Agent-first: `chifla "msg"`.

Criterio de demo: `npm i -g` → `auth pair` → scan → `chifla "hola"` → notificación en el teléfono.

## v1.1 — pulido y compartir

- **Segunda PWA** del mismo vault: email + endpoint prelogin (devuelve `kdf`) + `/login`.
- Invites a canales shared (envolver CDK al invitee).
- Quiet hours, sonidos, notification actions.
- Lock timeout de la PWA.
- Rotación de CDK al revoke (cortar lectura, no solo send).
- Passkey / WebAuthn como **unlock** (PRF si hay soporte; si no, solo Auth).
- `chifla listen` experimental (TTY).
- Preview on/off ya está en v1 settings; v1.1: per-channel.

## v2

- Orgs / equipos.
- Adjuntos cifrados (Storage con ciphertext; claves en envelope).
- GitHub Action oficial.
- Self-host guide (mismo SQL).
- UnifiedPush opcional (Android de-Googled).
- Templates y routing (`--tag ci` → canal).

## Fuera de horizonte (salvo que cambie la visión)

- Chat.
- Topics públicos.
- “Forgot passphrase” que descifre.
- Apps nativas store.
- Server-side search del body.

## Orden de implementación (cuando se codee)

Ver [01-capability-map.md](./01-capability-map.md):

```text
identity → crypto → channels → delivery → cli ∥ pwa → customization
```

Primer slice vertical: signup + inbox CDK + pair + insert + decrypt en PWA (push después).
