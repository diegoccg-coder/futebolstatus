-- Fotos do campeão fora do JSON principal (reduz egress do pelada_state).
-- Execute no SQL Editor do Supabase após pelada_state.sql.

create table if not exists public.champion_photos (
  agendamento_id text primary key,
  best_team_photo_url text,
  best_player_photo_url text,
  updated_at timestamptz not null default now()
);

create or replace function public.champion_photos_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists champion_photos_set_updated_at on public.champion_photos;
create trigger champion_photos_set_updated_at
before update on public.champion_photos
for each row
execute function public.champion_photos_set_updated_at();

alter table public.champion_photos enable row level security;

drop policy if exists "champion_photos_no_access_anon" on public.champion_photos;
drop policy if exists "champion_photos_no_access_authenticated" on public.champion_photos;

create policy "champion_photos_no_access_anon"
on public.champion_photos
for all
to anon
using (false)
with check (false);

create policy "champion_photos_no_access_authenticated"
on public.champion_photos
for all
to authenticated
using (false)
with check (false);
