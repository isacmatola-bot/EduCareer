# EduCareer controlled beta plan

## Objective

Validate the complete journey from account registration to placement with a small, consented cohort before opening the platform broadly.

## Cohort and duration

- 10–20 graduates, 3–5 partners and the internal administrative team.
- Four weeks, using only participants who explicitly consent to beta processing.
- Do not import production data from spreadsheets without confirming ownership, purpose and retention.

## Entry criteria

- CI, E2E tests and production health check are green.
- Supabase RLS and Security Advisor reviewed.
- Named incident owner and support contact available.
- Backup/rollback procedure rehearsed once with non-production data.

## Metrics

| Metric | Target |
| --- | --- |
| Successful registrations | >= 95% |
| Successful sign-ins | >= 98% |
| Account administration actions | >= 98% |
| Opportunity applications completed | >= 90% |
| P1 incidents | 0 |
| Support response during beta | < 1 business day |
| Participants completing feedback | >= 60% |

Record weekly totals only; do not place passwords, tokens, health details or free-form personal data in GitHub issues.

## Weekly review

1. Review Vercel runtime errors and the production uptime workflow.
2. Review Supabase Auth, Edge Function and Postgres logs.
3. Count funnel transitions: registration, activation, application and placement.
4. Classify feedback as blocker, important or enhancement.
5. Decide continue, pause or rollback.

## Exit criteria

- Two consecutive weeks without a P1 incident.
- All critical flows pass E2E and manual acceptance.
- At least one consented end-to-end placement journey completed.
- No unresolved security warning except explicitly accepted subscription limitations.
- Support and incident runbooks have named owners.

Real-user invitations and outreach require product-owner approval and are intentionally outside automated deployment work.
