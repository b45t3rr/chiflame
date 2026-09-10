-- 20260909000007_security_audit_hardening.sql
-- Security Hardening & Performance Optimizations

-- 1. VULN-01 Fix: Revoke direct SELECT on pairing_sessions from authenticated users
-- to prevent global enumeration of pending pairing sessions and verify codes.
drop policy if exists pairing_sessions_select_pending on public.pairing_sessions;
revoke select on public.pairing_sessions from authenticated, anon;

-- Create secure RPC: only users with knowledge of the exact UUID (from physical QR) can fetch the session.
create or replace function public.get_pairing_session(p_id uuid)
returns table (
  id uuid,
  cli_public_key text,
  cli_name text,
  verify_code text,
  status public.pairing_status,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    cli_public_key,
    cli_name,
    verify_code,
    status,
    expires_at
  from public.pairing_sessions
  where id = p_id
    and status = 'pending'
    and expires_at > now();
$$;

revoke all on function public.get_pairing_session(uuid) from public, anon;
grant execute on function public.get_pairing_session(uuid) to authenticated;

-- 2. VULN-04 Fix: Update expire_pairings to scrub orphaned session tokens from completed pairings
create or replace function public.expire_pairings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- Mark pending sessions as expired
  update public.pairing_sessions
    set status = 'expired'
    where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;

  -- Scrub residual tokens and sealed keys from completed pairings older than 10 minutes
  update public.pairing_sessions
    set wrapped_result = null,
        poll_access_token = null,
        poll_refresh_token = null
    where status = 'completed'
      and (expires_at < now() or created_at < now() - interval '10 minutes')
      and (poll_access_token is not null or poll_refresh_token is not null);

  return n;
end;
$$;

-- 3. VULN-05 Fix: Revoke EXECUTE on rls_auto_enable trigger function from public/anon/authenticated
do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable') then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 4. Covering indexes on unindexed foreign keys (Supabase performance advisor)
create index if not exists device_channel_keys_channel_id_idx on public.device_channel_keys (channel_id);
create index if not exists message_acks_user_id_idx on public.message_acks (user_id);
create index if not exists messages_sender_device_id_idx on public.messages (sender_device_id);
create index if not exists pairing_sessions_device_id_idx on public.pairing_sessions (device_id);
create index if not exists pairing_sessions_user_id_idx on public.pairing_sessions (user_id);
create index if not exists push_subscriptions_device_id_idx on public.push_subscriptions (device_id);
