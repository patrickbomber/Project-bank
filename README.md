# Retro — Real Multi-Device Version

## Stack
- Plain HTML/CSS/JavaScript frontend
- Supabase Postgres for persistent room/thought/reaction data
- Supabase Realtime for live updates and participant presence
- No framework required

Supabase's Realtime service supports Broadcast, Presence and Postgres Changes for collaborative applications. This build uses Postgres Changes for straightforward MVP synchronization and stores the board data in Postgres.

## Setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase.sql`.
3. Open Project > Connect and copy the project URL and publishable key.
4. Put them in `config.js`:
   SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co"
   SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
5. Host the folder on any static host (GitHub Pages, Netlify, Vercel, etc.) or run a local static server.
6. Open the hosted URL from two different devices. Create a room on one and join with the room code/link on the other.

## Security note
This MVP intentionally allows anonymous access because the requested UX is "join with your name" without accounts. Before production use, add authentication or signed room tokens and tighten RLS policies. Do not put a Supabase secret/service key in browser code.

## Files
- index.html — UI
- style.css — styling
- app.js — Supabase integration, realtime listeners, CRUD, export
- config.js — your project URL + publishable key
- supabase.sql — database schema + RLS + realtime setup
