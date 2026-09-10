# Wireframes PWA (cerrado)

Baja fidelidad. Jerarquía, copy y gestos son contrato. Color system no.

Viewport de referencia mobile: **390×844**. La app escala a canvas fluido en tablet y a navegación lateral persistente desde **1024px**. Mobile no usa master-detail permanente; desktop puede mostrar rail de canales y paneles de contenido sin cambiar las rutas.

Catálogo de rutas: [08-pwa.md](./08-pwa.md).

---

## Gestos

| Gesto | Dónde | Acción |
|---|---|---|
| Swipe derecha | row inbox | borrar + undo 5s |
| Swipe izquierda | row inbox | no-op |
| Pull down | inbox | refresh |
| Tap row | inbox | detalle + read |
| Tap `slug ▾` | header inbox | sheet canales |
| Tap ⚙ | header inbox | `/settings` |
| Tap atrás | settings / detalle | historial |
| Long-press | — | no-op v1 |

---

## 1. Welcome `/` (guest)

```text
┌─────────────────────────────────┐
│                                 │
│                                 │
│            CHIFLAME             │
│                                 │
│      avisos cifrados a tu       │
│           dispositivo           │
│                                 │
│     [ Crear vault          ]    │
│                                 │
│     [ Cómo instalar        ]    │  ← si iOS tab o no standalone
│                                 │
│  Si perdés la passphrase,       │
│  no hay backdoor. Ni nosotros.  │
│                                 │
└─────────────────────────────────┘
```

Sin “Unlock” (eso es redirect automático). Sin input de pairing id.

---

## 2. Onboarding `/onboarding`

### Paso 1 — Passphrase

```text
┌─────────────────────────────────┐
│  1 / 4                          │
│  Creá tu passphrase             │
│                                 │
│  Mínimo 12 caracteres.          │
│  Guardala en Bitwarden,         │
│  1Password o Google.            │
│                                 │
│  Passphrase                     │
│  [ ••••••••••••            ]    │
│  Confirmar                      │
│  [ ••••••••••••            ]    │
│                                 │
│  Email (opcional)               │
│  No sirve para descifrar.       │
│  [                         ]    │
│                                 │
│  [ Continuar               ]    │
│                                 │
│  ⚠ Sin passphrase no hay        │
│    recuperación de mensajes.    │
└─────────────────────────────────┘
```

Continuar disabled hasta match + largo. Error inline si el signUp falla.

### Paso 2 — Instalar

```text
┌─────────────────────────────────┐
│  2 / 4                          │
│  Instalá la app                 │
│                                 │
│  En iPhone las notificaciones   │
│  solo funcionan desde el icono. │
│                                 │
│  [ Instalar                ]    │  ← beforeinstallprompt o → /install
│                                 │
│  [ Ahora no                ]    │
└─────────────────────────────────┘
```

Skip automático si ya `standalone`.

### Paso 3 — Notificaciones

```text
┌─────────────────────────────────┐
│  3 / 4                          │
│  Activá las notificaciones      │
│                                 │
│  Así te llega el chifla con     │
│  la app cerrada.                │
│                                 │
│  El contenido se descifra       │
│  en este dispositivo.           │
│                                 │
│  [ Activar                 ]    │  ← gesto requestPermission
│                                 │
│  [ Ahora no                ]    │
└─────────────────────────────────┘
```

iOS tab (sin PushManager):

```text
│  En Safari (pestaña) iOS no     │
│  hay push.                      │
│  [ Cómo instalar           ]    │
│  [ Seguir sin push         ]    │
```

### Paso 4 — Listo

```text
┌─────────────────────────────────┐
│  4 / 4                          │
│  Vault listo                    │
│                                 │
│  En tu máquina:                 │
│                                 │
│  ┌─────────────────────────┐    │
│  │ npm i -g chiflame       │    │
│  │ chifla auth pair        │    │
│  └─────────────────────────┘    │
│                                 │
│  Escaneá el QR que aparece.     │
│                                 │
│  [ Ir al inbox             ]    │
└─────────────────────────────────┘
```

---

## 3. Unlock `/unlock`

```text
┌─────────────────────────────────┐
│                                 │
│            CHIFLAME             │
│                                 │
│  Passphrase                     │
│  [                         ]    │
│                                 │
│  [ Desbloquear             ]    │
│                                 │
│  Passphrase incorrecta.         │  ← solo error
│                                 │
│  ¿La olvidaste?                 │
│  No podemos ayudarte.           │
│  Eso es el diseño.              │
└─────────────────────────────────┘
```

---

## 4. Pair `/pair/:id`

### Confirm

```text
┌─────────────────────────────────┐
│  Pair CLI                       │
│                                 │
│  ¿Ves este código en la         │
│  terminal?                      │
│                                 │
│         K 7 F 2 Q 9             │
│                                 │
│  Nombre de la máquina           │
│  [ dev-laptop            ]    │
│                                 │
│  Fingerprint  a1b2c3d4          │
│                                 │
│  [ Confirmar               ]    │
│  [ Rechazar                ]    │
└─────────────────────────────────┘
```

### Expired / denied / mismatch (misma ruta)

```text
┌─────────────────────────────────┐
│  Pair CLI                       │
│                                 │
│  Este QR ya no sirve.           │
│                                 │
│  En la terminal volvé a correr  │
│  chifla auth pair               │
│                                 │
│  [ Entendido               ]    │  → /inbox o / 
└─────────────────────────────────┘
```

Copy por estado: expired / denied (“rechazaste este pair”) / mismatch (“el código no coincide con esta CLI”) / not_found.

---

## 5. Install `/install`

```text
┌─────────────────────────────────┐
│ ←                               │
│  Instalar en iPhone             │
│                                 │
│  1. Tap Compartir               │
│  2. Agregar a inicio            │
│  3. Abrí Chiflame desde el      │
│     icono (no desde Safari)     │
│  4. Activá notificaciones       │
│                                 │
│  En una pestaña de Safari       │
│  iOS no permite push.           │
└─────────────────────────────────┘
```

Android/desktop: un paso “Instalar” si hay `beforeinstallprompt`, si no instrucciones del browser.

---

## 6. Inbox `/inbox` y `/c/:slug`

### Con mensajes

```text
┌─────────────────────────────────┐
│ ⬤ inbox            ▾        ⚙   │
│─────────────────────────────────│
│ ●  Deploy              2m       │
│    prod OK                      │
│─────────────────────────────────│
│ ○  test                1h       │
│    hola desde la CLI            │
│─────────────────────────────────│
│                                 │
└─────────────────────────────────┘
```

⬤ = color del canal. ● unread / ○ read. Título = `title` descifrado (fallback: primera línea de `body`). Meta = relative time. Segunda línea = `body` 1 línea ellipsis.

### Banners (encima de la lista, dismiss ☑ persistido)

```text
│ [!] Instalá la app para push  × │
│ [!] Activá notificaciones     × │
│ [ok] CLI dev-laptop paired  × │
```

Máximo uno de install y uno de push a la vez. Paired es flash (se auto-dismiss 4s).

### Swipe derecha

```text
│████ Borrar ████│ Deploy     2m  │
│                │ prod OK        │
```

Snackbar bottom: `Borrado.  [Deshacer]` 5s.

### Vacío

```text
┌─────────────────────────────────┐
│ ⬤ inbox            ▾        ⚙   │
│                                 │
│                                 │
│        Nada todavía.            │
│                                 │
│        En tu máquina:           │
│        chifla "hola"            │
│                                 │
└─────────────────────────────────┘
```

Canal no-inbox: `chifla -c deploys "hola"`.

### Decrypt fail (row)

```text
│ ○  No se pudo descifrar    3m   │
│    Re-pair la CLI o reabrí      │
```

No es tap-to-retry agresivo; tap abre detalle con el mismo copy.

### Sheet canales (overlay)

```text
┌─────────────────────────────────┐
│  (lista dimmed)                 │
│─────────────────────────────────│
│  Canales                     ×  │
│                                 │
│  ✓ ⬤ inbox                  2   │
│    ⬤ deploys                0   │
│                                 │
│  Gestionar canales           ›  │
└─────────────────────────────────┘
```

Tap fila → `/c/{slug}` y cierra. Números = unread. Gestionar → `/settings/channels`.

---

## 7. Detalle `/c/:slug/m/:messageId`

```text
┌─────────────────────────────────┐
│ ← inbox                         │
│                                 │
│ Deploy                          │
│ hace 2 minutos · high           │
│ dev-laptop                    │
│                                 │
│ prod OK                         │
│ tests 142 passed                │
│                                 │
│ [ Abrir link ]                  │  ← solo si click https
│                                 │
│ [ Borrar ]                      │
└─────────────────────────────────┘
```

Atrás = `/c/slug`. Body wrap, texto plano, selectable.

---

## 8. Settings hub `/settings`

```text
┌─────────────────────────────────┐
│ ← Settings                      │
│─────────────────────────────────│
│ Dispositivos                 2 ›│
│ Canales                      1 ›│
│ Notificaciones                 ›│
│ Seguridad                      ›│
│ Apariencia                     ›│
│─────────────────────────────────│
│ Unpair this PWA                 │
│─────────────────────────────────│
│ v0.0.0                          │
└─────────────────────────────────┘
```

Atrás → último `/c/slug` o `/inbox`.

Confirm unpair:

```text
┌─────────────────────────────────┐
│  ¿Desvincular este dispositivo? │
│                                 │
│  Deja de recibir notificaciones │
│  acá. El vault no se borra.     │
│                                 │
│  [ Cancelar ]  [ Desvincular ]  │
└─────────────────────────────────┘
```

---

## 9. Devices `/settings/devices`

```text
┌─────────────────────────────────┐
│ ← Dispositivos                  │
│─────────────────────────────────│
│ ● Pixel 8                       │
│   PWA · este dispositivo        │
│   visto ahora                   │
│─────────────────────────────────│
│ ○ dev-laptop                  │
│   CLI · hace 5m                 │
│                  [ Revocar ]    │
│─────────────────────────────────│
│ Otra máquina:                   │
│ chifla auth pair                │
└─────────────────────────────────┘
```

Confirm revoke: `Esta CLI no va a poder mandar hasta un nuevo pair.` `[Cancelar] [Revocar]`.

---

## 10. Channels list `/settings/channels`

```text
┌─────────────────────────────────┐
│ ← Canales              + nuevo  │
│─────────────────────────────────│
│ ⬤ inbox                      ›  │
│   default · no se borra         │
│─────────────────────────────────│
│ ⬤ deploys                    ›  │
│   mute · 30 días                │
└─────────────────────────────────┘
```

`+ nuevo` → `/settings/channels/new`. Row → edit.

---

## 11. Channel new `/settings/channels/new`

```text
┌─────────────────────────────────┐
│ ← Nuevo canal                   │
│                                 │
│  Nombre                         │
│  [ Deploys                 ]    │
│                                 │
│  Slug                           │
│  [ deploys                 ]    │  autogen, editable
│                                 │
│  Color                          │
│  ( ) (●) ( ) ( ) ( ) ( )        │
│                                 │
│  Icono (opcional)               │
│  [ 🚀                      ]    │
│                                 │
│  [ Crear                   ]    │
└─────────────────────────────────┘
```

Éxito → `/c/{slug}` vacío.

---

## 12. Channel edit `/settings/channels/:slug`

```text
┌─────────────────────────────────┐
│ ← deploys                       │
│                                 │
│  Nombre   [ Deploys        ]    │
│  Slug     deploys               │  no editable v1
│  Color    (swatches)            │
│  Icono    [ 🚀             ]    │
│                                 │
│  Mute notificaciones     [ ö ]  │
│  Retención     ( 7 / 30 / 90 )  │
│                                 │
│  [ Guardar ]                    │
│                                 │
│  Eliminar canal                 │  oculto si inbox
└─────────────────────────────────┘
```

Eliminar: confirm. Mensajes se van con el cascade; copy honesta.

---

## 13. Notifications `/settings/notifications`

```text
┌─────────────────────────────────┐
│ ← Notificaciones                │
│                                 │
│  Permiso                        │
│  Activado                       │
│  [ Activar ]                    │  si default
│  Cómo instalar               ›  │  si iOS tab
│                                 │
│  Preview en la notificación     │
│  [ On ]                         │
│  Se descifra en este aparato.   │
│  Si está off: “Nueva chifla”.   │
└─────────────────────────────────┘
```

Bloqueado por el SO: copy “Activá notificaciones en Ajustes del sistema”, sin loop de requestPermission.

---

## 14. Security `/settings/security`

```text
┌─────────────────────────────────┐
│ ← Seguridad                     │
│                                 │
│  Passphrase                     │
│  Actual  [                 ]    │
│  Nueva   [                 ]    │
│  Confirmar [               ]    │
│  [ Cambiar passphrase ]         │
│  No hay recuperación.           │
│─────────────────────────────────│
│  Email                          │
│  No descifra el vault.          │
│  [ opcional@mail           ]    │
│  [ Guardar email ]              │
└─────────────────────────────────┘
```

---

## 15. Appearance `/settings/appearance`

```text
┌─────────────────────────────────┐
│ ← Apariencia                    │
│                                 │
│  (●) System                     │
│  ( ) Light                      │
│  ( ) Dark                       │
└─────────────────────────────────┘
```

---

## Loading / error genérico (inbox)

```text
│ ⬤ inbox            ▾        ⚙   │
│                                 │
│  ▭▭▭                           │
│  ▭▭▭                           │
```

```text
│  No se pudo cargar.             │
│  [ Reintentar ]                 │
```

---

## Desktop (480)

Igual que móvil. Swipe = drag o Borrar en detalle. Sin split pane v1.
