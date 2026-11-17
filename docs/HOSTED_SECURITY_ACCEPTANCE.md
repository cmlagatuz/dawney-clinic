# Dawney — owner-gated hosted Auth/RLS/Storage acceptance (SOURCE ONLY)

**Scope:** incremental to backend source PR #66 at `2bbcbde08f3a73aa222bec2c8f3332f23b09eba2`. This source-only harness **never connects to Supabase by default**. No live SQL, staff grant, hosted Auth, Storage API, export, cleanup or deployment was run. Existing [Phase3 HTTP/Storage smoke](PHASE3_HTTP_STORAGE_SMOKE.md), [private bucket policy](PHASE3_PRIVATE_STORAGE.md), [Auth integration](PHASE2_AUTH_INTEGRATION.md) and [Phase5 staff contract](PHASE5A_STAFF_READ_CONTRACT.md) remain unchanged.

## Safety architecture

- `scripts/hosted-acceptance/acceptance.mjs` exports `runHostedAcceptance`. **Direct CLI invocation always exits 3 before networking, regardless of environment variables.** No `fetch`, HTTP library, Supabase SDK, default adapter or credentials are loaded. `transport.request` must be injected by a **separately reviewed, later approved staging-only adapter**. None is shipped here.
- Before the first injected transport call, validate a short-lived RSA-SHA256 **owner-signed approval record**, an independently pinned/trusted owner public-key fingerprint, exact reviewed source SHA, explicit synthetic-write permission, unique run marker and staging origin. The approval record is not the trust anchor. In CI, ephemeral mock signing keys exercise this boundary; **CI approval signatures are not valid operator authorizations**.
- Refuse the known existing Dawney project `lgimhirgvresvbsdugac` (treated as protected regardless of release stage), wrong `productionRef`, any non-`https://<20-character-project-ref>.supabase.co` origin, expired approval, unsigned approval or any source-head mismatch. Approval must attest a verified **separate disposable staging project**; a different URL alone is not proof of physical isolation, so the operator must verify the distinct project ID/dashboard and capture signed approval evidence.
- Client requests require only `sb_publishable_…`, never `service_role`, `sb_secret_`, DB passwords, admin keys or Auth JWT signing secrets. Only whitelisted Auth/JWKS/owner/pet/staff-membership/appointment, booking RPC, and private Storage operations are representable by the interface; no signup, bulk reads, delete, custom SQL, bucket creation or staff bootstrap.
- Signed JWT verification uses an **asymmetric RS256 JWKS fetched via the injected staging transport** and independently calls `/auth/v1/user` to confirm server-side identity. Invalid JWT signature, issuer/audience/subject, expiry, unsigned/HS256 tokens, unconfirmed users, anonymous flags or revoked staff fail closed. For a staging project configured with a different signing algorithm (e.g., ES256), this harness **stops** until a separately reviewed verifier supports it. Do not request/export JWT signing secrets.
- Negative results accept 401/403 (and empty RLS-filtered SELECT where appropriate), not a generic HTTP 500 or missing application table. Any leaked private row, successful forbidden write or checksum mismatch is a release **NO-GO**. External transport exceptions are redacted; tokens/passwords/email addresses/private bytes are never logged by this code.
- Any future hosted run will make deliberate synthetic bookings and private file uploads **only in approved staging**. It produces an in-memory cleanup manifest; cleanup must be separately authorized, manually reviewed and completed using staging-only provider APIs, never by deleting Storage metadata with SQL.

## Source test matrix (injected mock only)

| Actors | Contract assertions |
| --- | --- |
| Confirmed owner A and confirmed owner B | Signed JWKS/Auth user match, own profile and pet, cross-owner SELECT denied, own booking persisted as `requested`, same nonce exact retry returns same UUID |
| Anonymous API actor and anonymous Auth actor | No owner/pet/appointment rows, cannot execute booking RPC or download private object |
| Active veterinarian | Verified membership is active, may read both synthetic bookings and owner documents, may upload/read clinic-path synthetic PDF |
| Revoked veterinarian | Membership explicitly inactive, no queue or private object access, no clinic-path upload |
| Owner booking actor | Tampered replay rejected, unrelated owner's pet booking denied, concurrent same-resource slot rejected with `23P01`, forged `confirmed` transition denied, status remains requested |
| Private Storage | 3 generated synthetic PDF paths only; own upload/download byte-for-byte SHA-256, owner A/B cross-read and cross-upload denied, anonymous/public GET denied, owner clinic-path upload/read denied, malformed extension rejected |
| Guards | Deny protected project, invalid attestation/fingerprint, missing adapter, expired/scope drift, JWT forgery/expiry, wrong staging host, service key, bad fixtures; **zero transport calls before approval** |

Existing [PR #66 PostgreSQL 17 CI](https://github.com/cmlagatuz/dawney-clinic/pull/66) independently covers migration/constraint/RLS on actual disposable Postgres SQL; these mocked HTTP tests are **contract simulations**, not proof of provider HTTP enforcement.

## Owner/operator prerequisites BEFORE a future, separately authorized staging run

1. **Owner and Project Manager:** create or designate a second **disposable Supabase Free project** with a distinct project ref, database, API hostname and Auth user pool. Cross-check its exact ref in *both* provider dashboard/project settings and the signed acceptance approval. Confirm project `lgimhirgvresvbsdugac` is explicitly excluded. Do not turn on paid features.
2. **Independent reviewer:** approve PR #66 backend source and additive Storage policy, and separately review any proposed network transport. Freeze the staging commit and migration versions. Run a reviewed owner-approved source rollout only in the new staging project; this harness itself applies **no SQL**.
3. **Staging operator (owner-approved only):** provision **two newly confirmed synthetic owners**, their distinct synthetic pets/profiles, an active verified veterinarian, a **pre-revoked** veterinarian, and a disposable anonymous Auth actor. Create a private bucket `clinical-attachments` (`public=false`, max 5 MB, MIME only PDF/PNG/JPEG). Explicitly approve synthetic staging-only service, species eligibility, one resource and two future booking slots; check both are safe and unoccupied. **Never use real patients, production staff, patient attachments, or live clinic operating hours.** Staging bootstrap is outside the harness and still requires separate human authorization.
4. **Owner approval:** provide a *short-lived (max 60-minute)* RSA-signed JSON claims record with `kind=dawney-hosted-security-acceptance-v1`, `ownerApproved=true`, `allowSyntheticWrites=true`, `environment=disposable-staging`, `verifiedSeparateProject=true`, `sourceSha=2bbcbde08f3a73aa222bec2c8f3332f23b09eba2`, `runId` (8–32 uppercase ASCII/digits/underscore/hyphen), `projectRef`, exact `origin`, numeric UTC-millisecond `notBefore` and `expiresAt`. Keep the signer private key offline; pin the trusted public-key SHA256 fingerprint through a separate approved operator channel, not from the signed message. Do **not** add real credentials or authorizations to GitHub PRs, Actions logs or ChatGPT.
5. **Separately approved transport adapter:** pass the staging publishable key, 5 **short-lived staging-only signed user access tokens** (A/B, active vet, revoked vet, anonymous Auth), synthetic owner/pet/service/resource IDs and two future approved UTC slots in memory. Transport must use TLS, restrict its base URL to the signed origin and implement only permitted method/path pairs. Never use a service-role key, browser admin tokens or user-supplied URL. This PR deliberately has **no callable live adapter**.
6. **After any later authorized execution:** securely preserve the returned in-memory synthetic appointment IDs and Storage object keys for cleanup, review any partial fixtures, then obtain separate permission to remove only tagged staging objects/rows using provider-supported audited operations. Do not automatically erase records or print identifying metadata/tokens in logs. A failed negative assertion means **STOP**.

## Run locally / CI (all OFFLINE)

```bash
node --test scripts/hosted-acceptance/tests/acceptance.test.mjs packages/clinic-auth/tests/smoke-guards.test.mjs
node --check scripts/hosted-acceptance/guards.mjs
node --check scripts/hosted-acceptance/acceptance.mjs
# Inert even when environment variables are present; exits code 3:
node scripts/hosted-acceptance/acceptance.mjs
```

The new GitHub workflow is **pull-request-only**, has no dispatch path, no secrets, no Supabase hostname, no external runner transport, and uses only injected JavaScript mocks. Its green result proves code contracts and mock denials; **hosted signed JWT, actual PostgREST RLS, private Storage API, hosted booking persistence and production security remain NOT VERIFIED**. The existing master manual smoke workflows must not be run as part of this task.
