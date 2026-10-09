# Spotify Filtering — AI Project Journal

This journal records the project decisions, implementation work, debugging
results, and next actions captured with AI assistance. It is intended to make
future sessions easy to resume without repeating completed investigation.

## Project

**Spotify Filtering** is a Vite web app that imports a user's Spotify
playlists and eventually lets them organize and filter songs with persistent
tags. The long-term goal is to support tag intersection, hierarchical tags,
and explicit creation of filtered Spotify playlists.

The active proof-of-concept app is in
[`spotify-profile-demo`](./spotify-profile-demo/).

## Journal entry — October 7, 2026

### Authentication and identity

- Confirmed that the app should use Spotify OAuth as its required sign-in
  method. Users need to be authenticated with Spotify because the app must
  access their Spotify profile, playlists, and tracks.
- Clarified that Supabase dashboard ownership, Supabase Auth users, Spotify
  accounts, and SMTP sender accounts are separate identities.
- Confirmed that creating the Supabase project with a personal account does
  not compromise the project. The project can continue to be used for
  development and can be administered or transferred later.
- Confirmed that users do not need Gmail accounts. Gmail is only an SMTP
  sender if Gmail is selected for Supabase email delivery.
- The existing Spotify Auth user for `gummyland1` remains in Supabase.
- The temporary email-auth user created during SMTP testing was deleted. It
  was not part of the intended product flow.

### SMTP configuration and verification

- Enabled two-factor authentication on the professional Gmail account.
- Created a Google App Password. The App Password must remain private and
  must never be committed to the repository or shared in chat.
- Configured Supabase custom SMTP with:

  ```text
  Host: smtp.gmail.com
  Port: 587
  Sender/SMTP username: professional Gmail address
  Password: Google App Password
  ```

- Supabase does not provide a dedicated SMTP test button in the dashboard.
- Verified the configuration by using the Supabase invitation flow to send an
  email.
- The invitation email arrived successfully, but Gmail placed it in Spam.
  This confirms SMTP connectivity and delivery. The Spam placement is
  expected during early development with a Gmail sender.
- The Supabase warning about Gmail being intended for personal rather than
  transactional email can be ignored for development. A transactional
  provider with SPF/DKIM should be considered before production.
- SMTP is auxiliary to the app. It is not required for ordinary Spotify OAuth
  login.

### Current Spotify login blocker

After the SMTP test and removal of the temporary email user, the app displayed:

> Spotify login failed: Unverified email with spotify. A confirmation email
> has been sent to your spotify email.

This is an Auth/provider-email verification issue, not evidence that the
Spotify user was deleted. The current plan is to pause while the relevant rate
limit resets, then check the email associated with the Spotify account and
follow the verification link before retrying.

The browser console message about:

```text
Unchecked runtime.lastError: The message port closed before a response was received.
```

is from a browser extension and is unrelated to the app's OAuth implementation.

## Earlier implementation milestones

### Proof of concept

- Built the initial tag-filtering demonstration with:
  - Include-tag intersection (“match all”)
  - Exclude tags
  - Reset behavior
  - Result counts
- Verified the Vite app with a production build.

### Spotify OAuth

- Replaced the incomplete login flow with Spotify Authorization Code + PKCE.
- Corrected callback placement, redirect URI configuration, token exchange, and
  profile loading.
- Established the local development URL:

  ```text
  http://127.0.0.1:5173/
  ```

- Later migrated the frontend to Supabase's built-in Spotify OAuth provider.
- The Spotify client secret remains in Supabase and is not stored in frontend
  code or the local environment file.
- The current frontend expects the Supabase session's
  `session.provider_token` for Spotify API requests.

### Supabase migration

- Replaced Firebase runtime usage with Supabase.
- Added the Supabase JavaScript client and persistence helpers.
- Added relational tables for:
  - Users
  - Playlists
  - Tracks
  - Artists
  - Tags
  - Track/tag relationships
  - Nested folders and playlist/folder relationships
  - Playlist creation jobs
- Applied the schema and RLS policies in Supabase.
- Added explicit API grants after encountering table permission errors.
- Confirmed that Spotify profile persistence works.
- Added playlist catalog persistence and selected-playlist track import logic.
- Added playlist deduplication after PostgreSQL rejected duplicate rows within
  one upsert request.

### Playlist loading and folders

- Replaced the original single playlist request with pagination using Spotify's
  `limit` and `offset` parameters, allowing the app to load the complete
  playlist catalog.
- Confirmed that Spotify's official Web API exposes playlists as a flat list
  and does not expose the folder hierarchy shown in the Spotify desktop app.
- Implemented app-managed nested folders instead:
  - Root folders
  - Child folders
  - Expand/collapse controls
  - Playlist assignment
  - Recursive folder-level selection
  - Unfiled playlists
- Saved the folder layout in browser `localStorage`, keyed by Spotify user ID.
- Native Spotify folders still cannot be reconstructed automatically through
  the official API.

## Current technical state

- App directory:
  `spotify-profile-demo/`
- Local command:

  ```sh
  cd "/Users/wyatthamabe/Personal VSCode/spotify-filtering/spotify-profile-demo"
  npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
  ```

- Build command:

  ```sh
  npm run build
  ```

- Supabase project URL:
  `https://tvlitulnmtivelgtuvno.supabase.co`
- Supabase callback URL:
  `https://tvlitulnmtivelgtuvno.supabase.co/auth/v1/callback`
- Local allowed redirect URL:
  `http://127.0.0.1:5173/`
- The app's filtering screen still uses sample songs for the proof of concept.
- Folder data is still browser-local rather than stored in Supabase.
- Durable Spotify OAuth has been implemented but has not yet completed a clean
  end-to-end login after the email-verification/rate-limit issue.

### October 8, 2026 — playlist sets

- Removed the frontend's app-managed nested-folder workflow.
- Added named playlist sets saved in browser `localStorage`, keyed by Spotify
  user ID.
- Each set stores its selected Spotify playlist IDs.
- The active set is restored after logging back in, so a person does not need
  to reselect a large collection of playlists.
- Multiple people sharing one Spotify account can create and switch between
  named sets such as `Wyatt's songs` and `Other person's songs`.
- Playlist search and alphabetical ordering remain available.
- The existing `folders` and `folder_playlists` database tables are retained
  for compatibility with the already-applied schema, but the frontend no
  longer reads or writes them.
- Sets are currently browser-local. Moving named sets into Supabase is a
- Named playlist sets were subsequently moved into Supabase with
  `playlist_sets` and `playlist_set_playlists`, so they can follow the account
  across browsers and devices.
- The tag picker was narrowed to playlist-name tags from the active saved set
  whose tracks actually exist in Supabase. Unimported playlists are excluded
  as null/unavailable tags.

## Journal entry — October 8, 2026

### Public deployment

- Built the production frontend successfully with `npm run build`.
- Deployed the Vite app to Firebase Hosting at:
  `https://spotify-filtering.web.app/`
- Confirmed that the public homepage can be opened without the local Vite
  development server running. The user's computer does not need to stay on for
  Firebase Hosting, Supabase, or Spotify-backed app features to work.
- Clarified that `npm run dev` is only for local development. Future releases
  require rebuilding and deploying:

  ```sh
  cd "/Users/wyatthamabe/Personal VSCode/spotify-filtering/spotify-profile-demo"
  npm run build
  firebase deploy --only hosting
  ```

- Firebase's generated `web.app` URL keeps hosting free within the service's
  free limits. A custom domain is optional and would normally require an
  annual registration fee.

### OAuth redirect debugging

- Diagnosed a login redirect that returned to
  `http://127.0.0.1:5173/` after the local server had been stopped. The
  browser correctly returned to the origin where that login attempt started;
  the public Firebase site itself was not down.
- Confirmed that the frontend uses `window.location.origin` for its final
  Supabase redirect destination.
- Distinguished the two OAuth redirects:
  - Spotify's provider callback:
    `https://tvlitulnmtivelgtuvno.supabase.co/auth/v1/callback`
  - The final app destinations:
    `https://spotify-filtering.web.app/` for production and
    `http://127.0.0.1:5173/` for local development.
- Production login should be started from the Firebase URL, and both final
  destinations should be allowed in Supabase Auth URL configuration.

### Documentation

- Updated the app README with:
  - A user walkthrough for importing playlists, choosing tags, and creating a
    private Spotify playlist.
  - Explanations of playlist, decade, Clean/Explicit, and custom tags.
  - Include/exclude/clear filtering behavior and intersection semantics.
  - Local development, Supabase migration, OAuth, build, and redeployment
    instructions.
  - A FAQ covering permissions, duplicate tracks, private playlists, large
    imports, unavailable tracks, session expiration, stored data, saved sets,
    mobile use, Spotify affiliation, and troubleshooting.
- Documented the app architecture and software-engineering concepts:
  Vite, vanilla JavaScript, Firebase Hosting, Supabase, Postgres, Spotify's
  Web API, OAuth, normalization, relationship tables, migrations, RLS,
  production builds, and static hosting.
- Pushed the implementation and documentation changes to the GitHub `main`
  branch in commit `80d1b7c`.

## Resume checklist

1. Do not repeatedly retry Spotify login while the rate limit is active.
2. After the rate limit resets, check the Spotify account email inbox and Spam
   folder for the Supabase verification email.
3. Click the verification link, then retry:
   `http://127.0.0.1:5173/`
4. If login still fails, inspect Supabase Auth logs before changing frontend
   code.
5. Verify the Spotify provider client ID and secret, Supabase redirect settings,
   and Spotify's callback URL.
6. Confirm that the existing Spotify Auth user is reused and that only one
   corresponding public `users` row exists.
7. Once OAuth is stable, move app-managed folders into the Supabase
   `folders` and `folder_playlists` tables.
8. Validate selected-playlist track import in `tracks`, `artists`,
   `playlist_tracks`, and `track_artists`.
9. Implement persistent hierarchical tag CRUD and replace sample-song
   filtering with imported-track filtering.
10. Add an explicit, user-triggered workflow for creating filtered Spotify
    playlists.

## Guardrails

- Never place Spotify client secrets, Supabase service-role keys, Gmail
  passwords, or Google App Passwords in frontend code, `.env.example`, Git, or
  chat.
- Keep using port `5173` with `--strictPort`; `127.0.0.1:5173` and
  `127.0.0.1:5174` have separate browser storage and sessions.
- Do not delete the existing Spotify Auth user while cleaning up temporary
  email-auth test users.
