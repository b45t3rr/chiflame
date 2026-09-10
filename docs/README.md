# Chiflame — diseño

Fuente de verdad del producto **antes de implementar**. No hay código de app en esta fase.

## Cómo leer

1. [00-vision.md](./00-vision.md) — qué es, para quién, qué no es.
2. [01-capability-map.md](./01-capability-map.md) — módulos y orden de build.
3. Specs por módulo (`SPEC-*.md`) cuando se implemente ese módulo.
4. El resto son contratos: schema, funciones, CLI, PWA, flujos.

Identificadores técnicos en inglés (`channel_id`, `chifla send`). Prosa de producto en español.

## Índice

| Doc | Contenido |
|---|---|
| [00-vision.md](./00-vision.md) | Problema, usuario, anti-goals, éxito |
| [01-capability-map.md](./01-capability-map.md) | Módulos estables y dependencias |
| [02-product.md](./02-product.md) | Canales, roles, features in/out |
| [03-architecture.md](./03-architecture.md) | Diagramas, servicios, límites |
| [04-security.md](./04-security.md) | E2E, VAPID, pairing, threat model |
| [05-supabase.md](./05-supabase.md) | Servicios, SQL de referencia, RLS, Realtime |
| [06-edge-functions.md](./06-edge-functions.md) | Contratos HTTP de cada function |
| [07-cli.md](./07-cli.md) | Comandos, flags, config, exit codes |
| [08-pwa.md](./08-pwa.md) | **Páginas PWA cerradas**, guards, SW, push |
| [09-flows.md](./09-flows.md) | Mapa de navegación + flujos |
| [10-wireframes.md](./10-wireframes.md) | Wireframe de cada pantalla |
| [11-agent-first.md](./11-agent-first.md) | Contrato para agentes + snippet AGENTS.md |
| [12-roadmap.md](./12-roadmap.md) | v1 / v1.1 / v2 |
| [SPEC-identity.md](./SPEC-identity.md) | Cuentas, passphrase, pairing, devices |
| [SPEC-crypto.md](./SPEC-crypto.md) | KDF, envelope, formatos, tests E2E |
| [SPEC-channels.md](./SPEC-channels.md) | Inbox, slugs, members |
| [SPEC-delivery.md](./SPEC-delivery.md) | Persistencia, Realtime, Web Push, acks |
| [SPEC-cli.md](./SPEC-cli.md) | Paquete npm `chiflame` / binario `chifla` |
| [SPEC-pwa.md](./SPEC-pwa.md) | App instalable, inbox, settings |

## Decisiones ya cerradas

Están en visión y arquitectura. Las que no se reabren sin actualizar estos docs:

- E2E zero-knowledge del **contenido** (title/body). Metadatos de routing sí son visibles en Supabase.
- VAPID es del **deployment**, no se deriva del passphrase.
- v1 = **1 PWA + N CLIs**. `channel_members` existe; invites y segunda PWA son v1.1.
- Entrega = tabla `messages` + Realtime + Web Push wake-up.
- Swipe derecha = tombstone por usuario (`message_acks`), no `DELETE` global.
- CLI: sesión GoTrue del user; `device_id` en config, no en `app_metadata`.
- Canales nuevos: CDK a `channel_members` + `device_channel_keys` (no hace falta re-pair).
- Email sintético interno si el humano no pone email. Recovery de GoTrue OFF.
- Ciphertext on-the-wire = columnas `alg`/`nonce`/`ct`. AAD = `message_id|channel_id|sender_device_id`.
- Pairing = HTTP poll, no Realtime. `pair-init` es la única que inserta `pairing_sessions`.

## Qué no está aquí

Código, migraciones aplicadas, deploy, npm publish. El SQL de [05-supabase.md](./05-supabase.md) es **especificación**, no está corrido contra el proyecto remoto todavía.
