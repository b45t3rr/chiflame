alter table public.pairing_sessions
  add column if not exists poll_access_token text,
  add column if not exists poll_refresh_token text;
