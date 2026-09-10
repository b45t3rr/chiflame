# Spec: pwa

## Objective

PWA instalable: unlock, pairing, inbox, settings, Service Worker que descifra wake-ups, gates iOS. Swipe derecha borra (tombstone).

Ver [08-pwa.md](./08-pwa.md), [10-wireframes.md](./10-wireframes.md), [09-flows.md](./09-flows.md).

## Tech Stack

- Vite + TypeScript + React (default; SvelteKit aceptable si se elige al scaffold, no ambos)
- `vite-plugin-pwa` **más** SW custom para push decrypt (inyectar handler)
- `@supabase/supabase-js` + Realtime `private: true`
- `@chiflame/crypto`
- IndexedDB (tokens, Device Key, CDKs wrapped)

## Commands

```text
pnpm --filter @chiflame/pwa dev
pnpm --filter @chiflame/pwa build
pnpm --filter @chiflame/pwa test
pnpm --filter @chiflame/pwa test:e2e
```

## Project Structure

```text
apps/web
  src/routes/*           o pages según router
  src/sw.ts
  src/crypto/unlock.ts
  src/inbox/*
  src/settings/*
  public/manifest.webmanifest
```

## Code Style

Body de mensaje = text node, nunca `innerHTML`.

Unlock:

```ts
const master = await kdf(passphrase, profile.kdf)
const userKey = unwrap(master, profile.wrapped_user_key)
const cdks = await unwrapAll(userKey, memberships)
await persistDeviceWrapped(cdks) // para el SW
```

## Testing Strategy

- Unit: swipe → ack payload; decrypt fail → placeholder.
- SW: push event con wake-up + CDK en IDB mock → `showNotification(title)`.
- SW sin CDK → genérico “Nueva chifla”.
- E2E (Playwright): onboarding (sin push real), unlock, inbox vacío copy, settings devices.
- Push real: manual / device farm; no bloquear CI.
- Viewport: 390 y 1280 en e2e de inbox y settings.

## Boundaries

- Always: permiso push con gesto; CSP; no HTML en mensajes; respetar el catálogo de rutas de [08-pwa.md](./08-pwa.md).
- Ask first: framework distinto a React; **cualquier ruta o pantalla nueva**.
- Never: “forgot passphrase” que hable con el server para descifrar; subscribe push en Safari iOS no-standalone sin explicar `/install`.

## Success Criteria

- Las 16 rutas de [08-pwa.md](./08-pwa.md) existen; no hay otras en v1.
- `/` redirige: guest Welcome, locked `/unlock`, unlocked `/inbox`.
- Pairing: estados confirm / expired / denied / mismatch en `/pair/:id`; llama `pair-complete`.
- Inbox live con Realtime. Swipe derecha + undo 5s. Detalle en `/c/:slug/m/:id`.
- notificationclick abre el detalle, no un home genérico.
- iOS tab: banner + `/install`, no un error críptico de PushManager.
- Manifest `display: standalone`, `start_url: /inbox`.
- Compose, tab bar, hamburger, search: ausentes.

## Open Questions

Ninguna de producto. Framework: React al scaffold (cambiarlo solo ahí).
