-- Keep authorization helpers outside PostgREST's exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_channel_member(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.channel_members where channel_id = p_channel and user_id = auth.uid());
$$;

create or replace function private.can_publish(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = p_channel and user_id = auth.uid() and role in ('owner', 'publisher')
  );
$$;

create or replace function private.owns_active_device(p_device uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.devices where id = p_device and user_id = auth.uid() and revoked_at is null
  );
$$;

create or replace function private.is_channel_owner(p_channel uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.channels where id = p_channel and owner_id = auth.uid());
$$;

revoke all on function private.is_channel_member(uuid) from public, anon, authenticated;
revoke all on function private.can_publish(uuid) from public, anon, authenticated;
revoke all on function private.owns_active_device(uuid) from public, anon, authenticated;
revoke all on function private.is_channel_owner(uuid) from public, anon, authenticated;

drop policy if exists channels_select_member on public.channels;
create policy channels_select_member on public.channels for select to authenticated
  using (owner_id = auth.uid() or private.is_channel_member(id));

drop policy if exists channel_members_select on public.channel_members;
create policy channel_members_select on public.channel_members for select to authenticated
  using (private.is_channel_member(channel_id));

drop policy if exists channel_members_insert_owner on public.channel_members;
create policy channel_members_insert_owner on public.channel_members for insert to authenticated
  with check (private.is_channel_owner(channel_id) and user_id = auth.uid());

drop policy if exists channel_members_update_owner on public.channel_members;
create policy channel_members_update_owner on public.channel_members for update to authenticated
  using (private.is_channel_owner(channel_id)) with check (private.is_channel_owner(channel_id));

drop policy if exists channel_members_delete_owner on public.channel_members;
create policy channel_members_delete_owner on public.channel_members for delete to authenticated
  using (private.is_channel_owner(channel_id));

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated
  using (private.is_channel_member(channel_id));

drop policy if exists messages_insert_publisher on public.messages;
create policy messages_insert_publisher on public.messages for insert to authenticated
  with check (private.can_publish(channel_id) and private.owns_active_device(sender_device_id));

drop policy if exists message_acks_all_own on public.message_acks;
create policy message_acks_all_own on public.message_acks for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id and private.is_channel_member(m.channel_id))
  );

drop policy if exists push_subscriptions_all_own on public.push_subscriptions;
create policy push_subscriptions_all_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.owns_active_device(device_id));

-- These helpers are used only by RLS policies. Removing the public copies also
-- removes their /rest/v1/rpc attack surface.
drop function if exists public.is_channel_member(uuid);
drop function if exists public.can_publish(uuid);
drop function if exists public.owns_active_device(uuid);
drop function if exists public.is_channel_owner(uuid);

-- Pairing lookup now runs in the JWT-verified pair-session Edge Function.
drop function if exists public.get_pairing_session(uuid);

-- Explicit service-role-only policies document the intended server-only access
-- and resolve ambiguous RLS-without-policy findings without granting clients access.
create policy app_settings_service_role_only on public.app_settings for all to service_role
  using (true) with check (true);
create policy pairing_sessions_service_role_only on public.pairing_sessions for all to service_role
  using (true) with check (true);
