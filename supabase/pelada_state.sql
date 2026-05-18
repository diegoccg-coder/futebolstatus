-- Tabela para persistir o estado inteiro do app (jogadores, jogos, usuários, etc.)
-- em um único `jsonb`, para simplificar a migração do app.
-- 
-- Como o app usa `SUPABASE_SERVICE_ROLE_KEY` no servidor, a leitura/escrita funciona
-- sem depender de RLS (idealmente, depois a gente pode apertar com RLS).

create table if not exists public.pelada_state (
  id integer primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mantém `updated_at` atualizado
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pelada_state_set_updated_at on public.pelada_state;
create trigger pelada_state_set_updated_at
before update on public.pelada_state
for each row
execute function public.set_updated_at();

-- Segurança (Supabase / PostgREST): RLS + políticas explícitas para anon/authenticated.
-- `USING (false)` = nenhuma linha via API pública; `service_role` no servidor ignora RLS.
alter table public.pelada_state enable row level security;

drop policy if exists "pelada_state_no_access_anon" on public.pelada_state;
drop policy if exists "pelada_state_no_access_authenticated" on public.pelada_state;

create policy "pelada_state_no_access_anon"
on public.pelada_state
for all
to anon
using (false)
with check (false);

create policy "pelada_state_no_access_authenticated"
on public.pelada_state
for all
to authenticated
using (false)
with check (false);

