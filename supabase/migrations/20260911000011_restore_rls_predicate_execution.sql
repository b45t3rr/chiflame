-- RLS evaluates helper predicates as the requesting role, so that role needs
-- EXECUTE even though the functions remain in the non-exposed private schema.
grant usage on schema private to authenticated;
grant execute on function private.is_channel_member(uuid) to authenticated;
grant execute on function private.can_publish(uuid) to authenticated;
grant execute on function private.owns_active_device(uuid) to authenticated;
grant execute on function private.is_channel_owner(uuid) to authenticated;
