# OSA JEFF READY P0 — Architecture & Release Gate

**Status:** implementation branch only. NOT production-ready until a dedicated EU PostgreSQL
instance, Google OAuth credentials, Preview secret scopes, applied migrations and live
cross-account E2E checks are approved and verified.

## Scope lock

- TARGET: HazEOskA/Osa-jev.
- BASE_SHA: b1c71147d5524c2be32308e427a7be7aa275ba54.
- BRANCH: feature/osa-jeff-ready-p0.
- No changes to Production, merge, unrelated repos or existing NeurOSA deployment.
- Existing GLM 5.3 Experiential Labs streaming is retained.
- Polish UI only. NeurOSA is P1 and not implemented in P0.

## Functional contract

1. Google OAuth is required for access to the chat interface and all chat APIs.
2. Exactly two verified Google addresses must be explicitly allowlisted at runtime.
3. The verified Google subject (sub) binds permanently to an allowlisted email
   on first login, enforced by a unique database email constraint.
4. Auth.js issues an encrypted HTTP-only session cookie. Each API request independently
   checks that the user is still enabled in the database (revocation).
5. All conversations, messages, turns and BYOK secrets are owned by user ID.
   Every database transaction sets app.user_id; FORCE RLS provides a second boundary.
6. GLM context comes from trusted PostgreSQL records, not submitted browser history.
7. Complete GLM messages are stored before the server sends SSE [DONE].
   Failed or interrupted messages do not claim success or APR verification.
8. BYOK keys use AES-256-GCM with identity-bound additional authenticated data;
   routing BYOK into model providers is not included in P0.

## Infrastructure prerequisites (NOT provisioned)

A dedicated EU-hosted PostgreSQL 17 instance is required, preferably in AWS Frankfurt
(aws-eu-central-1). The existing connected Neon project resides in the USA; its
Vercel-managed organization rejected direct project creation. No AWS CLI was detected
on the connected OSA Windows host.

The proposed migration is at db/migrations/001_osa_jeff_ready_p0.sql and HAS NOT
BEEN RUN. Creating a database or applying the migration requires separate approval.

Provisioning and database hardening must verify:

- EU data location, TLS certificate validation (sslmode=verify-full), credentials only on backend.
- App role separate from migration owner, with NOBYPASSRLS and NOSUPERUSER.
- Explicit schema USAGE plus the minimum DML grants for the five P0 tables.
- App role must not own the tables or have superuser privileges.
- Verified backup/PITR window, consumption/cost limits and tested restore.
- Separate staging data and Production data if Production is later approved.

RLS cannot protect against a PostgreSQL superuser or BYPASSRLS principal.

## Google OAuth prerequisites (NOT provisioned)

Create an approved Google OAuth 2.0 web application client, scopes openid email profile.
Production redirect URI:
https://osa-jev.vercel.app/api/auth/callback/google

The Preview redirect URI must exactly match a known, verified Preview hostname; it
must be registered separately. No credentials or user email addresses belong in git.

## Preview-only server variables

See .env.osa-jeff.example (placeholder file, no real secrets).

AUTH_SECRET: 32+ cryptographically random characters.
AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET: Google web OAuth credentials.
OSA_JEFF_ALLOWED_EMAILS: exactly two explicitly approved, verified Google emails.
DATABASE_URL: EU PostgreSQL URL with TLS and least-privilege role.
OSA_JEFF_MASTER_KEY: 32 cryptographically random bytes, base64.
EXPLABS_API_KEY: existing server-only provider key.
EXPLABS_MODEL: optional provider-side override.

Existing Production JEFF_CHAT_ACCESS_TOKEN is untouched by P0; the new Preview chat
API checks the authenticated Google session rather than a browser bearer token.

## Gate table

| Gate | Proof expected | Status before live Preview |
| --- | --- | --- |
| BASE_SHA and branch | Local HEAD verified on authorized commit | PASS |
| Type check | npm run build includes tsc --noEmit | PASS |
| Offline tests | 39/39 passed | PASS |
| Next build | Next.js 16.4.6, route table generated | PASS |
| Dependency audit | 0 vulnerabilities | PASS |
| Local no-config smoke | GET / 200; protected API GET 503 | PASS (fail-closed) |
| EU database | Project ID and region | BLOCKED |
| SQL migration and actual RLS | DB query and 2-user tests | UNKNOWN |
| Google OAuth and exact redirect | Provider configuration | UNKNOWN |
| Google sign-in, sign-out, session restore | Live E2E | UNKNOWN |
| OSA vs Arek access boundary | Live E2E negative tests | UNKNOWN |
| History survives server restart | Live E2E | UNKNOWN |
| GLM 5.3 provider works with database | Live Preview SSE | UNKNOWN |
| Production release | Separate approval | NOT AUTHORIZED |

## Rollback

Branch-only changes do not alter Production. Preview failures must not be promoted.
Never delete the existing Neon, Railway or AWS projects as an automatic rollback.
Migrations require an approved consistent database backup and restore procedure.
NeurOSA remains independent and unchanged.

## Evidence rules

CLAIM is not PROOF; EXECUTION is not OUTCOME. Code tests and mocked SSE do not prove
that Google OAuth, database RLS, two real accounts, live provider streaming or NeurOSA
work in production.
