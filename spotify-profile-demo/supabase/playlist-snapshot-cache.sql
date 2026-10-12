alter table public.playlists
  add column if not exists snapshot_id text;
