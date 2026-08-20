# EduCareer operations runbook

## Service map

- Web and telemetry: Vercel project `edu-career`.
- Authentication, database and Edge Functions: Supabase project `gobstyayacemoholsiwe`.
- Source and CI: `isacmatola-bot/EduCareer`.
- Health endpoint: `https://edu-career-chi.vercel.app/api/health`.

## Severity

| Severity | Example | Initial response |
| --- | --- | --- |
| P1 | Login, registration or database unavailable for all users | 15 minutes |
| P2 | One administrative workflow broken | 4 hours |
| P3 | Cosmetic or low-impact defect | Next planning cycle |

## Incident response

1. Acknowledge the GitHub uptime incident or user report.
2. Record start time, affected route and last known good deployment; never paste credentials or personal data.
3. Check Vercel deployment state/runtime errors and Supabase Auth, API, Edge Function and Postgres logs.
4. If the latest web release caused the failure, roll back to the last known good Vercel deployment.
5. If a database migration caused the failure, stop writes where practical and use a reviewed forward-fix migration. Do not edit migration history.
6. Verify homepage, `/api/health`, login and the affected workflow.
7. Close with timeline, cause, impact and prevention action.

## Vercel rollback

Use the Vercel dashboard deployment history or:

```bash
vercel rollback <known-good-deployment-id>
```

After rollback, verify the production alias, HTTP 200, security headers and runtime errors. A rollback changes code only; it does not reverse Supabase data changes.

## Supabase backup and recovery

### GitHub, Supabase and Vercel synchronization

- GitHub `main` is the source of truth. Never create production DDL directly in the Supabase SQL editor during normal work.
- Every database change starts with `supabase migration new <descriptive-name>` and is reviewed in a pull request.
- CI rejects migration filenames that do not use a unique 14-digit UTC version.
- After a migration or Edge Function reaches `main`, `Supabase production sync` links project `gobstyayacemoholsiwe`, performs a dry run, applies only pending migrations and deploys all versioned Edge Functions.
- Vercel's Git integration deploys the same `main` commit. Database changes must remain backward-compatible while the web deployment is in progress.
- Configure the GitHub `production` environment with `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. Require environment approval if the repository plan supports it.
- Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Production, Preview and Development environments; never add a service-role key to Vercel.
- For an emergency dashboard change, capture it immediately with `supabase db pull <descriptive-name>` and open a reconciliation pull request before any further deployment.

- Confirm the project plan's managed backup/PITR retention in the Supabase dashboard before beta launch.
- Before a risky migration, create a logical backup with the current Supabase CLI following the official backup guide.
- Store backups encrypted with restricted access and a documented deletion date.
- Test restore only in an isolated project or branch; never overwrite production as a test.
- Prefer forward-only corrective migrations after production schema changes.

Minimum quarterly exercise:

1. Export schema and data to an encrypted location.
2. Restore into an isolated Supabase project/branch.
3. Verify Auth/profile reconciliation and row counts.
4. Run Security and Performance Advisors.
5. Record duration, gaps and corrective actions without copying personal data into GitHub.

## Post-incident verification

```bash
npm ci
npm audit --audit-level=high
npm test -- --run
npm run test:e2e
npm run typecheck
npm run build
```

Then check Supabase Advisors and Vercel runtime errors for the affected period.
