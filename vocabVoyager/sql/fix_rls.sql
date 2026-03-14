-- VocabVoyager — RLS fix + username cooldown column
-- Run this in Supabase SQL Editor after setup_new_tables.sql

-- ─────────────────────────────────────────────────────────────────────
-- Fix 1: user_profiles — add explicit WITH CHECK for INSERT/UPDATE
--        (the previous FOR ALL USING (...) lacked WITH CHECK, causing 403)
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Users can upsert own profile" on public.user_profiles;

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
-- Fix 2: word_facts — add WITH CHECK so authenticated users can insert
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Service role can write word facts" on public.word_facts;

create policy "Authenticated users can insert word facts"
  on public.word_facts for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update word facts"
  on public.word_facts for update
  using (true) with check (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────
-- Fix 3: friendships — make sure insert WITH CHECK is set
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Users can insert friend requests" on public.friendships;

create policy "Users can insert friend requests"
  on public.friendships for insert
  with check ((select auth.uid()) = requester_id);


-- ─────────────────────────────────────────────────────────────────────
-- Feature: username change cooldown
--   Add username_changed_at so we can enforce 30-day cooldown in code
-- ─────────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists username_changed_at timestamptz;
