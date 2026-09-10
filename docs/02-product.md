# Producto — canales, roles, features

## Entidades

```text
User (vault)
  ├── Devices
  │     ├── kind=cli   (senders; listen en terminal es v2)
  │     └── kind=pwa   (receivers + settings)
  ├── Channels
  │     ├── inbox      (creado al signup, no se borra)
  │     └── personal   (slug: deploys, ci, alerts…)
  └── Messages (ciphertext + metadata de routing)
```

**Canal** = topic privado. UUID interno + slug único por usuario (`deploys`). No hay URL pública global.

**Inbox** = canal default. `chifla "hola"` publica ahí.

**Device CLI** = sender con sesión GoTrue del mismo user + `device_id` local. Después del pairing no pide passphrase en cada send.

**Devices v1 (cerrado):** 1 PWA creadora del vault + N CLIs. Una segunda PWA en v1 crearía **otro** vault (onboarding). Login de cuenta existente = v1.1.

## Roles

Schema v1 incluye roles. La UI de invites es v1.1.

| Rol | Leer | Publicar | Admin canal |
|---|---|---|---|
| owner | sí | sí | sí |
| publisher | sí | sí | no |
| subscriber | sí | no | no |

En v1 cada usuario es `owner` de sus canales. Una CLI paired actúa como publisher de ese owner.

## Features v1

| Feature | Dónde |
|---|---|
| Pairing QR + código 6 chars | CLI + PWA `/pair/:id` |
| Passphrase unlock | PWA `/unlock` |
| Send a inbox o a un slug | `chifla`, `chifla send` |
| Inbox live | PWA + Realtime |
| Push en background | Web Push wake-up |
| Swipe derecha = borrar para mí | `message_acks.deleted_at` |
| Lista / crea canales | CLI + Settings |
| Revoke devices | Settings → Devices |
| Color / icono / mute de canal | Settings → Channels |
| Prioridad por mensaje | `--priority` |
| Tema claro/oscuro | Settings → Apariencia |
| JSON + exit codes para agentes | CLI |

## Features explícitamente fuera de v1

- Chat, threads, reacciones, read receipts visibles más allá de `read_at`.
- Topics públicos.
- Canales compartidos con otros usuarios (invites). Schema listo.
- Adjuntos grandes. Payload interno ≤ ~4 KB.
- UnifiedPush, FCM nativo, APNs nativo.
- `chifla listen`.
- Quiet hours, sonidos custom, templates, notification actions ricas (v1.1).
- Facturación, orgs, equipos.
- Búsqueda del cuerpo (E2E lo impide en servidor).

## Modelo de notificación (cerrado)

No es “un stream o una subscripción”: son **tres capas**.

1. **Inbox persistente** (`messages`) — fuente de verdad, retención por canal (default 30 días).
2. **Realtime** `chifla:user:{user_id}` — app abierta, latencia baja.
3. **Web Push wake-up** — app cerrada. El Service Worker fetch + descifra.

Canales = filas, no strings públicos. Subscripción = membership (`channel_members`) + push subscription por device PWA.

Compartir con otros usuarios = agregar member y envolver la CDK. Producto en v1.1, no en v1.

## Customización

**v1:** nombre, color, icono de canal; prioridad por mensaje; mute; tema.

**v1.1:** quiet hours, sonidos, templates, acciones en la notificación.

## Copy de confianza

- Onboarding: la passphrase no se puede recuperar. Sugerir un gestor (Bitwarden, 1Password, Google Password Manager).
- Settings → Seguridad: no hay “forgot passphrase”.
- Vacío de inbox: `Mandá chifla "hola" desde tu máquina`.
