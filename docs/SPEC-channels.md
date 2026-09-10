# Spec: channels

## Objective

Inbox default, canales personales con slug, membership, retención, mute, color/icono. Schema listo para shared; producto shared = v1.1.

## Tech Stack

- Postgres tablas `channels`, `channel_members` ([05-supabase.md](./05-supabase.md))
- Crypto: wrap CDK ([SPEC-crypto.md](./SPEC-crypto.md))
- CLI: `chifla channels`, `-c`
- PWA: `/c/:slug`, Settings → Channels

## Commands

```text
pnpm --filter @chiflame/cli test -- channels
supabase db lint
```

## Project Structure

```text
supabase/migrations/*_channels.sql
apps/web/src/channels
packages/cli/src/channels.ts
```

## Code Style

Slug: `^[a-z0-9][a-z0-9_-]{0,63}$`. Inbox reservado.

Al crear canal (PWA o CLI, unlocked / paired):

```ts
const cdk = random(32)
await insertChannel(...)
await insertMember({ wrapped_channel_key: seal(profile.public_key, cdk) })
for (const cli of activeCliDevices) {
  await insertDeviceChannelKey({
    device_id: cli.id,
    wrapped_cdk: seal(cli.public_key, cdk),
  })
}
```

La PWA descifra vía `channel_members` (tiene User Key). La CLI, vía `device_channel_keys` de su `device_id`. Un canal nuevo en la PWA **no** exige re-pair.

Trigger de signup no crea el CDK (no tiene claves). Lo crea el cliente en onboarding, misma sesión.

## Testing Strategy

- Unique `(owner_id, slug)`.
- No borrar canal `kind=inbox`.
- RLS: no member → no SELECT messages.
- CLI create → PWA lista el slug (integration posterior).
- Mute no se testea en delivery aquí; el flag vive acá, `dispatch-push` lo respeta (spec delivery).

## Boundaries

- Always: un `channel_members` owner al crear; CDK wrapped nunca en claro en logs.
- Ask first: slugs globales (no); rename slug (rompe CLI cache — v1.1).
- Never: topic público sin membership; CDK generada en el server.

## Success Criteria

- Todo user nuevo tiene exactamente un canal `inbox`.
- `chifla channels create deploys` + `chifla -c deploys "x"` inserta en ese canal.
- UI puede mute/color sin tocar cripto.
- `kind=shared` existe en enum y no tiene pantallas de invite en v1.

## Open Questions

Ninguna. Invites = v1.1.
