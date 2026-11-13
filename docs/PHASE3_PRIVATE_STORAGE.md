# Phase 3 — Private clinical attachments: policy foundation

**Date:** 2026-11-13 · ChatGPT-owned · **Database policy applied; bucket creation and live Storage API tests pending**.

## Changes actually applied

Connected Supabase project `lgimhirgvresvbsdugac` has additive migration `20261113100958_phase3_clinical_storage_policies.sql`, recorded both in managed Supabase migration history and this repository. Prior four migrations remain unchanged.

The migration installs **exactly two** authenticated-only RLS policies on `storage.objects` for bucket ID `clinical-attachments`. No general `anon` access, broad allow-all policy, client UPDATE/DELETE, object overwrite, or shared-public bucket was created. Files are **not yet uploaded** and there is **no bucket at this checkpoint**. No storage metadata was inserted with raw SQL (Supabase Storage metadata is managed by the Storage service).

Supported object-key shape:

```text
clinical-attachments/
  pets/<existing-pet-uuid>/owners/<verified-auth-user-uuid>/<random-uuid>.pdf
  pets/<existing-pet-uuid>/clinic/<random-uuid>.pdf
```

- Owner: only a **verified, non-anonymous, active** Auth user with a pet under their own `public.owners` may upload or download their own `owners/<auth-uuid>/` keys.
- Veterinarian/administrator: existing, active trusted staff memberships may upload objects under `clinic/` for an existing patient; staff may read all clinical attachments for existing patients. Receptionist may read documents for an existing patient, but cannot upload to `clinic/`.
- Owners do **not** read `clinic/` notes through Storage by default. Staff can inspect owner uploads when authorized.
- Uploads must use valid UUID filenames with `.pdf`, `.png`, `.jpg`, or `.jpeg`. Prefer random `crypto.randomUUID()` filename for collision prevention; never include patient names, phone numbers or other PII in object keys.
- No ordinary client overwrite, delete or rename. Deliberate corrections/removals require a future authorized and audited server-side workflow.

**Mandatory operational caveat:** A **public** bucket would bypass private download controls even if the policies are correct. Never mark `clinical-attachments` public.

## Verified vs unverified

**Verified by linked Supabase SQL**: migration `20261113100958` applied and stored; storage.objects RLS enabled, exactly two policy rows with intended commands and authenticated role, no anon/UPDATE/DELETE policies, correct Storage path helper parsing; at initial check 0 buckets, 0 stored object metadata. `supabase/tests/phase3_storage_policy_verify.sql` passed as read-only query. Security advisor unchanged: INFO for locked private legacy ID map; WARN for leaked password protection disabled (Pro-only; do not upgrade). No actual patient data or storage objects were created.

**Not verified**: Real authenticated Storage API upload/list/download, malicious cross-owner access, bucket-level MIME/size enforcement, file content scanning or server-side delete audit. Do not treat structural SQL tests as proof of live file security. Files are not yet available in `web/` UI.

## Owner-only one-time private bucket setup (no paid plan)

The connected Supabase API tools cannot create Storage buckets. Do this only when the owner approves pilot Storage with fake documents (no patient records):

1. Open [Dawney Supabase Storage](https://supabase.com/dashboard/project/lgimhirgvresvbsdugac/storage/buckets), choose **New bucket**.
2. Bucket **name / ID:** `clinical-attachments`. Choose **Private** (not Public).
3. Set **Maximum file size:** `5 MB` (5,242,880 bytes).
4. Set **Allowed MIME types:** `application/pdf`, `image/png`, `image/jpeg`. Keep this allowlist; PDFs/images may contain sensitive clinical information.
5. Save, then verify in the bucket settings that **Public access is disabled**. Verify via SQL Editor if needed:
   ```sql
   select id, public, file_size_limit, allowed_mime_types
   from storage.buckets
   where id='clinical-attachments';
   ```
   Expected one row with `public=false`, `file_size_limit<=5242880`, and only the three MIME types above.
6. Before enabling any frontend upload feature, conduct a safe Storage API test using **two real confirmed Auth accounts and two synthetic pets**, verifying owner A can upload/download their own document but cannot read owner B's; owner cannot view `clinic/`; anonymous requests fail; veterinarian authorized request succeeds. Remove disposable objects via trusted dashboard after verification. The test is **pending** and does not run in GitHub CI at this checkpoint.

**Rollback:** No bucket currently exists; policies can be disabled by applying an explicit reviewed migration dropping `clinical_attachments_read_scoped` and `clinical_attachments_insert_scoped`. Never delete real documents/buckets to roll back schema; preserve encrypted backups and object metadata.

## Constraints and future work

- Supabase Free file quota and provider pause/inactivity limits remain; zero paid services enabled.
- Sensitive file contents require a full export/backup of **Storage object bytes**, which the app-only GPG `pg_dump` helper in `docs/PHASE3_FREE_RECOVERY.md` does not cover.
- Enforce content checks and antivirus/document validation server-side before operating with real untrusted uploads. MIME extension/prefix allowlists and bucket limits alone cannot prove file safety.
- Source references: [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [policy helpers](https://supabase.com/docs/guides/storage/schema/helper-functions).
