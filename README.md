# Spotify Filtering

Spotify Filtering is a web app that imports a user's Spotify playlists,
enriches eligible tracks with Last.fm tags, and lets the user filter the
collection before creating a new Spotify playlist.

I built it to solve a personal problem: I have playlists for many genres,
moods, and situations, but manually combining them for a specific group or
activity quickly becomes unmanageable. The app turns that collection into a
filterable music library.

## Start here

1. **[Read the project story](./PROJECT_STORY.md)** — motivation, real-world
   examples, technical challenges, AI-assisted workflow, and lessons learned.
2. **[Try the live demo](https://spotify-filtering.web.app/)** — the deployed
   proof of concept.
3. **[Open the application source](./spotify-profile-demo/)** — the active Vite
   app, including the Spotify integration, Supabase data layer, Last.fm
   enrichment worker, and filtering UI.

## Technical highlights

- Spotify OAuth and playlist import
- Playlist snapshot caching to skip unchanged playlist requests
- Track deduplication across large playlist collections
- Batched and bounded API/database operations
- Durable Last.fm enrichment queue with query-history checks
- Tag-based filtering and creation of filtered Spotify playlists
- Progress reporting and loading states designed around real import behavior

## Project context

The application has been tested end to end with real Spotify accounts,
including a collection of 38 playlists and roughly 4,200 unique tracks. It
has also been tested with friends' accounts and previously unseen music.

The older planning notes are preserved in
[`archive/ProjectLog.md`](./archive/ProjectLog.md), but they are not part of
the current project documentation.
