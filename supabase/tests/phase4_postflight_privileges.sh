#!/usr/bin/env bash
# Disposable PG17 privilege metadata fixture. NEVER connect to a Supabase project.
set -Eeuo pipefail
if [[ "$GITHUB_ACTIONS" != "true" || "$PGHOST" != "127.0.0.1" ||
      "$PGDATABASE" != "postflight_privilege_ci" ]]; then
  echo 'Refusing non-isolated postflight privilege test target' >&2
  exit 1
fi
work=$(mktemp -d "$RUNNER_TEMP/dawney-postflight-acl.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT

# Synthetic tables have only the columns referenced by the REAL postflight ACL SELECT.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema clinic_ci;
grant usage on schema public to anon,authenticated;
create table public.appointments(concern text);
insert into public.appointments values ('synthetic RLS-hidden concern');
alter table public.appointments enable row level security;
create policy synthetic_deny_anon on public.appointments for select to anon using(false);
create table public.pet_attachments(id integer);
create table public.clinic_services(
 id integer,display_name text,owner_approved_by uuid,owner_approved_at timestamptz);
create table public.clinic_booking_policy(
 timezone text,approved_by uuid,approved_at timestamptz);
grant select(display_name) on public.clinic_services to anon;
grant select(timezone) on public.clinic_booking_policy to anon;
SQL

# Execute the exact SELECT expressions from the real owner postflight source:
# no parallel reimplementation of the predicate under test.
awk '
  /^select has_column_privilege\(/ {
    printing=1
    sub(/^select /,"create view clinic_ci.postflight_acl as select ")
  }
  printing {
    print
    if (/^  as owner_cannot_publish_services;/) {
      finished=1
      exit
    }
  }
  END { if (!finished) exit 1 }
' supabase/checks/phase4_postflight_readonly.sql > "$work/postflight-acl.sql"
[[ -s "$work/postflight-acl.sql" ]] || {
 echo 'Missing real postflight privilege SELECT' >&2; exit 1;
}
psql -X -v ON_ERROR_STOP=1 -f "$work/postflight-acl.sql"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $baseline$
begin
 if not (select anon_cannot_read_appointments
   and anon_cannot_read_clinical_metadata
   and owner_cannot_publish_services
   and anon_may_read_public_service_name
   and anon_may_read_approved_schedule_timezone
   from clinic_ci.postflight_acl) then
  raise exception 'Baseline expected privilege flags are incorrect';
 end if;
end $baseline$;

-- A column-level SELECT grant must NOT be mistaken for no SELECT grant.
grant select(concern) on public.appointments to anon;
do $column_only_appointments$
begin
 if has_table_privilege('anon','public.appointments','SELECT')
   or not has_any_column_privilege('anon','public.appointments','SELECT')
   or (select anon_cannot_read_appointments from clinic_ci.postflight_acl) then
  raise exception 'Postflight missed anon SELECT(concern) column-only grant';
 end if;
end $column_only_appointments$;

-- Grant metadata is intentionally different from effective RLS row visibility.
set role anon;
do $rls_denial$
declare visible_rows integer;
begin
 select count(concern) into visible_rows from public.appointments;
 if visible_rows<>0 then
  raise exception 'Fixture RLS did not deny anon rows';
 end if;
end $rls_denial$;
reset role;

grant select(id) on public.pet_attachments to anon;
do $column_only_metadata$
begin
 if has_table_privilege('anon','public.pet_attachments','SELECT')
   or not has_any_column_privilege('anon','public.pet_attachments','SELECT')
   or (select anon_cannot_read_clinical_metadata from clinic_ci.postflight_acl) then
  raise exception 'Postflight missed anon clinical metadata column-only grant';
 end if;
end $column_only_metadata$;

grant insert(id) on public.clinic_services to authenticated;
do $column_only_publish$
begin
 if has_table_privilege('authenticated','public.clinic_services','INSERT')
   or not has_any_column_privilege('authenticated','public.clinic_services','INSERT')
   or (select owner_cannot_publish_services from clinic_ci.postflight_acl) then
  raise exception 'Postflight missed authenticated INSERT(id) column-only grant';
 end if;
end $column_only_publish$;
select 'PASS: exact postflight SQL catches all three column-only grants; distinct RLS denial still hides synthetic rows' as verdict;
SQL
