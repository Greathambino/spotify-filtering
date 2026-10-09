alter table public.tracks
  add column if not exists release_year integer;
