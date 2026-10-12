# Building Spotify Filtering

## The problem

I built Spotify Filtering to solve a personal music-organization problem. I
have playlists for favorites, guilty pleasures, jokes, popular songs, comfort
music, gym music, karaoke, and many different genres. The playlist I want
depends on both my mood and the people listening.

Maintaining a separate playlist for every combination would quickly become
unmanageable. For example, on a road trip I might want a fun, familiar mix
while excluding country music because one of my passengers does not like it.
Rather than search through dozens of playlists and choose every track
manually, I wanted to combine playlists and filter the result dynamically.

## What I built

Spotify Filtering is a web app that imports a user's Spotify playlists,
enriches eligible tracks with Last.fm tags, and lets the user filter the
collection before creating a new Spotify playlist.

One example is my karaoke workflow. I have a playlist of general karaoke
favorites, but I do not know all of those songs well enough to sing them. By
intersecting that playlist with my personal favorites, I can create a karaoke
mix made up of songs I actually know and enjoy.

The app has been used end to end with real Spotify accounts. My own collection
contains 38 playlists and roughly 4,200 unique tracks. I have also had friends
sign in and test the app with playlists containing music that my account had
not previously imported, which helped verify that the system was not only
working against my cached data.

## The hardest engineering problem

The most difficult part was making imports fast and reliable while coordinating
Spotify, Supabase, and Last.fm. The first version fetched tracks in batches
that were too small and repeated work for playlists that had not changed. A
large import could also make unnecessary API calls for tracks whose metadata
was already known, increasing latency and the risk of rate limits.

The key optimization was to compare Spotify's `snapshot_id` for each playlist
with the snapshot stored in Supabase. If the snapshots match, the playlist has
not changed, so the app can reuse its stored track data instead of fetching
every playlist item again. The import path also:

- uses bounded Spotify requests and retries for rate-limited responses;
- deduplicates tracks across playlists;
- chunks database reads and writes so requests remain within practical URL and
  payload limits;
- checks Last.fm history before queueing enrichment work;
- processes Last.fm jobs through a durable queue rather than making every
  browser session repeat the same lookups; and
- preserves already-loaded results when an unchanged playlist set is imported
  again.

I added phase-specific progress reporting while working on this. Showing
which operation was active—checking playlists, saving track metadata,
checking Last.fm history, or enriching new tracks—made bottlenecks visible
and made screen recordings useful for debugging the actual user experience.

## How I worked with AI

This was my first independently built web app from scratch, without a
quick-start template. I used AI heavily to learn how the pieces fit together:
Spotify OAuth, Supabase authentication and storage, SQL migrations, API
limits, asynchronous work, and the control flow between the browser and
backend services.

AI helped explain unfamiliar code, identify inefficient or broken control
flows, and suggest implementation paths. I remained responsible for the
product decisions and the behavior I wanted. I chose the use cases, decided
which optimizations mattered, implemented and revised the features, and
verified them by clicking through the site, checking values with small
developer tests, and testing with both my account and friends' accounts. I
also screen-recorded imports and used those recordings to evaluate progress
reporting, loading states, and perceived performance rather than relying only
on whether the code technically completed.

## Why I am proud of it

I started with a personal frustration and turned it into a tool I actually
use. In about five days, I went from having no prior website-building
experience to a working application that integrates multiple APIs, handles
real user authentication, persists data, and creates filtered Spotify
playlists.

The project also pushed me to work within free-tier constraints instead of
assuming unlimited infrastructure. The result is not just a demo: it is a
practical solution to a problem I had, tested against real collections and
real users.
