drop policy if exists channels_select_member on public.channels;
create policy channels_select_member on public.channels
  for select to authenticated
  using (owner_id = auth.uid() or public.is_channel_member(id));
