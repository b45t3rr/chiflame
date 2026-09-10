-- Chiflame v1 schema, RLS, helpers, realtime broadcast.

create type public.device_kind as enum ('cli', 'pwa');
create type public.pairing_status as enum ('pending', 'completed', 'expired', 'denied');
create type public.channel_kind as enum ('inbox', 'personal', 'shared');
create type public.channel_role as enum ('owner', 'publisher', 'subscriber');
create type public.message_priority as enum ('min', 'low', 'default', 'high', 'urgent');

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
  client_ip text,
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

create table public.device_channel_keys (
  device_id uuid not null references public.devices (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  wrapped_cdk text not null,
  primary key (device_id, channel_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

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

create or replace function public.is_channel_owner(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channels
    where id = p_channel and owner_id = auth.uid()
  );
$$;

create or replace function public.expire_pairings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.pairing_sessions
    set status = 'expired'
    where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.purge_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.messages m
  using public.channels c
  where m.channel_id = c.id
    and (
      m.created_at < now() - (c.retention_days || ' days')::interval
      or (m.expires_at is not null and m.expires_at < now())
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.channels where id = new.channel_id;
  begin
    perform realtime.send(
      'chifla:user:' || v_owner::text,
      'message',
      jsonb_build_object(
        'type', 'message',
        'message_id', new.id,
        'channel_id', new.channel_id,
        'priority', new.priority,
        'created_at', new.created_at
      ),
      true
    );
  exception when others then
    raise warning 'realtime.send failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trg_on_message_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.pairing_sessions enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_acks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.device_channel_keys enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy devices_select_own on public.devices
  for select to authenticated using (user_id = auth.uid());
create policy devices_insert_own_pwa on public.devices
  for insert to authenticated
  with check (user_id = auth.uid() and kind = 'pwa');
create policy devices_update_own on public.devices
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy pairing_sessions_select_pending on public.pairing_sessions
  for select to authenticated
  using (status = 'pending' and expires_at > now());

create policy channels_select_member on public.channels
  for select to authenticated using (public.is_channel_member(id));
create policy channels_insert_own on public.channels
  for insert to authenticated with check (owner_id = auth.uid());
create policy channels_update_owner on public.channels
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy channels_delete_owner on public.channels
  for delete to authenticated
  using (owner_id = auth.uid() and kind <> 'inbox');

create policy channel_members_select on public.channel_members
  for select to authenticated using (public.is_channel_member(channel_id));
create policy channel_members_insert_owner on public.channel_members
  for insert to authenticated
  with check (
    public.is_channel_owner(channel_id)
    and user_id = auth.uid()
  );
create policy channel_members_update_owner on public.channel_members
  for update to authenticated
  using (public.is_channel_owner(channel_id))
  with check (public.is_channel_owner(channel_id));
create policy channel_members_delete_owner on public.channel_members
  for delete to authenticated
  using (public.is_channel_owner(channel_id));

create policy messages_select_member on public.messages
  for select to authenticated using (public.is_channel_member(channel_id));
create policy messages_insert_publisher on public.messages
  for insert to authenticated
  with check (
    public.can_publish(channel_id)
    and public.owns_active_device(sender_device_id)
  );

create policy message_acks_all_own on public.message_acks
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_channel_member(m.channel_id)
    )
  );

create policy push_subscriptions_all_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.owns_active_device(device_id)
  );

create policy device_channel_keys_select on public.device_channel_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.user_id = auth.uid()
    )
  );
create policy device_channel_keys_insert on public.device_channel_keys
  for insert to authenticated
  with check (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.user_id = auth.uid()
    )
  );
create policy device_channel_keys_delete on public.device_channel_keys
  for delete to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.user_id = auth.uid()
    )
  );

revoke all on function public.is_channel_member(uuid) from public;
revoke all on function public.can_publish(uuid) from public;
revoke all on function public.owns_active_device(uuid) from public;
revoke all on function public.is_channel_owner(uuid) from public;
grant execute on function public.is_channel_member(uuid) to authenticated;
grant execute on function public.can_publish(uuid) to authenticated;
grant execute on function public.owns_active_device(uuid) to authenticated;
grant execute on function public.is_channel_owner(uuid) to authenticated;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select on public.pairing_sessions to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.channel_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.message_acks to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, delete on public.device_channel_keys to authenticated;
