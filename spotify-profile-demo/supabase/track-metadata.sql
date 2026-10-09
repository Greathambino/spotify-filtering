alter table public.tracks
  add column if not exists release_date text,
  add column if not exists release_date_precision text,
  add column if not exists duration_ms integer,
  add column if not exists disc_number integer,
  add column if not exists track_number integer,
  add column if not exists spotify_url text,
  add column if not exists is_local boolean not null default false,
  add column if not exists available_markets jsonb;

alter table public.playlist_tracks
  add column if not exists added_at timestamptz,
  add column if not exists added_by_spotify_user_id text;

alter table public.artists
  add column if not exists spotify_url text,
  add column if not exists image_url text;

create table if not exists public.spotify_track_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  spotify_track_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

grant select, insert, update, delete on public.spotify_track_snapshots to anon, authenticated;
alter table public.spotify_track_snapshots enable row level security;
create policy "users own track snapshots" on public.spotify_track_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
