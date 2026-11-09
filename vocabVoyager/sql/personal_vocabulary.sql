-- Apply in the EXISTING VocabVoyager Supabase project once it is accessible.
-- This adds a separate private notebook and does not alter the legacy word bank.
begin;
create table if not exists public.personal_vocabulary (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null check (char_length(entry_id) between 1 and 120),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 100000
    and payload ?& array['id', 'term', 'definition', 'updatedAt', 'createdAt', 'nextVisit', 'dueAt']
    and jsonb_typeof(payload->'term') = 'string'
    and jsonb_typeof(payload->'definition') = 'string'
    and jsonb_typeof(payload->'updatedAt') = 'number'
    and (payload->>'id') = entry_id
  ),
  primary key (user_id, entry_id)
);
alter table public.personal_vocabulary enable row level security;
-- Remove inherited/default table grants before allowing only the operations used
-- by notebook sync. Removals are recoverable payload markers, not SQL DELETEs.
revoke all on public.personal_vocabulary from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on public.personal_vocabulary to authenticated;
drop policy if exists "Read own notebook" on public.personal_vocabulary;
create policy "Read own notebook" on public.personal_vocabulary for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Insert own notebook" on public.personal_vocabulary;
create policy "Insert own notebook" on public.personal_vocabulary for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Update own notebook" on public.personal_vocabulary;
create policy "Update own notebook" on public.personal_vocabulary for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';
commit;
