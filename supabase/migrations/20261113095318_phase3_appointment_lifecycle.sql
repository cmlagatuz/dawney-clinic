-- Phase 3: safe appointment transitions. No existing appointments altered.
create or replace function clinic_private.enforce_appointment_lifecycle()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.starts_at <= statement_timestamp() then
      raise exception 'Appointment start must be in the future' using errcode='23514';
    end if;
    return new;
  end if;
  if new.status = old.status then return new; end if;
  if not (
    (old.status='requested' and new.status in ('confirmed','cancelled','no_show'))
    or (old.status='confirmed' and new.status in ('checked_in','cancelled','no_show'))
    or (old.status='checked_in' and new.status='completed')
  ) then
    raise exception 'Invalid appointment status transition: % to %',old.status,new.status
      using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function clinic_private.enforce_appointment_lifecycle() from public,anon,authenticated;
create trigger appointment_valid_lifecycle before insert or update of status on public.appointments
for each row execute function clinic_private.enforce_appointment_lifecycle();
