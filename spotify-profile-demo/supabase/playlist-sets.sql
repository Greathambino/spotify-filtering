create table if not exists public.playlist_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.playlist_set_playlists (
  set_id uuid not null references public.playlist_sets(id) on delete cascade,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  primary key (set_id, playlist_id)
);

grant select, insert, update, delete on
  public.playlist_sets,
  public.playlist_set_playlists
to anon, authenticated;

alter table public.playlist_sets enable row level security;
alter table public.playlist_set_playlists enable row level security;

create policy "users own their playlist sets" on public.playlist_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own playlist set playlists" on public.playlist_set_playlists
  for all using (
    exists (select 1 from public.playlist_sets s where s.id = set_id and s.user_id = auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.playlist_sets s where s.id = set_id and s.user_id = auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );
