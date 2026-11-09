-- Run after personal_vocabulary.sql in the existing VocabVoyager project.
-- Uses an existing account, simulates Data API roles, and rolls back every write.
-- No credentials or personal vocabulary are returned.
begin;

create temporary table vv_sync_checks (test text, passed boolean) on commit drop;
grant select, insert on vv_sync_checks to authenticated;

insert into vv_sync_checks values
  ('RLS enabled', (select relrowsecurity from pg_class where oid = 'public.personal_vocabulary'::regclass)),
  ('Guests have no read or write grants', not (
    has_table_privilege('anon', 'public.personal_vocabulary', 'select') or
    has_table_privilege('anon', 'public.personal_vocabulary', 'insert') or
    has_table_privilege('anon', 'public.personal_vocabulary', 'update')
  )),
  ('Accounts cannot delete or truncate notebooks', not (
    has_table_privilege('authenticated', 'public.personal_vocabulary', 'delete') or
    has_table_privilege('authenticated', 'public.personal_vocabulary', 'truncate')
  ));

select set_config('request.jwt.claim.sub',
  coalesce((select id::text from auth.users order by created_at limit 1), ''), true);
set local role authenticated;

do $$
declare
  owner_id uuid := auth.uid();
  other_id uuid := gen_random_uuid();
  probe_id text := '__vv_sync_probe_' || gen_random_uuid()::text;
  probe jsonb;
  affected integer;
  denied boolean;
begin
  if owner_id is null then
    raise exception 'An existing Supabase account is required for the authenticated sync check.';
  end if;
  probe := jsonb_build_object(
    'id', probe_id, 'term', probe_id, 'definition', 'Temporary sync verification.',
    'createdAt', 1, 'updatedAt', 1, 'nextVisit', 1, 'dueAt', 1);

  insert into public.personal_vocabulary (user_id, entry_id, payload)
  values (owner_id, probe_id, probe);
  insert into vv_sync_checks
    select 'Account can save and read its entry', count(*) = 1
    from public.personal_vocabulary where user_id = owner_id and entry_id = probe_id;

  insert into public.personal_vocabulary (user_id, entry_id, payload)
  values (owner_id, probe_id, probe || '{"updatedAt":2}'::jsonb)
  on conflict (user_id, entry_id) do update set payload = excluded.payload;
  insert into vv_sync_checks
    select 'App conflict key supports upsert', count(*) = 1
    from public.personal_vocabulary
    where user_id = owner_id and entry_id = probe_id and payload->>'updatedAt' = '2';

  denied := false;
  begin
    update public.personal_vocabulary set user_id = other_id
    where user_id = owner_id and entry_id = probe_id;
  exception when insufficient_privilege then denied := true;
  end;
  insert into vv_sync_checks values ('Ownership cannot be reassigned', denied);

  denied := false;
  begin
    insert into public.personal_vocabulary (user_id, entry_id, payload)
    values (other_id, probe_id, probe);
  exception when insufficient_privilege then denied := true;
  end;
  insert into vv_sync_checks values ('Cannot insert into another account', denied);

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  insert into vv_sync_checks
    select 'Another account cannot read the entry', count(*) = 0
    from public.personal_vocabulary where entry_id = probe_id;
  update public.personal_vocabulary set payload = probe || '{"updatedAt":3}'::jsonb
  where entry_id = probe_id;
  get diagnostics affected = row_count;
  insert into vv_sync_checks values ('Another account cannot edit the entry', affected = 0);

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  update public.personal_vocabulary set payload = payload || '{"deleted":true,"updatedAt":4}'::jsonb
  where user_id = owner_id and entry_id = probe_id;
  insert into vv_sync_checks
    select 'Recoverable removals sync', count(*) = 1
    from public.personal_vocabulary
    where user_id = owner_id and entry_id = probe_id and payload->>'deleted' = 'true';

  if exists (select 1 from vv_sync_checks where passed is distinct from true) then
    raise exception 'Notebook verification failed. Roll back before continuing.';
  end if;
end $$;

reset role;
select test, passed from vv_sync_checks;
rollback;
