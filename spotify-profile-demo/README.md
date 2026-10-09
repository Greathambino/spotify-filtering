# Spotify Tag Filter

Spotify Tag Filter is a browser-based proof of concept for building a new
Spotify playlist from simple filters. A user connects Spotify, imports a
selected group of playlists, chooses playlist and metadata tags, reviews the
matching songs, and optionally creates a new private Spotify playlist from
the results.

The deployed demo is hosted at
[https://spotify-filtering.web.app/](https://spotify-filtering.web.app/).

## How to use the app

### 1. Import your playlists

1. Open the app and choose **Log in with Spotify**.
2. Approve access to your Spotify account.
3. Create a named playlist set with **New set**, or select an existing set.
4. Search for playlists and check the playlists you want to use.
5. Click **Import your playlists**.

The selected playlist set is saved automatically. Importing is the step that
loads the songs and Spotify metadata into the app. A set can be reused later
without selecting the same playlists again.

### 2. Choose your tags

After importing, choose filters from the tag groups:

- **Playlist tags:** the imported playlists. A track has a playlist tag when it
  belongs to that playlist.
- **Release date:** generated decade tags such as `2000s`, `2010s`, and
  `2020s`.
- **Clean or explicit:** generated `Clean` and `Explicit` tags from Spotify's
  track metadata.
- **Custom tags:** tags created and assigned by the user.

Click a tag repeatedly to cycle through its states:

1. First click: include the tag (`+`).
2. Second click: exclude the tag (`-`).
3. Third click: clear the filter.

Included tags are combined as an intersection. For example, including
`2010s` and `Clean` shows only tracks that have both tags. Excluded tags remove
tracks from the results.

The app shows a filter summary and updates the matching-song count as filters
change. If no filters are selected, all imported songs in the active set are
shown.

### 3. Review and create

Review the filtered songs in the results panel. Expand a track to see its
artists, album, source playlists, and custom tags. Custom tag edits remain a
local draft until **Save** is clicked.

When the results look right:

1. Click **Create Spotify playlist**.
2. Enter a playlist name.
3. Confirm the action.

The app creates a private Spotify playlist and adds the filtered tracks in
Spotify's request-size batches. Applying filters alone does not create or
modify a Spotify playlist.

## How the app works

The app has three hosted pieces:

- **Firebase Hosting** serves the frontend files.
- **Supabase** provides authentication, the Postgres database, and the API
  used by the frontend.
- **Spotify** provides the user's playlists and track metadata and receives
  requests to create playlists.

Most UI and filtering logic runs in the browser. Imported data is persisted in
Supabase so playlist sets, tracks, relationships, and tags can be reused
across sessions and devices. Tracks are stored once and connected to playlists
and tags through relationship tables. This is called normalization and avoids
copying the same track record for every playlist.

The main source files are:

- [`main.js`](./main.js): page structure, event handling, workflow, filtering
  UI, and playlist creation.
- [`style.css`](./style.css): layout, colors, spacing, responsive behavior, and
  component styling.
- [`src/supabase.js`](./src/supabase.js): Supabase client setup, Spotify
  login, session lookup, and logout.
- [`src/supabase-data.js`](./src/supabase-data.js): database queries,
  importing, metadata, tags, and relationships.
- [`src/track-model.js`](./src/track-model.js): normalized track data and
  filtering behavior.
- [`supabase/`](./supabase/): fresh-install schema and existing-database
  migrations.

## Run locally

From this directory:

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). The local development
server is only for development on your computer; it is not required for the
deployed website to run.

Create a local `.env` from [`.env.example`](./.env.example):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The frontend uses the public Supabase key. Never put a Supabase service-role
key or Spotify client secret in frontend code. Keep `.env` private; it is
ignored by Git.

## Supabase setup and migrations

For a new Supabase project, run
[`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor
before signing in.

For an existing database, apply these migrations once as needed:

- [`supabase/playlist-sets.sql`](./supabase/playlist-sets.sql): named playlist
  sets and playlist-set persistence.
- [`supabase/decade-tags.sql`](./supabase/decade-tags.sql): release-year
  storage used to generate decade tags.
- [`supabase/track-metadata.sql`](./supabase/track-metadata.sql): expanded
  Spotify metadata and raw track snapshots.

Existing browser-local playlist sets are migrated into Supabase the next time
that account logs in. The app's database policies use Supabase Row-Level
Security so users only access their own persisted data.

## Spotify and Supabase OAuth configuration

The app uses Supabase Auth to coordinate Spotify OAuth. The Spotify provider
callback should point to:

```text
https://tvlitulnmtivelgtuvno.supabase.co/auth/v1/callback
```

In Supabase **Authentication → URL Configuration**, add the final destinations
that the app is allowed to use:

```text
https://spotify-filtering.web.app/
http://127.0.0.1:5173/
```

The app sends the browser back to the origin where login started. Therefore,
start production login from the Firebase URL and local login from the local
URL. If Spotify Development Mode is enabled, only Spotify accounts added to
the app's allowed users may be able to sign in.

## Build and redeploy

The public site is built from source and deployed from the generated `dist/`
directory. After making code or styling changes:

```sh
cd "/Users/wyatthamabe/Personal VSCode/spotify-filtering/spotify-profile-demo"
npm run build
firebase deploy --only hosting
```

`npm run build` runs Vite and creates the production files. The Firebase
configuration in [`firebase.json`](./firebase.json) tells Firebase to serve
`dist/`. Do not edit `dist/` manually; it is regenerated on every build.

If the Firebase CLI is not installed, install it once:

```sh
npm install -g firebase-tools
firebase login
```

Then deploy again. The Firebase-provided `web.app` URL and HTTPS hosting are
free within Firebase's hosting limits. A custom domain is optional and would
normally cost an annual domain-registration fee.

After changing OAuth-related URLs, make sure the same production URL is
configured in both Spotify and Supabase before testing login. A deployment can
load correctly while login still fails if redirect configuration is missing.

## FAQ

### What does this tool do?

It lets you combine playlist membership with metadata filters to find songs
that match a mood or other criteria, then create a new private Spotify playlist
from those results. It is more accurate to think of it as a playlist filtering
and playlist-creation tool than as a traditional playlist merger.

### How do I connect my Spotify account?

Open the app, click **Log in with Spotify**, and approve the requested access.
For production, start from
[https://spotify-filtering.web.app/](https://spotify-filtering.web.app/). For
local development, start from `http://127.0.0.1:5173/`. The login redirect
must be configured for both environments.

### What permissions does the app request?

The app requests permission to read the user's profile and playlists and to
create and modify private playlists. It does not need permission to control
playback or read listening history. The exact OAuth scopes are configured in
[`src/supabase.js`](./src/supabase.js).

### Can I use more than two playlists?

Yes. A playlist set can contain many playlists. Included playlist tags work as
an intersection: a song must belong to every included playlist. Excluded
playlists remove songs from the results.

### How does the filtering process work?

First, select playlists and import them into the active playlist set. Then
choose tags from playlist membership, release decades, Clean/Explicit status,
or custom tags. Each tag cycles through included, excluded, and cleared
states. The results update in the browser as the filter changes.

### How are duplicate songs handled?

The app stores a track once and records its relationships to each playlist.
Therefore, if the same Spotify track appears in several imported playlists, it
does not appear multiple times merely because it has multiple source
playlists. Its playlist memberships are preserved for filtering.

### Will the original playlists be changed?

No. Importing playlists only reads their contents and stores app data in
Supabase. Creating a result playlist creates a separate private Spotify
playlist. The app does not rewrite or delete the original playlists.

### Does the app preserve the original song order?

The app preserves playlist-position information while importing, but the
filtering experience is focused on set membership rather than a user-controlled
merge order. The current UI does not offer controls for interleaving songs
from different playlists or choosing a primary playlist order.

### Are private playlists supported?

The app requests Spotify's private and collaborative playlist-read scopes, so
playlists that Spotify makes available to the signed-in account can be
selected. A playlist may still be unavailable if Spotify does not return it to
the account or if its tracks are unavailable.

### Is there a playlist-size limit?

There is no app-specific small playlist limit advertised by the UI. Large
imports require more API requests and database work, so they can take longer.
The app batches database queries and Spotify playlist-track requests rather
than sending an entire large collection in one request.

### What happens to unavailable or deleted songs?

Spotify may return playlist entries without a usable track, for example when a
track is unavailable or has been removed. Those entries cannot be added to the
new playlist. The result may therefore contain fewer songs than the source
playlists.

### What happens if Spotify or Supabase is temporarily unavailable?

The relevant operation can fail and the app should display an error instead of
pretending that an import or playlist creation succeeded. Wait a moment,
refresh, and try again. If the problem continues, check the browser console
and the service status pages before retrying repeatedly.

### Why did my Spotify session expire?

Spotify and Supabase sessions use expiring access credentials. Sign out and
sign in again if the app can no longer load playlists or create a playlist.
Refreshing the page may also restore an existing Supabase session when it is
still valid.

### Is my Spotify password stored by this app?

No. The app uses Spotify OAuth through Supabase Auth. Spotify handles the
login screen, so the frontend does not receive or store the user's Spotify
password.

### Does the app store my playlists or listening history?

The app stores the playlist, track, artist, tag, and import metadata needed for
the filtering workflow in Supabase. It does not request or use listening
history. The source code uses database policies intended to keep each user's
persisted data separated.

### Can I save and revisit previous playlist sets?

Yes. Named playlist sets are saved in Supabase. You can return to the app,
select a saved set, and reuse its playlist selection without starting over.
Tracks still need to have been imported for them to appear in the filtering
results.

### Can I edit the result before creating it?

You can change the selected filters and review the matching songs before
creating the Spotify playlist. You can also edit custom tag assignments on
individual tracks. The current app does not provide a separate drag-and-drop
editor for manually rearranging the final playlist before creation.

### Can I rename the playlist I create?

Yes. The app asks for a playlist name before creating the result playlist.
Created playlists are private by default.

### Can I delete or undo a playlist created through the app?

The app does not currently provide an undo button or a delete-playlist
workflow. You can manage or delete the resulting playlist from Spotify
itself.

### Is the app affiliated with Spotify?

No. This is an independent proof-of-concept project and is not affiliated with,
endorsed by, or sponsored by Spotify.

### Is the app available on mobile?

The interface includes responsive styling and can be opened on a mobile
browser. The experience is primarily designed and tested around a desktop
browser, so some large playlist-management tasks may be more comfortable on a
larger screen.

### What should I do if I encounter an error?

First, refresh the page and retry the operation. Confirm that you started from
the correct URL, that your Spotify account is allowed to use the Spotify
developer app, and that OAuth redirect URLs are configured in both Spotify and
Supabase. For local development, make sure the Vite server is still running.
For a deployment problem, rebuild and redeploy with the commands in
[Build and redeploy](#build-and-redeploy), then record the exact error message
and the operation that produced it.
