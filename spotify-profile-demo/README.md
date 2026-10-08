# Spotify tag-filter proof of concept

This Vite app demonstrates tag filtering and connects to Spotify with
Authorization Code with PKCE. The current backend migration uses Supabase for
authentication and relational persistence.

## Run locally

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Create a local `.env` from `.env.example` and fill in the Supabase project URL
and public publishable key:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Apply [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL
Editor before signing in. Spotify OAuth is configured in Supabase Auth; the
Spotify client secret stays in Supabase and is never placed in this frontend.

The Spotify redirect URI must exactly match the URL configured in the Spotify
Developer Dashboard, such as `http://127.0.0.1:5173/`.

## Current behavior

After Spotify login, the app saves the Spotify profile and playlist catalog to
Supabase. It does not modify Spotify playlists. The filtering screen still uses
sample songs for the proof of concept; selected-playlist track import is the
next backend milestone.

The database models users, playlists, tracks, artists, tags, nested
app-managed folders, and playlist-creation jobs. Tags support parent-child
relationships for inherited categories such as `Jazz` → `Swing`.

## Hosting

Firebase Hosting configuration is retained temporarily as a static hosting
option. It is independent of the Supabase database and authentication. Build
the app with:

```sh
npm run build
```

The final deployment must add its HTTPS URL to the Spotify redirect URIs.
