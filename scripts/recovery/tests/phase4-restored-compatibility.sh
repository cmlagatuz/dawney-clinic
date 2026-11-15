#!/usr/bin/env bash
# PR49 disposable-only compatibility gate. Expected result: schema BLOCKER.
# Never run this on a hosted PostgreSQL server or real clinical records.
set -Eeuo pipefail
umask 077
[[ "$GITHUB_ACTIONS" == true && "$PGHOST" == "127.0.0.1" && "$PGPORT" == 5432 ]] ||
  { echo 'Refused non-CI or non-local PostgreSQL target' >&2; exit 1; }
[[ "$#" == 1 && -d "$1" ]] || { echo 'Expected pinned migration directory' >&2; exit 1; }
for cmd in docker git mktemp sha256sum grep; do
  command -v "$cmd" >/dev/null || { echo "Missing executable $cmd" >&2; exit 1; }
done
source_dir=$1
# Four exact file blobs, in the reviewed PR52 migration sequence.
while read -r file blob; do
  [[ -s "$source_dir/$file" ]] || { echo "BLOCKED: migration missing or empty: $file" >&2; exit 1; }
  [[ "$(git hash-object "$source_dir/$file")" == "$blob" ]] ||
    { echo "BLOCKED: migration file checksum drift: $file" >&2; exit 1; }
done <<'BLOBS'
20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035
20261114090000_phase4_public_booking_contract.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c
BLOBS
work=$(mktemp -d "$RUNNER_TEMP/phase4-restored-compat.XXXXXXXX")
export PGUSER=postgres PGSSLMODE=disable PGPASSFILE="$work/.pgpass"
printf '%s\n' '127.0.0.1:5432:*:postgres:dawney-ci-only' > "$PGPASSFILE"
chmod 600 "$PGPASSFILE"
pgclient() {
 docker run --rm -i --network host -v "$work:$work:ro" \
  -e PGHOST -e PGPORT -e PGUSER -e PGPASSFILE -e PGSSLMODE postgres:17 "$@"
}
cleanup() {
 pgclient psql -X -v ON_ERROR_STOP=1 -d postgres \
  -c 'drop database if exists recovery_phase4_probe with (force)' >/dev/null 2>&1 || true
 rm -rf -- "$work"
}
trap cleanup EXIT

# PR49's previous step has already verified signature, five encrypted component
# hashes, restored data relations, and byte-for-byte SHA256 of BOTH private objects.
# Repeat strict SQL integrity before any Phase4 probe.
cat <<'SQL' | pgclient psql -X -v ON_ERROR_STOP=1 -d recovery_restored >/dev/null
do $integrity$
begin
 if (select count(*) from auth.users)<>2
  or (select count(*) from auth.identities)<>2
  or (select count(*) from public.owners)<>2
  or (select count(*) from public.pets)<>2
  or (select count(*) from auth.identities i
       join auth.users u on u.id=i.user_id
       join public.owners o on o.user_id=u.id
       join public.pets p on p.owner_id=o.id)<>2 then
  raise exception 'Auth identity-owner-patient link damaged';
 end if;
 if not exists(select 1 from public.pets p
   join public.owners o on o.id=p.owner_id
   where p.id='33333333-3333-4333-8333-333333333333'
    and p.name='Synthetic Chow' and p.species='Dog' and p.breed='Chow Chow'
    and o.user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
  raise exception 'Recovered Chow Chow patient missing or changed';
 end if;
 if (select count(*) from public.appointments a
    join public.pets p on p.id=a.pet_id and p.owner_id=a.owner_id
    where a.id='55555555-5555-4555-8555-555555555555'
    and p.id='33333333-3333-4333-8333-333333333333'
    and a.status='requested'
    and a.concern='CI appointment remains requested')<>1 then
  raise exception 'Historical requested appointment invalid';
 end if;
 if (select count(*) from storage.buckets
    where id='clinical-attachments' and public=false)<>1
    or (select count(*) from storage.objects obj
      join public.pets p on obj.name like
        ('pets/'||p.id::text||'/owners/%')
      join public.owners o on o.id=p.owner_id
      where obj.bucket_id='clinical-attachments'
       and obj.name like ('pets/'||p.id::text||'/owners/'||o.user_id::text||'/%')
       and obj.metadata->>'sha256' ~ '^[a-f0-9]{64}$'
       and (obj.metadata->>'size')::integer>0)<>2 then
  raise exception 'Storage private object owner path, metadata or SHA256 invalid';
 end if;
 if (select count(*) from clinic_private.recovery_history
    where version='synthetic-phase3')<>1 then
  raise exception 'Recovery provenance missing';
 end if;
end $integrity$;
SQL
snapshot() {
 cat <<'SQL' | pgclient psql -X -v ON_ERROR_STOP=1 -At -d recovery_restored | sha256sum | cut -d' ' -f1
select jsonb_build_object(
 'users',(select jsonb_agg(to_jsonb(t) order by id) from auth.users t),
 'identities',(select jsonb_agg(to_jsonb(t) order by id) from auth.identities t),
 'owners',(select jsonb_agg(to_jsonb(t) order by id) from public.owners t),
 'pets',(select jsonb_agg(to_jsonb(t) order by id) from public.pets t),
 'appointments',(select jsonb_agg(to_jsonb(t) order by id) from public.appointments t),
 'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t)
)::text;
SQL
}
before=$(snapshot)
pgclient psql -X -v ON_ERROR_STOP=1 -d postgres \
 -c 'create database recovery_phase4_probe template recovery_restored' >/dev/null
# Probe actual restored schema, without adding invented auth/Phase3 privileges.
gaps=$(cat <<'SQL' | pgclient psql -X -v ON_ERROR_STOP=1 -At -d recovery_phase4_probe
select concat_ws(E'\n',
 case when to_regrole('anon') is null then 'missing role: anon' end,
 case when to_regrole('authenticated') is null then 'missing role: authenticated' end,
 case when to_regprocedure('auth.uid()') is null then 'missing function: auth.uid()' end,
 case when to_regprocedure('clinic_private.is_permanent_user()') is null
   then 'missing function: clinic_private.is_permanent_user()' end,
 case when to_regprocedure('clinic_private.has_staff_role(text[])') is null
   then 'missing function: clinic_private.has_staff_role(text[])' end,
 case when to_regclass('public.appointment_resources') is null
   then 'missing table: public.appointment_resources' end,
 case when to_regclass('public.staff_memberships') is null
   then 'missing table: public.staff_memberships' end,
 case when not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='appointments' and column_name='resource_id')
   then 'missing column: public.appointments.resource_id' end,
 case when not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='appointments' and column_name='starts_at')
   then 'missing column: public.appointments.starts_at' end,
 case when not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='appointments' and column_name='ends_at')
   then 'missing column: public.appointments.ends_at' end,
 case when not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='appointments' and column_name='created_by')
   then 'missing column: public.appointments.created_by' end);
SQL
)
for expected in 'missing role: anon' 'missing role: authenticated' \
 'missing function: auth.uid()' \
 'missing function: clinic_private.is_permanent_user()' \
 'missing table: public.appointment_resources' \
 'missing column: public.appointments.resource_id' \
 'missing column: public.appointments.starts_at'; do
 grep -Fqx "$expected" <<< "$gaps" ||
  { echo "NEEDS REEVALUATION: expected baseline blocker changed: $expected" >&2; exit 1; }
done
echo 'EXPECTED COMPATIBILITY BLOCKER — PR49 recovered PostgreSQL 17 clone:'
printf '%s\n' "$gaps"

# Negative test: try the REAL reviewed first migration, on the CLONE ONLY.
# A successful exit is a test failure until the entire contract can be tested.
if pgclient psql -X -v ON_ERROR_STOP=1 -d recovery_phase4_probe \
 < "$source_dir/20261113211600_phase4_taxonomy_attachments.sql" > "$work/migration.log" 2>&1; then
 echo 'NEEDS REEVALUATION: initial migration accepted incomplete baseline' >&2
 exit 1
fi
if ! grep -Eqi 'ERROR:.*(role "(anon|authenticated)" does not exist|function clinic_private\.is_permanent_user\(\) does not exist|function auth\.uid\(\) does not exist)' "$work/migration.log"; then
 echo 'NEEDS REEVALUATION: unexpected first-migration rejection:' >&2
 tail -n 20 "$work/migration.log" >&2
 exit 1
fi
echo 'PASS NEGATIVE: real first reviewed Phase4 migration rejects recovered incomplete baseline.'
after=$(snapshot)
[[ "$before" == "$after" ]] ||
 { echo 'BLOCKED: restored source data changed during migration probe' >&2; exit 1; }
echo 'PASS: restored Auth/Chow Chow/historical appointment and private Storage metadata SHA256 fingerprint unchanged.'
echo 'BLOCKED (fail closed): PR49 minimal recovery fixture lacks Phase3 input schema; complete Phase4 migration compatibility NOT VERIFIED.'
