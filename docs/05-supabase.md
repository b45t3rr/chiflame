# Supabase — servicios, schema, RLS, Realtime

SQL de **referencia**. No aplicar a producción hasta la fase de implementación. Source of truth futura: `supabase/migrations`. El MCP inspecciona; no sustituye migraciones en repo.

## Servicios

| Servicio | Uso v1 |
|---|---|
| Auth (GoTrue) | Usuarios, JWT, refresh. Password = Auth Hash derivado. Email opcional. |
| Postgres + RLS | Fuente de verdad. RLS en todas las tablas public. |
| Realtime | Private channels + Broadcast from DB (`realtime.send`). |
| Edge Functions | pairing, push, revoke. Ver [06-edge-functions.md](./06-edge-functions.md). |
| Vault / secrets | `VAPID_*` |
| Database Webhooks o `pg_net` | `INSERT messages` → `dispatch-push` |
| Storage | no |
| Cron (pg_cron) | expirar pairings; purge mensajes |

Realtime: **no** habilitar Postgres Changes sobre `public.messages` como camino principal.

## Extensiones

```sql
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- opcional, slugs
-- pg_cron y pg_net según el plan de Supabase
```

## Tipos

```sql
create type public.device_kind as enum ('cli', 'pwa');
create type public.pairing_status as enum ('pending', 'completed', 'expired', 'denied');
create type public.channel_kind as enum ('inbox', 'personal', 'shared');
create type public.channel_role as enum ('owner', 'publisher', 'subscriber');
create type public.message_priority as enum ('min', 'low', 'default', 'high', 'urgent');
```

## Tablas

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  kdf jsonb not null,
  wrapped_user_key text not null,
  public_key text not null,
  wrapped_private_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (
    handle is null or handle ~ '^[a-z0-9_]{3,32}$'
  )
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.device_kind not null,
  name text not null,
  public_key text,
  sign_public_key text,
  user_agent text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index devices_user_id_idx on public.devices (user_id) where revoked_at is null;

create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  cli_public_key text not null,
  cli_sign_public_key text not null,
  cli_name text,
  verify_code text not null,
  status public.pairing_status not null default 'pending',
  user_id uuid references public.profiles (id),
  device_id uuid references public.devices (id),
  wrapped_result text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index pairing_sessions_status_exp_idx
  on public.pairing_sessions (status, expires_at);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  name text not null,
  kind public.channel_kind not null default 'personal',
  color text,
  icon text,
  default_priority public.message_priority not null default 'default',
  retention_days integer not null default 30,
  created_at timestamptz not null default now(),
  unique (owner_id, slug),
  constraint channels_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint channels_inbox_kind check (
    (kind = 'inbox' and slug = 'inbox')
    or (kind <> 'inbox' and slug <> 'inbox')
  )
);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.channel_role not null,
  wrapped_channel_key text not null,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_idx on public.channel_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  sender_device_id uuid not null references public.devices (id),
  ciphertext text not null,
  nonce text not null,
  alg text not null default 'xchacha20poly1305',
  priority public.message_priority not null default 'default',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_channel_created_idx
  on public.messages (channel_id, created_at desc);

create table public.message_acks (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz,
  deleted_at timestamptz,
  primary key (message_id, user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- CDK envuelta por device CLI (canales creados después del pair)
create table public.device_channel_keys (
  device_id uuid not null references public.devices (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  wrapped_cdk text not null,
  primary key (device_id, channel_id)
);
```

### Signup: perfil + inbox

Trigger `on auth.users insert` (security definer, mínimo):

- No puede fabricar claves (eso es cliente). El perfil se inserta desde la PWA **después** de generar el vault, en la misma transacción lógica:
  1. `signUp` / `signIn` con Auth Hash.
  2. Cliente `INSERT profiles` (RLS: `id = auth.uid()`).
  3. Cliente `INSERT channels` inbox + `channel_members` owner con CDK wrapped.

Si el paso 2 falla, hay user Auth huérfano: job de limpieza o retry en onboarding.

## Helpers RLS

```sql
create or replace function public.is_channel_member(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = p_channel and user_id = auth.uid()
  );
$$;

create or replace function public.can_publish(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = p_channel
      and user_id = auth.uid()
      and role in ('owner', 'publisher')
  );
$$;
```

`security definer` aquí evita recursión RLS. Grants: `execute` para `authenticated` solamente. El cuerpo solo usa `auth.uid()`.

`device_id` **no** vive en el JWT (`app_metadata` es por usuario y rompe N CLIs). El cliente manda `sender_device_id`. Helper:

```sql
create or replace function public.owns_active_device(p_device uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.devices
    where id = p_device
      and user_id = auth.uid()
      and revoked_at is null
  );
$$;
```

Insert de `messages` exige `owns_active_device(sender_device_id)`. El CLI usa su `device_id` de config. La PWA v1 no inserta mensajes.

## RLS

Activar RLS en todas. Políticas (resumen; SQL completo en migración):

**profiles**
- SELECT / UPDATE / INSERT: `id = auth.uid()`
- INSERT adicional: `id = auth.uid()` una sola vez

**devices**
- SELECT: `user_id = auth.uid()`
- UPDATE `last_seen_at` / `name`: own, `revoked_at is null`
- INSERT: **no** desde cliente. Solo Edge `pair-complete` (service role) o bootstrap PWA (excepción: primer device `kind=pwa` con `user_id = auth.uid()`)

Política PWA self-register:

```sql
create policy devices_insert_own_pwa on public.devices
  for insert to authenticated
  with check (user_id = auth.uid() and kind = 'pwa');
```

CLI: solo service role.

**pairing_sessions**
- INSERT: **denegado** a `anon`/`authenticated`. Solo `pair-init` (service role) crea filas y el `verify_code`.
- SELECT: `authenticated` puede leer **una** fila `pending` no expirada por `id` (PWA muestra el código). No listar todas.
- UPDATE: denegado a clientes; Edge usa service role.

Rate limit `pair-init` en la Edge Function.

**channels**
- SELECT: `is_channel_member(id)`
- INSERT: `owner_id = auth.uid()`
- UPDATE: owner
- DELETE: owner y `kind <> 'inbox'`

**channel_members**
- SELECT: member del canal
- INSERT/UPDATE/DELETE: owner del canal (v1.1 invites). v1: el owner se inserta a sí mismo al crear el canal.

**messages**
- SELECT: `is_channel_member(channel_id)`
- INSERT: `can_publish(channel_id)` AND `owns_active_device(sender_device_id)`. El cliente envía `id` (uuid) para el AAD.
- UPDATE/DELETE: denegado (acks, no delete físico)
- Inbox: filtrar `expires_at is null or expires_at > now()` además de acks.

**device_channel_keys**
- SELECT/INSERT/DELETE: devices del `auth.uid()`. Al crear un canal, el cliente sella la CDK a cada CLI activa (`kind='cli'`, no revoked) y a sí mismo.

**message_acks**
- ALL: `user_id = auth.uid()`
- INSERT: además `is_channel_member` del mensaje

**push_subscriptions**
- ALL: `user_id = auth.uid()` AND device own PWA no revoked

## Realtime

Policies en `realtime.messages` (schema `realtime`):

```sql
create policy chifla_user_receive on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'chifla:user:' || auth.uid()::text
    and extension = 'broadcast'
  );

create policy chifla_user_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() = 'chifla:user:' || auth.uid()::text
    and extension = 'broadcast'
  );
```

El trigger de DB usa `realtime.send` (security definer interno de Realtime) y no necesita que el usuario haga INSERT.

Topic de pairing: opcional. v1 puede ser solo poll HTTP (`pair-poll`). Si se usa Realtime:

```sql
-- solo service role publica; el CLI no está autenticado aún.
-- Mejor: no usar Realtime para pairing. Poll 1s.
```

**Decisión:** pairing = HTTP poll. Menos superficie.

## Trigger on message insert

`realtime.send(payload jsonb, event text, topic text, private boolean)` — el orden importa. Fan-out a cada `channel_members.user_id` en topic `chifla:user:{uid}`. El mismo trigger llama `net.http_post` a `dispatch-push` (wake-up). Ver migración `20260909000006_delivery.sql`.

Webhook body: `record` con `id`, `channel_id`, `priority`. Si llega `ciphertext`, **`dispatch-push` lo descarta y no lo loguea**.

## Jobs

```sql
-- cada minuto
update public.pairing_sessions
  set status = 'expired'
  where status = 'pending' and expires_at < now();

-- diario: purge
delete from public.messages m
using public.channels c
where m.channel_id = c.id
  and m.created_at < now() - (c.retention_days || ' days')::interval;
```

## Grants

Revocar `all` de `anon`/`authenticated` y otorgar columna a columna en la migración. `anon` solo `insert` (limitado) en `pairing_sessions`. Service role: bypass RLS (Edge).

## Índices y advisors

Tras aplicar migraciones: correr advisors de seguridad/performance del MCP. Toda tabla con RLS. Sin policies faltantes.
