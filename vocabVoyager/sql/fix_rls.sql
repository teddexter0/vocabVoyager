-- VocabVoyager — RLS fix + username cooldown column
-- Safe to re-run: drops all policies before recreating them
-- Run this in Supabase SQL Editor (replaces setup_new_tables.sql policies too)

-- ─────────────────────────────────────────────────────────────────────
-- user_profiles — drop ALL existing policies first, then recreate
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Users can read all profiles"   on public.user_profiles;
drop policy if exists "Users can upsert own profile"  on public.user_profiles;
drop policy if exists "Users can insert own profile"  on public.user_profiles;
drop policy if exists "Users can update own profile"  on public.user_profiles;
drop policy if exists "Users can delete own profile"  on public.user_profiles;

create policy "Users can read all profiles"
  on public.user_profiles for select using (true);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own profile"
  on public.user_profiles for delete
  using ((select auth.uid()) = user_id);


-- ─────────────────────────────────────────────────────────────────────
-- friendships — drop ALL existing policies first, then recreate
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Users can see own friendships"    on public.friendships;
drop policy if exists "Users can insert friend requests" on public.friendships;
drop policy if exists "Recipient can update status"      on public.friendships;
drop policy if exists "Either party can delete"          on public.friendships;

create policy "Users can see own friendships"
  on public.friendships for select
  using ((select auth.uid()) = requester_id or (select auth.uid()) = friend_id);

create policy "Users can insert friend requests"
  on public.friendships for insert
  with check ((select auth.uid()) = requester_id);

create policy "Recipient can update status"
  on public.friendships for update
  using ((select auth.uid()) = friend_id)
  with check ((select auth.uid()) = friend_id);

create policy "Either party can delete"
  on public.friendships for delete
  using ((select auth.uid()) = requester_id or (select auth.uid()) = friend_id);


-- ─────────────────────────────────────────────────────────────────────
-- word_facts — drop ALL existing policies first, then recreate
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Anyone can read word facts"              on public.word_facts;
drop policy if exists "Service role can write word facts"       on public.word_facts;
drop policy if exists "Authenticated users can insert word facts" on public.word_facts;
drop policy if exists "Authenticated users can update word facts" on public.word_facts;

create policy "Anyone can read word facts"
  on public.word_facts for select using (true);

create policy "Authenticated users can insert word facts"
  on public.word_facts for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update word facts"
  on public.word_facts for update
  using (true) with check (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────
-- username_changed_at column (for 30-day change cooldown)
-- ─────────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists username_changed_at timestamptz;
