-- RETRO REALTIME DATABASE SETUP
-- Run this entire script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  client_id text not null,
  joined_at timestamptz not null default now(),
  unique(room_id, client_id)
);

create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  section text not null check(section in ('good','problem','shout')),
  content text not null check(length(content) between 1 and 500),
  author_name text not null,
  recipient_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  client_id text not null,
  reaction_type text not null check(reaction_type in ('like','heart','support')),
  created_at timestamptz not null default now(),
  unique(thought_id, client_id, reaction_type)
);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.thoughts enable row level security;
alter table public.reactions enable row level security;

-- This MVP uses anonymous names rather than Supabase Auth.
-- These policies are intentionally open for the prototype.
-- Before production, add Supabase Auth or another room-token mechanism.
drop policy if exists rooms_public on public.rooms;
create policy rooms_public on public.rooms for all to anon, authenticated using (true) with check (true);

drop policy if exists participants_public on public.participants;
create policy participants_public on public.participants for all to anon, authenticated using (true) with check (true);

drop policy if exists thoughts_public on public.thoughts;
create policy thoughts_public on public.thoughts for all to anon, authenticated using (true) with check (true);

drop policy if exists reactions_public on public.reactions;
create policy reactions_public on public.reactions for all to anon, authenticated using (true) with check (true);

-- Enable realtime for all four tables.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.thoughts;
alter publication supabase_realtime add table public.reactions;
