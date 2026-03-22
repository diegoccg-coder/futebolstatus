# Pelada — aplicativo futebol

Aplicativo local para cadastrar jogadores, sortear times (dois em campo ou **racha** com 3 ou 4 times), definir **ordem da fila** no sorteio, duração das partidas (ex.: 8 min), registrar gols, assistências e campeão, e ver rankings.

Há **login** com perfis:

- **Administrador:** cadastro de jogadores, sorteio, jogos, gols, campeão, usuários e **rachas marcados** (agenda).
- **Jogador:** painel, **quem vai jogar** (último sorteio), **rachas marcados**, **resultados** (leitura), **ranking**.

No racha, a interface explica a regra: **quem ganha fica**, **quem perde sai** e entra o **próximo time da fila**.

## Requisitos

- Node.js 18+

## Primeiro acesso

1. Suba o servidor (`executar.bat` ou `npm run dev`).
2. Abra [http://localhost:3000](http://localhost:3000) — você será enviado ao **login**.
3. Na **primeira execução**, se não existir nenhum usuário no `database.json`, é criado automaticamente:
   - **Email:** `admin@pelada.local`
   - **Senha:** `admin123`
4. Entre em **Usuários** (menu admin) e crie contas **jogador** para a galera (nome, email, senha).

Opcional: copie `.env.example` para `.env.local` e defina `NEXTAUTH_SECRET` (string longa aleatória) e `NEXTAUTH_URL` (ex.: `http://localhost:3000`). Se não definir, o app usa um segredo de desenvolvimento embutido.

## Modo Supabase (online / Vercel)

1. No Supabase, execute o SQL de `supabase/pelada_state.sql` (cria `public.pelada_state`).
2. No seu `.env.local`, configure:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (usado apenas no servidor)
3. Rode e teste no local (`npm run dev`). Assim que as variáveis estiverem setadas, o app para de usar `data/database.json` e começa a persistir no Supabase.

**Guia completo (Vercel + migração + variáveis):** veja [`docs/DEPLOY_VERCEL_SUPABASE.md`](docs/DEPLOY_VERCEL_SUPABASE.md).

**Importar dados locais para o Supabase** (após criar a tabela):

```bash
node scripts/import-database-json.mjs
```

(O script lê `.env.local` sozinho. Também: `npm run import-db`.)

## Uso

**Windows:** dê duplo clique em `executar.bat` na pasta do projeto (instala dependências na primeira vez e inicia o servidor).

Ou no terminal:

```bash
cd "C:\Users\diego\Desktop\aplicativo futebol"
npm install
npm run dev
```

## Dados (local x Supabase)

Por padrão (sem Supabase configurado), tudo fica em `data/database.json`.

Quando você configurar Supabase (variáveis em `.env.local`), o app passa a persistir o estado em uma tabela única:

- `public.pelada_state` com coluna `data jsonb` (crie via `supabase/pelada_state.sql`).

Mesmo no Supabase, o primeiro admin também é criado automaticamente na migração.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` / `npm run start` — produção
