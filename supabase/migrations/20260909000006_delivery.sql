-- Fix realtime.send argument order (payload, event, topic, private).
-- Fan-out to every channel member. Call dispatch-push via pg_net.

create extension if not exists pg_net;

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  r record;
  v_secret text;
  v_anon text;
begin
  for r in
    select user_id from public.channel_members where channel_id = new.channel_id
  loop
    begin
      perform realtime.send(
        jsonb_build_object(
          'type', 'message',
          'message_id', new.id,
          'channel_id', new.channel_id,
          'priority', new.priority,
          'created_at', new.created_at
        ),
        'message',
        'chifla:user:' || r.user_id::text,
        true
      );
    exception when others then
      raise warning 'realtime.send failed: %', sqlerrm;
    end;
  end loop;

  begin
    select value into v_secret from public.app_settings where key = 'webhook_secret';
    select value into v_anon from public.app_settings where key = 'supabase_anon_key';
    perform net.http_post(
      url := 'https://tnormabytsycjwnwrvip.supabase.co/functions/v1/dispatch-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', coalesce(v_anon, ''),
        'Authorization', 'Bearer ' || coalesce(v_anon, ''),
        'x-webhook-secret', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'record', jsonb_build_object(
          'id', new.id,
          'channel_id', new.channel_id,
          'priority', new.priority,
          'created_at', new.created_at
        )
      )
    );
  exception when others then
    raise warning 'dispatch-push http failed: %', sqlerrm;
  end;

  return new;
end;
$$;
