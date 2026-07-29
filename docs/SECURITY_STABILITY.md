# EduCareer security and stability baseline

Last reviewed: 2026-07-29

## Scope

This baseline covers the Supabase database and Edge Functions, the Vercel web
deployment, and GitHub Actions. It must be rerun after database migrations,
authentication changes, or deployment configuration changes.

## Canonical database automation

| Object | Purpose | Direct API execution |
| --- | --- | --- |
| `public.handle_new_user()` | Creates the profile and Graduate/Partner registration record after an Auth insert | Revoked from `PUBLIC`, `anon`, and `authenticated` |
| `on_auth_user_created` on `auth.users` | The only registration trigger | Not applicable |
| `public.touch_updated_at()` | Maintains `updated_at` on application tables | Revoked from `PUBLIC`, `anon`, and `authenticated` |
| `public.sync_profile_auth_user_id()` | Keeps legacy `profiles.auth_user_id` aligned | Revoked from `PUBLIC`, `anon`, and `authenticated` |
| `public.current_user_is_admin()` | RLS authorization helper | `authenticated` only |
| `public.current_user_is_default_admin()` | RLS default-admin helper | `authenticated` only |
| `public.current_user_can_manage_operations()` | RLS operational-admin helper | `authenticated` only |
| `public.get_login_email(text)` | Resolves the existing username-login flow | `anon` and `authenticated`; deliberately narrow result |

`public.handle_new_educareer_user()` and `public.rls_auto_enable()` are legacy
objects. The hardening migration removes them only when the database confirms
that they have no table trigger, event trigger, or extension dependency.

## Edge Function CORS

`admin-create-user` and `admin-manage-user` allow `POST` and `OPTIONS` from the
single origin in `EDUCAREER_ALLOWED_ORIGIN`. If the secret is absent, the
production origin is `https://edu-career-chi.vercel.app`. Preview deployments
must receive an explicit approved origin; wildcard CORS is prohibited.

## Web response headers

Vercel applies CSP, frame protection, MIME sniffing protection, a restricted
permissions policy, and a strict referrer policy to all routes. The CSP permits
network connections only to the EduCareer Supabase project and the same origin.

## Continuous integration

Every pull request and every push to `main` must complete:

1. `npm ci`
2. `npm audit --audit-level=high`
3. `npm run typecheck`
4. `npm test -- --run`
5. `npm run build`

## Production verification

Run `supabase/audit.sql`, then confirm:

- exactly one `auth.users` trigger invokes `public.handle_new_user()`;
- no legacy EduCareer registration or RLS event function remains;
- trigger functions have no direct client `EXECUTE`;
- all application tables have RLS enabled and only the documented policies;
- Supabase Security Advisor has no unexplained warning;
- Graduate and Partner registration each create one Auth user, one profile, and
  one role-specific request record;
- deleting the test Auth user removes every associated application row.
