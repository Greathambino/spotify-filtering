create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null unique,
  display_name text,
  profile_url text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spotify_playlist_id text not null,
  name text not null,
  description text,
  image_url text,
  owner_spotify_user_id text,
  track_count integer not null default 0,
  spotify_url text,
  updated_at timestamptz not null default now(),
  unique (user_id, spotify_playlist_id)
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spotify_track_id text not null,
  title text not null,
  album_id text,
  album_name text,
  explicit boolean not null default false,
  spotify_uri text,
  updated_at timestamptz not null default now(),
  unique (user_id, spotify_track_id)
);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer,
  primary key (playlist_id, track_id)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spotify_artist_id text not null,
  name text not null,
  unique (user_id, spotify_artist_id)
);

create table public.track_artists (
  track_id uuid not null references public.tracks(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  artist_order integer not null default 0,
  primary key (track_id, artist_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  parent_tag_id uuid references public.tags(id) on delete restrict,
  description text,
  unique (user_id, name)
);

create table public.track_tags (
  track_id uuid not null references public.tracks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (track_id, tag_id)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  parent_folder_id uuid references public.folders(id) on delete restrict,
  unique (user_id, name, parent_folder_id)
);

create table public.folder_playlists (
  folder_id uuid not null references public.folders(id) on delete cascade,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  primary key (folder_id, playlist_id)
);

create table public.playlist_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  spotify_playlist_id text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

grant select, insert, update, delete on
  public.users,
  public.playlists,
  public.tracks,
  public.playlist_tracks,
  public.artists,
  public.track_artists,
  public.tags,
  public.track_tags,
  public.folders,
  public.folder_playlists,
  public.playlist_jobs
to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

alter table public.users enable row level security;
alter table public.playlists enable row level security;
alter table public.tracks enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.artists enable row level security;
alter table public.track_artists enable row level security;
alter table public.tags enable row level security;
alter table public.track_tags enable row level security;
alter table public.folders enable row level security;
alter table public.folder_playlists enable row level security;
alter table public.playlist_jobs enable row level security;

create policy "users own their profile" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users own their playlists" on public.playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their tracks" on public.tracks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their artists" on public.artists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their tags" on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their folders" on public.folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their jobs" on public.playlist_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own playlist tracks" on public.playlist_tracks for all
  using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
    and exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
    and exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
  );
create policy "users own track artists" on public.track_artists for all
  using (exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid()));
create policy "users own track tags" on public.track_tags for all
  using (
    exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
    and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
    and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid())
  );
create policy "users own folder playlists" on public.folder_playlists for all
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );
