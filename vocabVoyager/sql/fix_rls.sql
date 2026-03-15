-- VocabVoyager — RLS fix (idempotent — safe to re-run)
-- Run in Supabase Dashboard → SQL Editor → New Query

-- ─────────────────────────────────────────────────────────
-- GRANTS — tables created via SQL Editor don't get auto-grants.
-- Without these, RLS policies are irrelevant — Supabase returns 403.
-- ─────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_profiles to anon, authenticated;
grant select, insert, update, delete on public.friendships   to anon, authenticated;
grant select, insert, update         on public.word_facts    to anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- user_profiles
-- ─────────────────────────────────────────────────────────
drop policy if exists "Users can read all profiles"        on public.user_profiles;
drop policy if exists "Users can upsert own profile"       on public.user_profiles;
drop policy if exists "Users can insert own profile"       on public.user_profiles;
drop policy if exists "Users can update own profile"       on public.user_profiles;
drop policy if exists "Users can delete own profile"       on public.user_profiles;

create policy "Users can read all profiles"
  on public.user_profiles for select
  using (true);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own profile"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- username_changed_at column for 30-day change cooldown
alter table public.user_profiles
  add column if not exists username_changed_at timestamptz;

-- daily_fact columns — today's word-of-the-day stored per user in Supabase
-- so phone and desktop always show the same fact on the same day
alter table public.user_profiles
  add column if not exists daily_fact_date date;
alter table public.user_profiles
  add column if not exists daily_fact_word_id uuid references public.words(id) on delete set null;


-- ─────────────────────────────────────────────────────────
-- friendships
-- ─────────────────────────────────────────────────────────
drop policy if exists "Users can see own friendships"    on public.friendships;
drop policy if exists "Users can insert friend requests" on public.friendships;
drop policy if exists "Recipient can update status"      on public.friendships;
drop policy if exists "Either party can delete"          on public.friendships;

create policy "Users can see own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = friend_id);

create policy "Users can insert friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Recipient can update status"
  on public.friendships for update
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

create policy "Either party can delete"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = friend_id);


-- ─────────────────────────────────────────────────────────
-- word_facts
-- ─────────────────────────────────────────────────────────
drop policy if exists "Anyone can read word facts"                on public.word_facts;
drop policy if exists "Service role can write word facts"         on public.word_facts;
drop policy if exists "Authenticated users can insert word facts" on public.word_facts;
drop policy if exists "Authenticated users can update word facts" on public.word_facts;

create policy "Anyone can read word facts"
  on public.word_facts for select
  using (true);

create policy "Authenticated users can insert word facts"
  on public.word_facts for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update word facts"
  on public.word_facts for update
  using (true)
  with check (auth.role() = 'authenticated');
