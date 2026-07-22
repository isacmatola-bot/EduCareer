# EduCareer

EduCareer e uma aplicacao web para apoiar estudantes de pos-graduacao, formandos de professores, escolas parceiras, mentores e empregadores do setor da educacao na Provincia de Sofala, Mocambique.

O objetivo do MVP e demonstrar uma plataforma de transicao entre formacao academica e oportunidades profissionais no setor educacional.

## Funcionalidades

- Pagina institucional com visao, missao, objetivos e impacto esperado.
- Alternancia de idioma entre ingles, portugues e japones.
- Listagem de programas: EduLink, TeachReady, EduMentor e Professional Growth Seminars.
- Oportunidades de carreira, estagio, mentoria e seminarios.
- Registo de candidatos graduados.
- Pedido de parceria por escolas e instituicoes.
- Portal de contas para visitantes, graduados, parceiros e administradores.
- Dashboard administrativo para candidaturas, parceiros, oportunidades e programas.
- Integracao preparada para Supabase Auth, PostgreSQL, RLS e Edge Functions.

## Stack

- React
- TypeScript
- Vite
- Supabase
- Vercel

## Requisitos

- Node.js `>=22.12.0`
- npm

Se usa `nvm`, execute:

```bash
nvm use
```

## Instalar e executar

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev        # servidor local
npm run typecheck  # validacao TypeScript
npm run build      # build de producao
npm run preview    # preview local do build
```

## Modo demo local

Sem variaveis Supabase, a aplicacao usa `localStorage` para demonstracao.

Durante `npm run dev`, uma conta admin demo e criada apenas para ambiente local:

```text
usuario: default.admin
senha: EduCareer@2026
```

Esta conta nao deve ser usada em producao. Builds de producao devem usar Supabase Auth.

## Configurar Supabase

Copie `.env.example` para `.env.local` e preencha:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Depois:

1. Crie um projeto Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. A confirmacao de e-mail pode permanecer ativa em **Authentication > Providers > Email**. O trigger `handle_new_user` guarda imediatamente o perfil e a candidatura Graduate ou pedido Partner; o utilizador apenas precisa confirmar o e-mail antes de iniciar sessao.
4. Crie o primeiro utilizador no Supabase Auth.
5. Promova esse utilizador para admin:

```sql
update public.profiles
set role = 'admin', admin_role = 'default_admin', status = 'active'
where email = 'admin@your-domain.com';
```

6. Configure `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente seguro da Edge Function.
7. Faça deploy das funções administrativas. A segunda mantém o email sincronizado com Supabase Auth e elimina a conta Auth juntamente com o perfil:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-manage-user
```

## Deploy na Vercel

1. Importe o repositorio do GitHub na Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em Environment Variables.

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` nas variaveis frontend da Vercel.

## Preparacao para GitHub

Esta copia ja esta preparada para upload:

- `node_modules` e `dist` foram excluidos.
- `.gitignore` foi reforcado.
- GitHub Actions valida `npm ci`, `typecheck` e `build`.
- `SECURITY.md` documenta cuidados com credenciais.
- O diagnostico tecnico esta em `docs/PROJECT_DIAGNOSIS.md`.
- O guia de upload esta em `docs/GITHUB_UPLOAD.md`.

## Licenca

Defina a licenca antes de tornar o repositorio publico ou aceitar contribuicoes externas.
