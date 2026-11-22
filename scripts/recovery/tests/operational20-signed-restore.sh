#!/usr/bin/env bash
# Synthetic-only PostgreSQL17 operational #1-#20 signed/encrypted recovery.
# Requires the CI workflow to have applied the exact schema and test fixtures.
# NO hosted Supabase, patient records, external storage or production actions.
set -Eeuo pipefail
fail(){ echo "OPS20_RESTORE_FAIL: $*" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == true &&
   "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic &&
   "${PGDATABASE:-}" == operational20_ci &&
   "${PGHOST:-}" == 127.0.0.1 &&
   "${PGPORT:-}" == 5432 ]] || fail 'not disposable official PG17 PR environment'
for cmd in docker openssl gpg psql sha256sum cmp;do command -v "$cmd" >/dev/null || fail "missing $cmd";done
container="$(docker ps --filter ancestor=postgres:17 --format '{{.ID}}' | head -n 1)"
[[ -n "$container" ]] || fail 'no disposable postgres:17 service'
test "$(docker exec "$container" psql -XAt -U postgres -d operational20_ci -c 'show server_version_num')" -ge 170000 ||
 fail 'not PostgreSQL17'
tmp="$(mktemp -d)"
chmod 700 "$tmp";trap 'rm -rf "$tmp"' EXIT

# Every migration is SOURCE-ONLY; verify ordered exact count, including #20.
mapfile -t migrations < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)
[[ "${#migrations[@]}" == 20 ]] || fail 'migration chain is not exactly 20 ordered files'
[[ "${migrations[17]}" == supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql &&
   "${migrations[18]}" == supabase/migrations/20261121202000_inventory_transactional_branch_ops.sql &&
   "${migrations[19]}" == supabase/migrations/20261122120000_operational_live_session_read_guard.sql ]] ||
 fail 'operations migrations not in exact #18/#19/#20 order'
sha256sum "${migrations[@]}" > "$tmp/source.migrations"
test "$(wc -l < "$tmp/source.migrations")" = 20 || fail 'incomplete migration SHA256 manifest'
for role in anon authenticated;do
 test "$(psql -XqAt -v ON_ERROR_STOP=1 -c "select count(*) from pg_roles where rolname='$role'")" = 1 ||
  fail "missing required shared browser role $role"
done
# pg_dump preserves RLS, ACLs, triggers, SECURITY DEFINER routines and data.
authority(){ psql -XqAt -v ON_ERROR_STOP=1 -d "$1" \
 -f scripts/recovery/tests/clinical17-security-fingerprint.sql; }
actors(){ psql -XqAt -v ON_ERROR_STOP=1 -d "$1" \
 -f scripts/recovery/tests/operational20-restored-authz.sql; }
data_digest(){
 psql -XqAt -v ON_ERROR_STOP=1 -d "$1" <<'DATA'
with rows as (
 select 'auth_user' k,to_jsonb(t)::text j from auth.users t
 union all select 'auth_session',to_jsonb(t)::text from auth.sessions t
 union all select 'staff_global',to_jsonb(t)::text from public.staff_memberships t
 union all select 'staff_branch',to_jsonb(t)::text from public.staff_branch_memberships t
 union all select 'staff_request',to_jsonb(t)::text from public.staff_access_requests t
 union all select 'staff_audit',to_jsonb(t)::text from clinic_private.staff_operation_events t
 union all select 'staff_review_receipt',to_jsonb(t)::text from clinic_private.staff_review_receipts t
 union all select 'stock_receipt',to_jsonb(t)::text from clinic_private.inventory_write_receipts t
 union all select 'catalog',to_jsonb(t)::text from public.medicine_catalog t
 union all select 'branch_rule',to_jsonb(t)::text from public.branch_medicine_rules t
 union all select 'batch',to_jsonb(t)::text from public.branch_stock_batches t
 union all select 'movement',to_jsonb(t)::text from public.stock_movements t
 union all select 'pet',to_jsonb(t)::text from public.pets t
 union all select 'appointment',to_jsonb(t)::text from public.appointments t
 union all select 'clinical',to_jsonb(t)::text from public.clinical_records t
 union all select 'draft',to_jsonb(t)::text from public.clinical_encounter_drafts t
 union all select 'draft_audit',to_jsonb(t)::text from clinic_private.clinical_draft_audit t
 union all select 'draft_receipts',to_jsonb(t)::text from clinic_private.clinical_draft_requests t
 union all select 'clinical_provenance',to_jsonb(t)::text from clinic_private.clinical_record_provenance t
)
select pg_catalog.md5(coalesce(pg_catalog.string_agg(k||':'||j,E'\n' order by k,j),''))
 from rows;
DATA
}
actors operational20_ci > "$tmp/source.actors"
grep -q 'PASS: preserved approvals' "$tmp/source.actors" || fail 'pre-dump real actor/nonce acceptance missing'
data_digest operational20_ci > "$tmp/source.data"
authority operational20_ci > "$tmp/source.authority"
for routine in clinic_private.operational_read_session_live clinic_private.require_operational_actor \
 public.review_staff_access public.receive_branch_inventory_stock;do
 grep -Fq "$(printf 'routine\t%s(' "$routine")" "$tmp/source.authority" ||
  fail "source fingerprint missing $routine"
done

# Archive is produced and restored by the SAME disposable PostgreSQL17 service.
docker exec "$container" pg_dump -Fc -U postgres -d operational20_ci > "$tmp/source.dump"
test -s "$tmp/source.dump" || fail 'empty PG17 archive'
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/key" >/dev/null 2>&1
openssl pkey -in "$tmp/key" -pubout -out "$tmp/pub" >/dev/null 2>&1
gpg --batch --yes --pinentry-mode loopback --passphrase ci-only-ops20-synthetic \
 --symmetric --cipher-algo AES256 --output "$tmp/archive.enc" "$tmp/source.dump"
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/archive.sig" "$tmp/archive.enc"
cat "$tmp/source.migrations" "$tmp/source.data" "$tmp/source.authority" > "$tmp/manifest"
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/manifest.sig" "$tmp/manifest"
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/archive.sig" "$tmp/archive.enc" >/dev/null
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/manifest.sig" "$tmp/manifest" >/dev/null

cp "$tmp/archive.enc" "$tmp/tampered.enc";printf 'TAMPER' >> "$tmp/tampered.enc"
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/archive.sig" "$tmp/tampered.enc" >/dev/null 2>&1;then
 fail 'tampered signed ciphertext accepted'
fi
cp "$tmp/manifest" "$tmp/tampered.manifest";printf 'TAMPER' >> "$tmp/tampered.manifest"
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/manifest.sig" "$tmp/tampered.manifest" >/dev/null 2>&1;then
 fail 'tampered source/authority manifest accepted'
fi
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/missing.sig" "$tmp/archive.enc" >/dev/null 2>&1;then
 fail 'missing signature accepted'
fi
echo 'PASS: signed/encrypted PG17 archive and complete #1-#20 SHA256/source authority manifest; tamper/missing signature fail closed'

gpg --batch --yes --pinentry-mode loopback --passphrase ci-only-ops20-synthetic \
 --decrypt --output "$tmp/decrypted.dump" "$tmp/archive.enc" >/dev/null 2>&1
cmp "$tmp/decrypted.dump" "$tmp/source.dump" || fail 'archive changed after decryption'
docker exec "$container" createdb -U postgres operational20_restored
# Preserve ACLs. Explicitly DO NOT use --no-acl or silently weaken policy.
docker exec -i "$container" pg_restore -U postgres --no-owner --exit-on-error \
 --single-transaction -d operational20_restored < "$tmp/decrypted.dump"
data_digest operational20_restored > "$tmp/restored.data"
cmp "$tmp/source.data" "$tmp/restored.data" || fail 'restored auth/staff/stock/clinical rows differ'
authority operational20_restored > "$tmp/restored.authority"
cmp "$tmp/source.authority" "$tmp/restored.authority" || fail 'restored ACL/RLS/trigger/routine body differs'
actors operational20_restored > "$tmp/restored.actors"
cmp "$tmp/source.actors" "$tmp/restored.actors" || fail 'restored review/nonce/branch actor semantics differ'
data_digest operational20_restored > "$tmp/replayed.data"
cmp "$tmp/source.data" "$tmp/replayed.data" || fail 'idempotency/denial suite mutated restored stock or audit'

# Negative: --no-acl must NOT be accepted as equivalent.
docker exec "$container" createdb -U postgres operational20_noacl
docker exec -i "$container" pg_restore -U postgres --no-owner --no-acl \
 --exit-on-error --single-transaction -d operational20_noacl < "$tmp/decrypted.dump"
authority operational20_noacl > "$tmp/noacl.authority"
if cmp -s "$tmp/source.authority" "$tmp/noacl.authority";then
 fail '--no-acl restore falsely accepted as equivalent'
fi
echo 'PASS: no-ACL restore explicitly detected as unsafe'
# Negative: a privileged routine redefinition with unchanged ACL/search_path
# MUST change the SQL body SHA256 captured by the source authority manifest.
{
 printf 'BEGIN;\n'
 cat <<'BROKEN'
create or replace function clinic_private.operational_read_session_live()
 returns boolean language plpgsql stable security definer set search_path=''
 as $broken$ begin return true; end $broken$;
BROKEN
 cat scripts/recovery/tests/clinical17-security-fingerprint.sql
 printf 'ROLLBACK;\n'
} | psql -XqAt -v ON_ERROR_STOP=1 -d operational20_restored > "$tmp/body-tampered.authority"
if cmp -s "$tmp/source.authority" "$tmp/body-tampered.authority";then
 fail 'malicious definer body passed exact source authority fingerprints'
fi
authority operational20_restored > "$tmp/unchanged.authority"
cmp "$tmp/source.authority" "$tmp/unchanged.authority" || fail 'corruption probe was not rolled back'
# Replay signed archive a SECOND time in a distinct disposable database.
docker exec "$container" createdb -U postgres operational20_second
docker exec -i "$container" pg_restore -U postgres --no-owner --exit-on-error \
 --single-transaction -d operational20_second < "$tmp/decrypted.dump"
data_digest operational20_second > "$tmp/second.data"
cmp "$tmp/source.data" "$tmp/second.data" || fail 'second restore changed operational rows'
authority operational20_second > "$tmp/second.authority"
cmp "$tmp/source.authority" "$tmp/second.authority" || fail 'second restore lost ACL/routines'
actors operational20_second > "$tmp/second.actors"
cmp "$tmp/source.actors" "$tmp/second.actors" || fail 'second restore actor replay failed'
data_digest operational20_second > "$tmp/second-after.data"
cmp "$tmp/source.data" "$tmp/second-after.data" || fail 'second replay changed balance'
echo 'PASS: signed AES256 PG17 restore twice; original/restored authority, ACL, function body, clinical history, active/revoked/accountant, staff events/receipts, stock/nonce data and actor behavior IDENTICAL'
echo 'NOT VERIFIED: hosted/provider Auth session schema, JWT signatures, real Supabase restore/Storage bytes or clinic data'
