create table if not exists public.lastfm_enrichment_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'complete', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, track_id)
);

create table if not exists public.external_track_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  provider text not null,
  source text not null check (source in ('track', 'artist')),
  tag_name text not null,
  normalized_name text not null,
  popularity integer,
  created_at timestamptz not null default now(),
  unique (user_id, track_id, provider, source, normalized_name)
);

alter table public.lastfm_enrichment_queue
  add column if not exists lease_expires_at timestamptz;

grant select, insert, update, delete on
  public.lastfm_enrichment_queue,
  public.external_track_tags
to anon, authenticated;

alter table public.lastfm_enrichment_queue enable row level security;
alter table public.external_track_tags enable row level security;

drop policy if exists "users own Last.fm queue"
  on public.lastfm_enrichment_queue;
create policy "users own Last.fm queue" on public.lastfm_enrichment_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users own external track tags"
  on public.external_track_tags;
create policy "users own external track tags" on public.external_track_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
