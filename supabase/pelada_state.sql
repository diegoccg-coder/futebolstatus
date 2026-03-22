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

