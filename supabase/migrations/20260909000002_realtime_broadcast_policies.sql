do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'chifla_user_receive'
  ) then
    create policy chifla_user_receive on realtime.messages
      for select to authenticated
      using (
        realtime.topic() = 'chifla:user:' || auth.uid()::text
        and extension = 'broadcast'
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'chifla_user_send'
  ) then
    create policy chifla_user_send on realtime.messages
      for insert to authenticated
      with check (
        realtime.topic() = 'chifla:user:' || auth.uid()::text
        and extension = 'broadcast'
      );
  end if;
end $$;
