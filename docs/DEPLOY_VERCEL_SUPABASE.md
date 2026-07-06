# Deploy na Vercel + Supabase (projeto novo)

Este app guarda **todo o estado** em uma linha JSON (`pelada_state.id = 1`). O login continua sendo **NextAuth** com usuários dentro desse JSON (não usa Supabase Auth).

## 1. Supabase — projeto “statu futebol”

1. Abra o [Dashboard](https://supabase.com/dashboard) do projeto **statu futebol** (org **diegoccg-code's Org 2**).
2. Vá em **SQL Editor** → **New query**.
3. Cole e execute o conteúdo completo do arquivo [`supabase/pelada_state.sql`](../supabase/pelada_state.sql) (cria a tabela `public.pelada_state` e o trigger de `updated_at`).
4. Confira em **Table Editor** se existe a tabela `pelada_state` com colunas `id`, `data`, `created_at`, `updated_at`.
5. Execute também [`supabase/champion_photos.sql`](../supabase/champion_photos.sql) (fotos do campeão **fora** do JSON principal — reduz egress).
6. Se o JSON em produção ainda tiver fotos embutidas (~1 MB), rode uma vez:

```bash
npm run migrate-champion-photos
```

Isso move as fotos para `champion_photos` e limpa o `pelada_state`. Na próxima visita ao app, a migração também ocorre automaticamente no servidor.

### Chaves do projeto

Em **Project Settings → API**:

| Variável | Onde copiar |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** (ex.: `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (secreta — só servidor / Vercel) |

> **Nunca** commite a `service_role` no Git. Use só em `.env.local` e na Vercel (Environment Variables).

URL do seu projeto (confira no painel se bate exatamente):

- `https://tufhtbrqlrnmofxjxfir.supabase.co`

## 2. Migrar dados do `database.json` (opcional)

Se você já tem dados locais em `data/database.json` e quer o mesmo estado na nuvem:

1. No Supabase, execute o SQL do passo 1 (tabela criada).
2. Na pasta do projeto, crie/atualize `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (e opcionalmente a anon, o script só precisa das duas primeiras + service role).
3. Rode (na pasta do projeto; o script lê `.env.local` automaticamente):

```bash
cd "C:\Users\diego\Desktop\aplicativo futebol"
npm run import-db
```

Isso faz **upsert** de `id = 1` com o JSON inteiro do arquivo.

> Se usar Node 20+, também funciona: `node --env-file=.env.local scripts/import-database-json.mjs`

Se ainda **não** tiver `database.json`, pode pular: na primeira subida com Supabase configurado, o app cria estrutura vazia + admin padrão na migração.

## 3. Variáveis de ambiente na Vercel

1. Conecte o repositório Git do app na [Vercel](https://vercel.com).
2. Em **Settings → Environment Variables**, adicione (para **Production** e **Preview** se quiser):

| Nome | Valor / observação |
|------|---------------------|
| `NEXTAUTH_SECRET` | String longa aleatória (ex.: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL **exata** do site depois do deploy, ex.: `https://seu-projeto.vercel.app` (sem barra no final). Se usar domínio próprio, use esse domínio. |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |

3. Faça o **Redeploy** depois de salvar as variáveis (a primeira build pode ter falhado sem elas).

### Ajuste do `NEXTAUTH_URL`

- Depois do primeiro deploy, copie a URL que a Vercel mostra (ex.: `https://aplicativo-futebol-xxx.vercel.app`).
- Coloque **exatamente** essa URL em `NEXTAUTH_URL` e faça **Redeploy**.
- Sem isso, login/cookies podem falhar em produção.

## 4. Build local (teste antes)

```bash
npm install
npm run build
```

Se passar, a Vercel costuma passar também (mesmo `next build`).

## 5. Checklist rápido

- [ ] SQL `pelada_state.sql` executado no projeto novo  
- [ ] SQL `champion_photos.sql` executado (fotos separadas do JSON)  
- [ ] `migrate-champion-photos` se o JSON em produção ainda tiver fotos grandes  
- [ ] Variáveis na Vercel (incluindo `NEXTAUTH_URL` = URL real do deploy)  
- [ ] `import-db` rodado se quiser copiar `database.json`  
- [ ] Login de produção com usuários que existem no JSON (ou primeiro acesso cria `admin@pelada.local` se não houver usuários)

## Segurança

- A `SUPABASE_SERVICE_ROLE_KEY` ignora RLS — mantenha só no servidor (variáveis da Vercel **não** marque como “expor ao browser”).
- O app usa essa chave só em rotas/API **server-side** (`lib/store.ts`).
