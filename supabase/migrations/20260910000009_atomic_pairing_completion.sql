-- Claim a pairing, register the CLI, and attach its one-time credentials in one
-- transaction. Only the service-role Edge Function can execute this RPC.
create or replace function public.complete_pairing(
  p_id uuid,
  p_verify_code text,
  p_user_id uuid,
  p_device_name text,
  p_wrapped_result text,
  p_access_token text,
  p_refresh_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.pairing_sessions%rowtype;
  v_device_id uuid;
begin
  select * into v_session from public.pairing_sessions where id = p_id for update;
  if not found or v_session.status <> 'pending' or v_session.expires_at <= now()
    or v_session.verify_code <> p_verify_code then
    return null;
  end if;

  insert into public.devices (user_id, kind, name, public_key, sign_public_key)
  values (p_user_id, 'cli', left(p_device_name, 120), v_session.cli_public_key, v_session.cli_sign_public_key)
  returning id into v_device_id;

  update public.pairing_sessions
  set status = 'completed', user_id = p_user_id, device_id = v_device_id,
      wrapped_result = p_wrapped_result, poll_access_token = p_access_token,
      poll_refresh_token = p_refresh_token
  where id = p_id;

  return v_device_id;
end;
$$;
revoke all on function public.complete_pairing(uuid, text, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_pairing(uuid, text, uuid, text, text, text, text) to service_role;
