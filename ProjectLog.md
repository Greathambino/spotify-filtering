<!-- 
✅ - complete
⏰ - in progress
❌ - struggle / cannot complete
-->

# Summer 2024 Spotify Project Log

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#weekly-updates">Weekly Updates</a>
      <ol>
        <li><a href="#week-one">Week One</a></li>
        <li><a href="#week-two">Week Two</a></li>
        <li><a href="#week-three">Week Three</a></li>
        <li><a href="#week-four">Week Four</a></li>
        <li><a href="#week-five">Week Five</a></li>
      </ol>
    </li>
  </ol>
</details>

**Key:**
✅ - complete | ⏰ - in progress | ❌ - struggle / cannot complete

**Goal:**
I want to filter my music further through chaining multiple playlists together using set-wise operations, like intersection, union, etc...
* Idea 1: Create Song Objects that each contain its own list of “tags”, instead of being considered inside an array-type object like a vector
* Idea 2: Because I’m not working with many songs anyway, considering each user probably has at most a couple thousand songs spread across multiple playlists, I don’t need to fully implement the tags, and simply need to perform a set-wise intersection with multiple sets (playlists) to simulate the use of multiple “tags”

<!-- Weekly Updates -->
### Week One
###### *Dates:* June 16 - June 22, 2024

###### *Main Objective:* Refamiliarize yourself with what you have, and get set up on github, make markdown project log 

#### Forgot Which Days:
- ✅ Set Up Github Repo
- ✅ Create Project Log Template + Upload to Github
- ✅ Make Sure Old Code Still Works
- ✅ Workshopped Project Goal as Set Operations Instead of Filtering Through Tags

<!-- spacer -->

### Week Two
###### *Dates:* June 23 - June 29, 2024

###### *Main Objective:* Figure out how to make api calls, and functionize them for easier use. Try to make a template for the different calls: GET, POST, PUT, DELETE

#### June 24:
- Updated the log because I didn't actually USE it last week I just made one. I'm still getting used to this log
- uiverse.io is nice

<!-- spacer -->

### October 8, 2026
###### *Main Objective:* Put the Spotify filtering proof of concept on the public web and document how it works

#### What happened today
- ✅ Confirmed the app can be built for production with `npm run build`.
- ✅ Deployed the built app to Firebase Hosting at [https://spotify-filtering.web.app/](https://spotify-filtering.web.app/).
- ✅ Confirmed that the public homepage loads even when the development server on my computer is turned off.
- ✅ Clarified the difference between the local development URL (`http://127.0.0.1:5173/`) and the public Firebase URL.
- ✅ Diagnosed the confusing login failure: the browser was redirected back to the local URL after an OAuth attempt, but the local Vite server had already been stopped. The public site itself was not down.
- ✅ Confirmed that the app's redirect code uses the current browser origin, so a login started on the deployed site should return to the deployed site.
- ⏰ Spotify and Supabase redirect settings still need to be checked carefully if login from the public URL continues returning to localhost.

#### How to redeploy after making new changes

The public site is a compiled version of the files in `spotify-profile-demo`. Editing files locally does not change the public site automatically. The normal release process is:

```sh
cd "/Users/wyatthamabe/Personal VSCode/spotify-filtering/spotify-profile-demo"
npm run build
firebase deploy --only hosting
```

What these commands mean:

1. `cd` moves the terminal into the actual web app folder.
2. `npm run build` runs Vite's production build. It checks and bundles the source code, then writes the deployable files into `dist/`.
3. `firebase deploy --only hosting` uploads `dist/` to Firebase Hosting.
4. Visitors may need to refresh the page after a deployment. If the Firebase CLI is not installed, install it once with `npm install -g firebase-tools`, then run `firebase login`.

For local development, use:

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

That command is only for my computer. Other people do not need my computer or this command to visit the deployed site.

#### How this web app works

This is a browser-based Spotify playlist filtering application:

1. The browser loads the static app from Firebase Hosting.
2. The user clicks **Log in with Spotify**.
3. Supabase Auth coordinates the Spotify OAuth login. OAuth means the app sends the user to Spotify to approve access instead of asking the app to handle the user's Spotify password.
4. Spotify sends the login result through Supabase's authentication callback.
5. Supabase gives the browser a session and a Spotify provider access token.
6. The frontend uses that token to request the user's Spotify profile and playlists.
7. The user chooses playlists to import into a named playlist set.
8. The app stores normalized playlist, track, artist, and tag data in Supabase's Postgres database.
9. The filtering UI combines playlist membership and metadata tags. Include filters behave like an intersection: a track must have every included tag. Exclude filters remove tracks with excluded tags.
10. The browser displays the matching tracks and can ask Spotify to create a new playlist.

The app is not one giant server program. Most of the user interface and filtering logic runs in the browser. Firebase serves the frontend files, Supabase provides authentication and the database, and Spotify provides music data and playlist actions.

#### Technology stack and useful SWE vocabulary

- **Vite:** The frontend build tool and development server. It makes local development fast with hot module replacement and creates the production files in `dist/`.
- **Vanilla JavaScript:** The app uses regular JavaScript and browser DOM APIs rather than React, Vue, or another UI framework. This keeps the dependency footprint small, but means `main.js` manually coordinates rendering and events.
- **HTML:** `index.html` is the entry document loaded by the browser. The app's main workflow markup is built from JavaScript after the page starts.
- **CSS:** `style.css` controls layout, colors, spacing, responsive behavior, buttons, tag groups, and track cards.
- **Supabase:** A hosted backend-as-a-service. It provides the Postgres database, authentication integration, API access, and row-level security policies without requiring a separately managed server.
- **Postgres:** The relational database underneath Supabase. Tables store users, playlists, tracks, artists, tags, relationships, and import metadata.
- **Spotify Web API:** Spotify's HTTP API supplies playlists and track metadata and receives requests to create playlists.
- **OAuth:** The authorization protocol used for Spotify login. The app never handles the user's Spotify password. Redirect URLs must be configured exactly in Spotify and Supabase.
- **Firebase Hosting:** The static hosting service serving the production `dist/` files at `spotify-filtering.web.app`.
- **Environment variables:** Values such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are loaded during the build. The local `.env` file is ignored by Git. Secret keys such as a Supabase service-role key or Spotify client secret must never be placed in frontend code.
- **API:** A defined interface for software-to-software requests. This app calls Supabase and Spotify APIs from JavaScript.
- **CRUD:** Create, read, update, and delete operations. The data layer performs these operations for playlist sets, tracks, tags, and relationships.
- **Normalization:** Storing each track, artist, playlist, and tag as a distinct database record instead of copying the same information into every playlist row.
- **Join table / relationship table:** Tables such as `playlist_tracks` and `track_tags` connect many playlists or tags to many tracks.
- **Migration:** A SQL change applied to an existing database, such as adding release-year or expanded track metadata columns.
- **RLS (Row-Level Security):** Database policies that restrict which rows each authenticated user can read or change. This is an important boundary because the frontend talks directly to Supabase.
- **Production build:** The optimized, deployable output generated by `npm run build`. It is different from the development server started by `npm run dev`.
- **Deploy:** Uploading the production build to a hosting provider so other people can access it.
- **Static hosting:** Hosting files rather than running a custom backend process. Firebase handles serving the files while Supabase and Spotify handle the dynamic data and authentication.

#### Mental model for the folders

- `main.js`: application controller and UI event handling.
- `style.css`: visual design and layout.
- `src/supabase.js`: Supabase client setup, login, session lookup, and logout.
- `src/supabase-data.js`: database queries, imports, relationships, metadata, and tag persistence.
- `src/track-model.js`: track normalization and core filtering semantics.
- `supabase/*.sql`: database schema and migrations.
- `dist/`: generated production output. Do not edit this folder manually; rebuild it from source.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration.

#### OAuth redirect reminder

There are two separate flows that are easy to confuse:

- **Spotify's provider callback:** Spotify should send the OAuth response to Supabase's callback URL:
  `https://tvlitulnmtivelgtuvno.supabase.co/auth/v1/callback`
- **The app's final destination:** Supabase should redirect the browser back to the site that started login:
  `https://spotify-filtering.web.app/` for production, and `http://127.0.0.1:5173/` for local development.

If the browser returns to `127.0.0.1:5173` after a public-site login, the login was probably started from an old local tab, or the production URL is missing from Supabase's allowed redirect URLs. A stopped local Vite server will make that local callback appear to be broken even though Firebase is still working.