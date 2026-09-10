create table if not exists public.edge_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now()
);
alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from anon, authenticated;
create policy edge_rate_limits_service_role_only on public.edge_rate_limits for all to service_role
  using (true) with check (true);

create or replace function public.consume_edge_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.edge_rate_limits%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_bucket) > 300 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.edge_rate_limits (bucket) values (p_bucket)
  on conflict (bucket) do nothing;
  select * into v_row from public.edge_rate_limits where bucket = p_bucket for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.edge_rate_limits
    set window_started_at = now(), hits = 1, updated_at = now()
    where bucket = p_bucket;
    return true;
  end if;
  if v_row.hits >= p_limit then return false; end if;

  update public.edge_rate_limits set hits = hits + 1, updated_at = now() where bucket = p_bucket;
  return true;
end;
$$;
revoke all on function public.consume_edge_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to service_role;
