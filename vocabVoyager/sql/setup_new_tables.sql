-- VocabVoyager — new tables for social features + word facts
-- Run these in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ─────────────────────────────────────────────
-- 1. User Profiles  (display names / usernames)
-- ─────────────────────────────────────────────
create table if not exists public.user_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique not null references auth.users(id) on delete cascade,
  username     text unique,            -- lowercase, e.g. "teddexter"
  display_name text,                   -- shown in leaderboard / friends list
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Row-level security
alter table public.user_profiles enable row level security;
create policy "Users can read all profiles"
  on public.user_profiles for select using (true);
create policy "Users can upsert own profile"
  on public.user_profiles for all using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 2. Friendships
-- ─────────────────────────────────────────────
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  friend_id     uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz default now(),
  unique (requester_id, friend_id)
);

alter table public.friendships enable row level security;
create policy "Users can see own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = friend_id);
create policy "Users can insert friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);
create policy "Recipient can update status"
  on public.friendships for update using (auth.uid() = friend_id);
create policy "Either party can delete"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = friend_id);


-- ─────────────────────────────────────────────
-- 3. Word Facts cache  (AI-generated, global)
-- ─────────────────────────────────────────────
create table if not exists public.word_facts (
  word_id     uuid primary key references public.words(id) on delete cascade,
  fact        text not null,
  created_at  timestamptz default now()
);

alter table public.word_facts enable row level security;
create policy "Anyone can read word facts"
  on public.word_facts for select using (true);
create policy "Service role can write word facts"
  on public.word_facts for all using (true); -- tighten if needed


-- ─────────────────────────────────────────────
-- OPTIONAL: expose streak/words on user_progress for leaderboard
-- (only if user_progress doesn't already have RLS that allows public read)
-- ─────────────────────────────────────────────
-- create policy "Leaderboard: anyone can read aggregate progress"
--   on public.user_progress for select using (true);
