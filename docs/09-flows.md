# Flujos

Páginas y guards: [08-pwa.md](./08-pwa.md). Pantallas: [10-wireframes.md](./10-wireframes.md).

---

## Mapa de navegación PWA (cerrado)

```mermaid
flowchart TD
  Start["abrir URL / icono"] --> R{"sesión"}
  R -->|guest| W["/ Welcome"]
  R -->|locked| U["/unlock"]
  R -->|unlocked| I["/inbox"]

  W -->|Crear vault| OB["/onboarding"]
  W -->|iOS/desktop| INS["/install"]

  OB -->|paso 1 + next=pair| P["/pair/:id"]
  OB -->|listo| I
  U -->|ok| Next{"next?"}
  Next -->|pair| P
  Next -->|path app| APP["ruta pedida"]
  Next -->|default| I

  P -->|done| I
  P -->|guest| OB
  P -->|locked| U

  I -->|slug ▾ sheet| I
  I -->|tap row| D["/c/:slug/m/:id"]
  I -->|⚙| S["/settings"]
  I -->|banner install| INS
  I -->|banner push| N["/settings/notifications"]

  S --> Dev["/settings/devices"]
  S --> Ch["/settings/channels"]
  S --> N
  S --> Sec["/settings/security"]
  S --> Ap["/settings/appearance"]
  S -->|Unpair| W
  Ch --> New["/settings/channels/new"]
  Ch --> Ed["/settings/channels/:slug"]
```

Deep link QR siempre entra por `/pair/:id` y el mapa de arriba aplica.

---

## 1. First-run PWA-first

```mermaid
sequenceDiagram
  actor U as Usuario
  participant PWA
  participant Auth as GoTrue
  participant DB as Postgres

  U->>PWA: GET /
  PWA-->>U: Welcome
  U->>PWA: Crear vault → /onboarding
  U->>PWA: passphrase ×2
  PWA->>PWA: Argon2id, User Key, X25519, CDK inbox
  PWA->>Auth: signUp(email opcional, Auth Hash)
  PWA->>DB: INSERT profiles, inbox, members, device pwa
  alt no standalone
    U->>PWA: paso Instalar (o skip)
  end
  alt PushManager + gesto
    U->>PWA: paso Notificaciones
    PWA->>DB: push-register
  else iOS tab
    PWA-->>U: Cómo instalar → /install
  end
  PWA-->>U: Listo + chifla auth pair
  U->>PWA: Ir al inbox → /inbox
```

## 2. First-run CLI-first (QR)

```mermaid
sequenceDiagram
  actor U as Usuario
  participant CLI
  participant EF as pair-*
  participant PWA
  participant Auth as GoTrue

  U->>CLI: chifla auth pair
  CLI->>EF: pair-init
  CLI-->>U: QR + K7F2Q9
  U->>PWA: /pair/:id#cli_pub
  alt guest
    PWA->>PWA: /onboarding?next=/pair/:id
    U->>PWA: solo paso passphrase
    PWA->>Auth: signUp
  else locked
    PWA->>PWA: /unlock?next=/pair/:id
  end
  PWA-->>U: confirm código + nombre
  U->>PWA: Confirmar
  PWA->>PWA: seal CDKs to cli_public_key
  PWA->>EF: pair-complete
  loop 1s
    CLI->>EF: pair-poll + PoP
  end
  EF-->>CLI: session + channel_keys_sealed
  CLI->>CLI: unseal, config 0600
  PWA->>PWA: /inbox?paired=1
  Note over PWA: banners install / push si faltan
```

## 3. Send feliz

```mermaid
sequenceDiagram
  participant CLI
  participant DB
  participant RT as Realtime
  participant EF as dispatch-push
  participant SW
  participant PWA

  CLI->>CLI: encrypt with CDK
  CLI->>DB: INSERT messages
  DB->>RT: send chifla:user:{uid}
  DB->>EF: webhook
  RT-->>PWA: meta
  PWA->>DB: SELECT + decrypt
  PWA->>PWA: prepend en /inbox o /c/slug
  EF->>SW: wake-up
  alt window focused
    SW-->>SW: skip notificación
  else background
    SW->>DB: GET + decrypt
    SW->>SW: showNotification
  end
```

## 4. App abierta vs cerrada + tap

```mermaid
flowchart TD
  I[INSERT messages] --> RT[Realtime]
  I --> WH[dispatch-push]
  RT --> Open{PWA focused?}
  Open -->|sí| Inbox["prepend lista"]
  Open -->|no| Drop[nada en UI]
  WH --> SW[Service Worker]
  SW --> Foc{window focused?}
  Foc -->|sí| Skip[no showNotification]
  Foc -->|no| Notif[Notificación SO]
  Notif --> Tap["notificationclick"]
  Tap --> Det["/c/{slug}/m/{messageId}"]
```

## 5. Swipe delete + undo

```mermaid
sequenceDiagram
  actor U
  participant PWA
  participant DB

  U->>PWA: swipe derecha en /c/slug
  PWA->>PWA: saca row optimistic
  PWA->>DB: upsert message_acks deleted_at=now()
  PWA-->>U: snackbar Undo 5s
  alt undo
    U->>PWA: Undo
    PWA->>DB: deleted_at=null
    PWA->>PWA: restaura
  else timeout
    Note over PWA: tombstone; otros devices del user ocultan al refetch
  end
```

No `DELETE` de `messages`.

## 6. Revoke CLI

```mermaid
sequenceDiagram
  actor U
  participant PWA
  participant EF as device-revoke
  participant CLI
  participant DB

  U->>PWA: /settings/devices → Revocar
  PWA-->>U: confirm
  U->>PWA: confirmar
  PWA->>EF: device-revoke
  EF->>DB: revoked_at
  CLI->>DB: INSERT messages
  DB-->>CLI: 403
  CLI-->>CLI: exit 4
```

## 7. Re-pair máquina nueva

Flujo 2 con cuenta existente (`locked` o `unlocked`). CDKs se sellan al nuevo `cli_public_key`. El CLI viejo sigue válido hasta revoke.

## 8. iOS install gate

```mermaid
flowchart TD
  A[iOS Safari tab] --> B{standalone?}
  B -->|no| C[PushManager ausente]
  C --> D[banner inbox y/o /install]
  D --> E[Agregar a inicio]
  E --> F[abrir desde icono]
  F --> G["gesto → /settings/notifications o banner"]
  G --> H[push-register]
  B -->|sí| G
```

## 9. Agente

```mermaid
sequenceDiagram
  actor H as Humano
  participant Ag as Agente
  participant CLI

  H->>Ag: y chiflame cuando termines
  Ag->>CLI: chifla "tests green"
  CLI-->>Ag: exit 0
```

El agente no navega la PWA. Pairing es humano.

---

## 10. Unlock cotidiano

```mermaid
flowchart LR
  Icon[icono PWA] --> I["/inbox"]
  I --> L{unlocked?}
  L -->|no| U["/unlock?next=/inbox"]
  U --> I2["/inbox"]
```

## 11. Unpair this PWA

```mermaid
sequenceDiagram
  actor U
  participant PWA
  participant EF as device-revoke
  participant DB

  U->>PWA: /settings → Unpair this PWA
  PWA-->>U: confirm (deja de recibir push aquí)
  U->>PWA: confirmar
  PWA->>EF: device-revoke este device
  PWA->>PWA: clear IDB + signOut
  PWA->>PWA: /  Welcome
```

## 12. Crear canal

```mermaid
flowchart LR
  A["/settings/channels"] --> B["/settings/channels/new"]
  B --> C[genera CDK + insert channel + member]
  C --> D["/c/{slug} vacío"]
```

## 13. Pairing error

```mermaid
flowchart TD
  P["/pair/:id"] --> S{status}
  S -->|pending + match| C[confirm]
  S -->|expired| E["código viejo — corré chifla auth pair de nuevo"]
  S -->|denied| D[rechazado]
  S -->|not_found| N[sesión inválida]
  S -->|mismatch hash| M[QR incompleto / MITM — nuevo pair]
```
