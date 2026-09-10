# PWA — páginas (cerrado)

Contrato de **v1**. Inbox y Settings son las dos superficies de la app. El resto es onboarding, pairing e install.

Wireframes: [10-wireframes.md](./10-wireframes.md). Navegación y flujos: [09-flows.md](./09-flows.md).

Stack previsto: Vite + TypeScript + React (un solo framework al scaffold). Service Worker propio porque descifra.

---

## Chrome

Dos shells, nunca mezclados:

| Shell | Dónde | UI |
|---|---|---|
| **Gate** | welcome, onboarding, unlock, pair, install | Sin tab bar. Atrás solo si hay historial interno del funnel. |
| **App** | inbox, detalle, settings* | Header en mobile; navegación persistente en desktop. **No hay tab bar inferior.** Inbox ↔ Settings por el icono ⚙ / navegación lateral. |

v1 **no** tiene: compose, tab bar, hamburger mobile, chat. En desktop, la navegación lateral de canales y settings es persistente; en mobile se mantiene el sheet de canales.

### Responsive

- `320–767px`: una columna, inbox → detalle como pantallas separadas, selector de canales en sheet.
- `768–1023px`: canvas fluido con gutters adaptables; los formularios y listas usan anchos legibles y overlays con scroll propio.
- `1024px+`: rail persistente de canales en inbox y rail persistente de settings; el contenido conserva un ancho máximo legible.
- Safe areas se aplican desde los shells; las columnas internas son las dueñas de su scroll cuando el contenido supera el viewport.

Header app (inbox):

```text
[ {color} {slug} ▾ ]                    [⚙]
```

El ☰ de drafts anteriores **no existe**. Switch de canal = sheet, no ruta.

---

## Estados de sesión

```text
guest  →  onboarding  →  unlocked
locked →  unlock      →  unlocked
unlocked → (cerrar pestaña) → locked     // v1
unlocked → Unpair this PWA → guest
```

| Estado | Hay perfil/sesión en IDB | Master Key en memoria | SW tiene Device Key (CDKs wrapped) |
|---|---|---|---|
| `guest` | no | no | no |
| `locked` | sí | no | sí (push genérico o preview si Device Key sigue) |
| `unlocked` | sí | sí | sí |

v1: lock al cerrar la pestaña / matar el proceso. No lock por idle (v1.1). Unpair borra IDB + refresh token.

Query `?next=` (path interno, no URL abierta): post-unlock / post-onboarding redirect. Default `/inbox`.

---

## Catálogo de rutas (cerrado)

Nada más entra a v1 sin actualizar esta tabla.

| # | Ruta | Sesión | Pantalla | Tipo |
|---|---|---|---|---|
| 1 | `/` | guest → Welcome. locked → `/unlock`. unlocked → `/inbox` | Router | — |
| 2 | `/onboarding` | guest | Funnel 4 pasos | Gate |
| 3 | `/unlock` | locked (si guest → `/`) | Passphrase | Gate |
| 4 | `/pair/:id` | cualquiera; gate interno | Confirmar CLI | Gate |
| 5 | `/install` | cualquiera | Cómo instalar (iOS/desktop) | Gate |
| 6 | `/inbox` | unlocked | Canal `inbox` | App |
| 7 | `/c/:slug` | unlocked | Mismo UI, otro canal | App |
| 8 | `/c/:slug/m/:messageId` | unlocked | Detalle | App |
| 9 | `/settings` | unlocked | Hub | App |
| 10 | `/settings/devices` | unlocked | Devices | App |
| 11 | `/settings/channels` | unlocked | Lista canales | App |
| 12 | `/settings/channels/new` | unlocked | Crear canal | App |
| 13 | `/settings/channels/:slug` | unlocked | Editar canal | App |
| 14 | `/settings/notifications` | unlocked | Push | App |
| 15 | `/settings/security` | unlocked | Passphrase / email | App |
| 16 | `/settings/appearance` | unlocked | Tema | App |

Alias: `/inbox/m/:messageId` → redirect `/c/inbox/m/:messageId`.

Deep link QR: `https://app.chiflame.dev/pair/{id}#<cli_pub_b64url>`.

`start_url` del manifest: `/inbox` (el router manda a unlock si hace falta).

### No son rutas (overlays)

| Overlay | Dónde | v1 |
|---|---|---|
| Sheet de canales | header `slug ▾` | sí |
| Snackbar undo 5s | inbox / detalle | sí |
| Confirm revoke device | devices | sí |
| Confirm unpair PWA | settings hub | sí |
| Banner install | inbox, si no standalone | sí |
| Banner push | inbox, si permiso ≠ granted y hay PushManager | sí |
| Banner “CLI paired” | inbox, flash post-pair | sí |
| Compose mensaje | — | **no** (solo CLI) |
| Quiet hours | — | **no** (v1.1) |
| Invites shared | — | **no** |

### Guards

- App routes sin unlocked → `/unlock?next=<path>`.
- Gate onboarding si no guest → `/inbox`.
- `/unlock` si guest → `/`.
- `/c/:slug` desconocido o sin membership → `/inbox` + toast.
- `/c/:slug/m/:id` no existe o `deleted_at` set → lista del canal + toast.
- `/pair/:id` expired/denied/unknown = **estados de la misma ruta**, no rutas extra.

---

## Páginas — comportamiento

### 1. Welcome `/` (guest)

Tres salidas, no más:

- **Crear vault** → `/onboarding`
- **Desbloquear** — solo visible si el router se equivoca; en guest no se muestra. (Unlock es `/unlock` automático si `locked`.)
- **Instalar** → `/install` si iOS tab o desktop sin standalone

No hay campo “código de pairing”. El CLI abre `/pair/:id` vía QR.

No hay “Ya tengo cuenta”. **v1 = esta PWA crea el vault.** Otro teléfono que pase por onboarding = otro vault. Login del mismo user = v1.1.

Copy de confianza visible.

### 2. Onboarding `/onboarding`

Wizard local, 4 pasos. No sub-rutas.

| Paso | Si ya se cumple | Acción |
|---|---|---|
| 1 Passphrase | — | Crea vault + Auth + profile + inbox + device PWA. Irreversible en el funnel. |
| 2 Instalar | `display-mode: standalone` | Skip automático. |
| 3 Notificaciones | `Notification.permission==='granted'` o no hay `PushManager` | Skip o CTA `/install` en iOS tab. Gesto obligatorio para `requestPermission`. |
| 4 Listo | — | Copy `chifla auth pair`. Primary: **Ir al inbox**. |

`?next=/pair/{id}`: después del paso 1 → `/pair/:id` (pasos 2–3 se convierten en banners de inbox).

Skip en 2 y 3 siempre visible (“Ahora no”), excepto iOS tab en paso 3: el botón es “Cómo instalar” → `/install?next=/onboarding` volviendo al paso 3 o a inbox si ya hay vault.

### 3. Unlock `/unlock`

Un campo, un botón. Sin “olvidé passphrase” que recupere. Sin email login.

Fallo de KDF/unwrap: error en el campo, no toast genérico (“Passphrase incorrecta”).

Éxito → `next` o `/inbox`.

### 4. Pair `/pair/:id`

Estados de **una** pantalla:

| Estado | UI |
|---|---|
| `loading` | skeleton |
| `needs_onboarding` | redirect `/onboarding?next=/pair/:id` |
| `needs_unlock` | redirect `/unlock?next=/pair/:id` |
| `confirm` | código 6 chars, fingerprint, nombre device, Confirmar / Rechazar |
| `working` | Confirmar disabled |
| `done` | breve “Listo” → `/inbox?paired=1` |
| `expired` / `denied` / `not_found` / `mismatch` | error + “Volvé a correr `chifla auth pair`” |

`mismatch`: hash `#cli_pub` ≠ `cli_public_key` del server.

Nombre default: `cli_name` del session, editable.

### 5. Install `/install`

Instrucciones por plataforma detectada (iOS Safari / iOS standalone ya instalada / Android / desktop). CTA atrás o `next`.

### 6–7. Inbox `/inbox` y `/c/:slug`

Misma pantalla. Lista del canal, `deleted_at is null`, descifrado local.

- Swipe **derecha** → tombstone + undo 5s.
- Swipe izquierda → no-op.
- Pull to refresh.
- Tap row → `/c/:slug/m/:messageId` y `read_at`.
- Realtime prepend.
- Row sin CDK: título fijo “No se pudo descifrar”, sin body.
- Unread: punto a la izquierda (● / ○).
- Prioridad `urgent`/`high`: el punto usa el color del canal más marca visual mínima (sin iconos extra).
- Vacío: `chifla "hola"` o `chifla -c {slug} "hola"`.
- Banners apilados arriba (install, push, paired), dismiss persistido en IDB.

Sheet de canales: lista (color + slug + unread count), canal activo check, footer **Gestionar canales** → `/settings/channels`.

### 8. Detalle `/c/:slug/m/:messageId`

Title, body (texto plano), relative time, priority, device name, botón **Abrir link** solo si `click` es `https:` (si no, omitir). **Borrar** = mismo ack que swipe, undo en esta página o al volver.

### 9. Settings hub

Rows a subpáginas + **Unpair this PWA** (confirm) + versión.

Atrás → inbox del último canal (o `/inbox`).

### 10. Devices

Lista PWA/CLI. Este device marcado. CLI: **Revocar** + confirm. Copy `chifla auth pair`. No se revoca “este PWA” acá (se Unpair en hub).

### 11–13. Channels

Lista: color, slug, mute, retención. `inbox` no se borra. `+` → `/new`. Tap row → `/:slug` edit.

Crear: nombre, slug autogen, color (6 swatches), icono (emoji opcional, 1 grapheme), submit. Al crear, sella la CDK a `channel_members` (este user) y a `device_channel_keys` de cada CLI activa.

Editar: igual + mute + retención (7/30/90) + borrar si no inbox (confirm). Cambiar slug **no** en v1 (rompe CLI cache).

### 14. Notifications

- Estado del permiso: no soportado / bloqueado / default / granted.
- CTA gesto “Activar” o link `/install` si iOS tab.
- Toggle **Preview** (default on): SW muestra title/body descifrados vs “Nueva chifla”.
- Copy: el preview se descifra **en el dispositivo**.

### 15. Security

- Cambiar passphrase (actual + nueva + confirmar). Re-wrap User Key. Copy: no hay recovery.
- Email opcional: agregar / cambiar (GoTrue). Copy: no descifra el vault.

### 16. Appearance

`System` / `Light` / `Dark`. Default system.

---

## Service Worker

1. `push`: wake-up `{v, type, message_id, channel_id, priority}`.
2. Si hay window focused visible → **no** `showNotification` (el inbox ya recibió Realtime).
3. Si Preview off o no hay CDK → `Chiflame` / `Nueva chifla`.
4. Else fetch mensaje, decrypt, `showNotification(title, { body, tag: message_id, data: { slug, messageId } })`.
5. `notificationclick` → `/c/{slug}/m/{messageId}` (slug resuelto por `channel_id` cacheado en IDB; fallback `/inbox`).
6. `pushsubscriptionchange` → `push-register`.

El SW no pide passphrase.

## Web Push

- VAPID public en build o `/config.json`.
- `userVisibleOnly: true`.
- Permiso solo con gesto.

## Gates de plataforma

| Plataforma | Push | UI |
|---|---|---|
| Android Chrome | tab o instalada | banner push si default |
| Desktop Chromium / Firefox / Edge | sí | banner install opcional |
| Safari macOS 16+ | sí | — |
| iOS Safari **tab** | no | banner + `/install` |
| iOS PWA 16.4+ icono | sí | permiso con gesto |
| iOS UE | riesgo DMA | mismo `/install`; si no hay standalone, no mentir que hay push |

## Manifest

```json
{
  "name": "Chiflame",
  "short_name": "Chiflame",
  "start_url": "/inbox",
  "display": "standalone",
  "background_color": "#0b0b0c",
  "theme_color": "#0b0b0c"
}
```

## Seguridad de front

CSP estricta. Body = texto, nunca HTML. Tokens y Device Key en IDB. No log de passphrase ni CDKs.

## Fuera de v1 (PWA)

Compose, search, tab bar, lock por idle, passkeys, quiet hours, sonidos, acciones ricas de notificación, invites, cambiar slug, `j/k` keyboard.
