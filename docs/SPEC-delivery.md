# Spec: delivery

## Objective

Persistir mensajes cifrados, fan-out live (Realtime), wake-up (Web Push), acks de leído/borrado. El server no arma title/body.

## Tech Stack

- `public.messages`, `message_acks`, `push_subscriptions`
- Realtime private `chifla:user:{user_id}` + `realtime.send` trigger
- Edge `dispatch-push`, `push-register`
- Web Push RFC 8030/8291/8292 (librería `web-push` o equivalente Deno)
- VAPID secrets del deployment

## Commands

```text
supabase functions serve dispatch-push
pnpm --filter @chiflame/pwa test -- sw
```

## Project Structure

```text
supabase/functions/dispatch-push
supabase/functions/push-register
apps/web/src/sw.ts
apps/web/src/inbox
```

## Code Style

Wake-up payload (único permitido en push):

```json
{ "v": 1, "type": "message", "message_id": "<uuid>", "channel_id": "<uuid>", "priority": "default" }
```

`dispatch-push` borra `ciphertext` del webhook body al parsear:

```ts
const { id, channel_id, priority, created_at } = record
void record.ciphertext
```

Inbox query: messages del canal `left join acks` where `deleted_at is null` order `created_at desc` limit 100.

## Testing Strategy

- Trigger insert → `realtime.send` topic correcto (test SQL / supabase local).
- `dispatch-push`: nock push service; assert body JSON keys ⊆ `{v,type,message_id,channel_id,priority}`.
- 410 → row subscription deleted.
- Muted member no recibe push (sí Realtime si tiene la app abierta; **decisión:** mute suprime **push**, no el inbox. Inbox sigue mostrando. Documentar en settings).
- Swipe: ack upsert; undo nullifica `deleted_at`.
- App focused: SW no muestra notificación (test de `clients.matchAll` mock).

## Boundaries

- Always: VAPID private solo en `dispatch-push`; webhook secret.
- Ask first: cambiar wake-up a “rich encrypted preview” (posible después, sigue E2E si el preview va cifrado con CDK y el SW descifra — no el server).
- Never: log ciphertext; `showNotification` con datos que el SW no descifró (salvo fallback genérico).

## Success Criteria

- App abierta: < 1s al inbox tras `INSERT` en local.
- App cerrada (Chrome): notificación SO con title descifrado si Device Key presente.
- Fallback genérico si offline.
- Swipe oculta en todos los devices del **mismo** user.
- SELECT service role del ciphertext no es plaintext JSON `{title,body}`.

## Open Questions

Ninguna. Mute = solo push, no el inbox. Fan-out = `pg_net` en migraciones (reproducible; no webhook click-ops del dashboard).
