# Security Policy

EduCareer is currently an MVP with a local demo fallback and optional Supabase integration.

## Secrets

Do not commit `.env`, `.env.local`, Supabase service role keys, production credentials, or exported database data with personal information.

Only variables prefixed with `VITE_` are exposed to the browser. Never put a service role key in a `VITE_` variable.

## Demo authentication

The local fallback seeds a demo admin account only while running the Vite development server. Production builds must use Supabase Auth for administrative access.

## Recommended production controls

- Use Supabase Auth for all real users.
- Keep Row Level Security enabled.
- Deploy `supabase/functions/admin-create-user` only with server-side Supabase secrets.
- Rotate any credential that may have been shared during testing.
