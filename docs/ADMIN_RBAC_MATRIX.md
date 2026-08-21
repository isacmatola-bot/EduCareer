# EduCareer Administrative RBAC Matrix

## Gate 2.1 — Admin Hierarchy Hardening

This document is the operational reference for administrative hierarchy and least-privilege access. The database remains the authorization source of truth through `private.admin_role_permissions`; account-target hierarchy is enforced server-side by the administrative Edge Functions.

## Hierarchy

| Level | Role | Scope |
|---|---|---|
| 0 | `default_admin` | Root / break-glass administration |
| 1 | `ceo` | Executive administration |
| 2 | `director` | Operational executive administration |
| 3 | `it` | Department administration |
| 3 | `rh` | Department administration |
| 3 | `finance` | Department administration |
| 3 | `programs` | Department administration |
| 3 | `opportunities` | Department administration |
| 3 | `partnerships` | Department administration |
| 3 | `support` | Department administration |
| 3 | `statistics` | Department administration |

### Account-governance precedence

- `default_admin` can govern CEO, Director, department admins, graduates and partners, but never another `default_admin`.
- `ceo` can govern Director, department admins, graduates and partners; it cannot govern another CEO or the root account.
- `director` can govern department admins, graduates and partners; it cannot govern CEO, another Director or the root account.
- `it` and `support` can maintain graduate/partner accounts only. They cannot modify any administrative account.
- Other department roles have no account-management authority.
- No role can create, promote, or assign `default_admin`. The database additionally enforces one `default_admin` profile through a partial unique index.
- All administrative authorization requires an active account, completed mandatory password change and AAL2 MFA.

## Permission matrix

Legend: **R** = scoped read, **M** = manage/write, **A** = aggregate only, **—** = no access.

| Domain | Root | CEO | Director | IT | RH | Finance | Programs | Opportunities | Partnerships | Support | Statistics |
|---|---|---|---|---|---|---|---|---|---|---|---|
| All account profiles | R/M | R/M | R/M | — | — | — | — | — | — | — | — |
| Graduate/Partner accounts | R/M | R/M | R/M | R/M | — | — | — | — | — | R/M | — |
| Admin governance | M | M below CEO | M departments | — | — | — | — | — | — | — | — |
| Candidates | R/M | R/M | R/M | — | R/M | — | — | — | — | — | A |
| Partner requests | R/M | R/M | R/M | — | — | — | — | — | R/M | — | A |
| Programs | R/M | R/M | R/M | — | — | — | R/M | public only | — | — | A |
| Opportunities | R/M | R/M | R/M | — | — | — | public only | R/M | — | — | A |
| Applications | R/M | R/M | R/M | — | R/M | — | — | R/M | — | — | A |
| Placements | R/M | R/M | R/M | — | R/M | — | — | R/M | — | — | A |
| Finance | R | R | R | — | — | R | — | — | — | — | A |
| Audit log | R | R | R | — | — | — | — | — | — | — | — |
| Statistics | A | A | A | — | — | — | — | — | — | — | A |

`finance.read` and `statistics.read_aggregate` are capability reservations for their dedicated modules. They do not grant raw access to profiles, candidates, applications or partner records.

## Canonical permissions

- `accounts.read_all`
- `accounts.read_users`
- `accounts.maintain`
- `accounts.govern`
- `accounts.create_admin`
- `accounts.delete`
- `candidates.read`
- `candidates.manage`
- `partner_requests.read`
- `partner_requests.manage`
- `programs.read`
- `programs.manage`
- `opportunities.read`
- `opportunities.manage`
- `applications.read`
- `applications.manage`
- `placements.read`
- `placements.manage`
- `audit.read`
- `finance.read`
- `statistics.read_aggregate`

## Security invariants

1. UI visibility is not an authorization boundary; Edge Functions and RLS must independently reject forbidden actions.
2. `default_admin` is a protected break-glass identity and must remain unique.
3. Department administrators must never manage executive administrators.
4. Raw personal records must be readable only by the operational domain responsible for them.
5. Finance and Statistics must not gain raw personal-data access merely because their account role is `admin`.
6. Every privileged permission path requires MFA AAL2.
7. RLS controls row authorization while PostgreSQL grants control Data API object reachability.
