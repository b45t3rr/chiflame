alter function public.set_updated_at() set search_path = public;

revoke all on function public.expire_pairings() from public, anon, authenticated;
revoke all on function public.purge_expired_messages() from public, anon, authenticated;
revoke all on function public.on_message_insert() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

revoke all on function public.is_channel_member(uuid) from public, anon;
revoke all on function public.can_publish(uuid) from public, anon;
revoke all on function public.owns_active_device(uuid) from public, anon;
revoke all on function public.is_channel_owner(uuid) from public, anon;

grant execute on function public.is_channel_member(uuid) to authenticated;
grant execute on function public.can_publish(uuid) to authenticated;
grant execute on function public.owns_active_device(uuid) to authenticated;
grant execute on function public.is_channel_owner(uuid) to authenticated;
