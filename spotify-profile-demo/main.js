import "./style.css";
import {
  getSupabaseSession,
  signInWithSpotify,
  signOutOfSupabase,
} from "./src/supabase";
import {
  savePlaylistCatalog,
  loadPlaylistSets,
  loadTracksForPlaylists,
  loadUserTags,
  createUserTag,
  setTrackTag,
  savePlaylistSet,
  saveSelectedPlaylistTracks,
  saveSpotifyUser,
  createPlaylistJob,
  updatePlaylistJob,
} from "./src/supabase-data";
import { filterTracks, normalizeTrack } from "./src/track-model";

const redirectUri = `${window.location.origin}/`;

const demoSourcePlaylists = [
  { id: "playlist-rnb", name: "R&B" },
  { id: "playlist-mellow", name: "Mellow" },
  { id: "playlist-2000s", name: "2000s" },
  { id: "playlist-favorite", name: "Favorite" },
  { id: "playlist-sing", name: "Sing" },
  { id: "playlist-funk", name: "Funk" },
  { id: "playlist-2010s", name: "2010s" },
  { id: "playlist-late-night", name: "Late Night" },
  { id: "playlist-indie", name: "Indie" },
  { id: "playlist-electronic", name: "Electronic" },
  { id: "playlist-upbeat", name: "Upbeat" },
  { id: "playlist-pop", name: "Pop" },
  { id: "playlist-2020s", name: "2020s" },
];
const demoPlaylistIdsByName = new Map(
  demoSourcePlaylists.map((playlist) => [playlist.name, playlist.id]),
);
const demoTracks = [
  ["my-boo", "My Boo", ["Usher"], ["R&B", "Mellow", "2000s", "Favorite"]],
  ["japanese-denim", "Japanese Denim", ["Daniel Caesar"], ["R&B", "Mellow", "Favorite", "Sing"]],
  ["redbone", "Redbone", ["Childish Gambino"], ["R&B", "Funk", "2010s", "Favorite"]],
  ["nights", "Nights", ["Frank Ocean"], ["R&B", "Mellow", "2010s", "Late Night"]],
  ["electric-feel", "Electric Feel", ["MGMT"], ["Indie", "Funk", "2000s", "Upbeat"]],
  ["dog-days", "Dog Days Are Over", ["Florence + The Machine"], ["Indie", "2000s", "Upbeat", "Sing"]],
  ["midnight-city", "Midnight City", ["M83"], ["Indie", "Electronic", "2010s", "Late Night"]],
  ["levitating", "Levitating", ["Dua Lipa"], ["Pop", "Funk", "2020s", "Upbeat"]],
  ["blinding-lights", "Blinding Lights", ["The Weeknd"], ["Pop", "Electronic", "2020s", "Late Night"]],
  ["sunflower", "Sunflower", ["Post Malone"], ["Pop", "Mellow", "2010s", "Favorite"]],
].map(([id, title, artistNames, playlistNames]) => normalizeTrack({
  id: `demo-${id}`,
  title,
  artistNames,
  sourcePlaylistIds: playlistNames.map((name) => demoPlaylistIdsByName.get(name)),
}));
const demoTags = demoSourcePlaylists.map((playlist) => ({
  id: playlist.id,
  name: playlist.name,
  kind: "source-playlist",
}));
const selectedTags = new Set();
const excludedTags = new Set();

document.querySelector("#app").innerHTML = `
  <div class="shell">
    <header class="hero">
      <p class="eyebrow">Spotify filtering · proof of concept</p>
      <h1>Quickly create a playlist for <em>every mood.</em></h1>
      <p class="intro">Connect Spotify to turn your playlists into custom filters.</p>
      <button id="show-demo" class="button button-secondary" type="button">
        Try a demo
      </button>
    </header>

    <section class="profile-panel" aria-labelledby="profile-heading">
      <div>
        <p class="eyebrow">Optional Spotify connection</p>
        <h2 id="profile-heading">Connect your Spotify profile</h2>
        <p id="profile-status" class="profile-status">Log in to connect your Spotify account.</p>
      </div>
      <button id="login" class="button button-primary" type="button">Log in with Spotify</button>
      <div id="profile-details" class="profile-details" hidden></div>
    </section>

    <section id="playlist-panel" class="playlist-panel" aria-labelledby="playlist-heading" hidden>
      <div class="section-heading">
        <div>
          <p class="eyebrow">1 · Import your playlists</p>
          <h2 id="playlist-heading">Choose playlists to import</h2>
        </div>
        <button id="load-playlists" class="button button-secondary" type="button">Refresh</button>
      </div>
      <p class="panel-copy">
        Start with a saved set, choose the playlists you want to search, then import
        their tracks. You only need to import a playlist set once.
      </p>
      <ol class="import-guide">
        <li><strong>Choose a saved set</strong><span>Reuse one you already made or create a new set.</span></li>
        <li><strong>Select playlists</strong><span>These playlists become your available source tags.</span></li>
        <li><strong>Import your playlists</strong><span>Load their tracks and metadata for filtering.</span></li>
      </ol>
      <div class="playlist-toolbar">
        <label class="playlist-set">
          <span>Saved set</span>
          <select id="playlist-set"></select>
        </label>
        <button id="create-set" class="button button-secondary" type="button">New set</button>
        <label class="playlist-search">
          <span class="visually-hidden">Search playlists</span>
          <input id="playlist-search" type="search" placeholder="Search playlists" />
        </label>
      </div>
      <p id="playlist-set-status" class="profile-status">
        Select playlists to save them to this set automatically.
      </p>
      <div id="playlist-list" class="playlist-list"></div>
      <button id="import-tracks" class="button button-primary" type="button">
        Import your playlists
      </button>
      <p id="playlist-status" class="profile-status"></p>
    </section>

    <section id="tag-panel" class="tag-panel" aria-labelledby="tag-heading" hidden>
      <div class="section-heading">
        <div>
          <p class="eyebrow">2 · Choose your tags</p>
          <h2 id="tag-heading">Choose which tags you'd like—or not like</h2>
        </div>
        <span id="tag-status" class="selection-summary">No tags selected</span>
      </div>
      <p class="panel-copy">
        Build your filter from playlist tags, release dates, content status, and custom
        tags. Click once to include, twice to exclude, and again to clear.
      </p>
      <div id="tag-picker" class="tag-picker" role="group" aria-label="Playlist and custom tags"></div>
    </section>

    <section id="track-results-panel" class="results" aria-live="polite" aria-labelledby="track-results-heading" hidden>
      <div class="results-heading">
        <div>
          <p class="eyebrow">3 · Review and create</p>
          <h2 id="track-results-heading"><span id="track-result-count">0</span> songs</h2>
        </div>
        <div class="results-actions">
          <p id="track-filter-description" class="filter-description">No tags selected</p>
          <button id="create-playlist" class="button" type="button" disabled>
            Create Spotify playlist
          </button>
        </div>
      </div>
      <p id="create-playlist-status" class="panel-copy" role="status"></p>
      <div id="track-song-list" class="song-list"></div>
    </section>

    <section id="demo-panel" class="demo" aria-labelledby="filter-heading" hidden>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Live demo</p>
          <h2 id="filter-heading">Build your filter</h2>
        </div>
        <div class="demo-actions">
          <button id="reset" class="button button-secondary" type="button">Reset</button>
          <button id="close-demo" class="button button-secondary" type="button">Close demo</button>
        </div>
      </div>

      <div class="filter-group">
        <div class="label-row">
          <label for="include-tags">Include tags <span>(match all)</span></label>
          <span id="include-summary" class="selection-summary">None selected</span>
        </div>
        <div id="include-tags" class="tag-list" role="group" aria-label="Tags to include"></div>
      </div>

      <div class="filter-group">
        <div class="label-row">
          <label for="exclude-tags">Exclude tags</label>
          <span id="exclude-summary" class="selection-summary">None selected</span>
        </div>
        <div id="exclude-tags" class="tag-list" role="group" aria-label="Tags to exclude"></div>
      </div>
    </section>

    <section id="demo-results" class="results" aria-live="polite" aria-labelledby="results-heading" hidden>
      <div class="results-heading">
        <div>
          <p class="eyebrow">Filtered playlist</p>
          <h2 id="results-heading"><span id="result-count">0</span> songs</h2>
        </div>
        <p id="filter-description" class="filter-description">Showing every song</p>
      </div>
      <div id="song-list" class="song-list"></div>
    </section>
  </div>
`;

const profileStatus = document.querySelector("#profile-status");
const loginButton = document.querySelector("#login");
const showDemoButton = document.querySelector("#show-demo");
const closeDemoButton = document.querySelector("#close-demo");
const demoPanel = document.querySelector("#demo-panel");
const demoResults = document.querySelector("#demo-results");
const profileDetails = document.querySelector("#profile-details");
const profilePanel = document.querySelector(".profile-panel");
const playlistPanel = document.querySelector("#playlist-panel");
const tagPanel = document.querySelector("#tag-panel");
const trackResultsPanel = document.querySelector("#track-results-panel");
const trackResultCount = document.querySelector("#track-result-count");
const trackFilterDescription = document.querySelector("#track-filter-description");
const createPlaylistButton = document.querySelector("#create-playlist");
const createPlaylistStatus = document.querySelector("#create-playlist-status");
const trackSongList = document.querySelector("#track-song-list");
const playlistList = document.querySelector("#playlist-list");
const playlistStatus = document.querySelector("#playlist-status");
const loadPlaylistsButton = document.querySelector("#load-playlists");
const importTracksButton = document.querySelector("#import-tracks");
const playlistSetSelect = document.querySelector("#playlist-set");
const createSetButton = document.querySelector("#create-set");
const playlistSearchInput = document.querySelector("#playlist-search");
const playlistSetStatus = document.querySelector("#playlist-set-status");
const tagPicker = document.querySelector("#tag-picker");
const tagStatus = document.querySelector("#tag-status");
const appPanels = [profilePanel, playlistPanel, tagPanel, trackResultsPanel];
const appPanelVisibility = new Map();
let spotifyAccessToken = null;
let availablePlaylists = [];
let selectedPlaylistIds = new Set();
let playlistSets = [];
let activePlaylistSetId = null;
let spotifyProfileId;
let supabaseUser;
let playlistSearch = "";
const tagStates = new Map();
let importedTracks = [];
let trackResultsRequest = 0;
let userTags = [];
const expandedTrackIds = new Set();
const draftTagIdsByTrackId = new Map();
let playlistSetSaveQueue = Promise.resolve();
let playlistCreationInProgress = false;

async function spotifyGet(accessToken, endpoint) {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Spotify request failed.");
  }
  return payload;
}

async function spotifyRequest(accessToken, endpoint, options = {}) {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Spotify request failed.");
  }
  return payload;
}

async function fetchSpotifyProfile(accessToken) {
  return spotifyGet(accessToken, "/me");
}

function resetSpotifyConnection() {
  spotifyAccessToken = null;
  supabaseUser = null;
  loginButton.disabled = false;
  loginButton.textContent = "Log in with Spotify";
  profileStatus.textContent = "Spotify disconnected. Log in again to reconnect.";
  profileDetails.hidden = true;
  playlistPanel.hidden = true;
  tagPanel.hidden = true;
  trackResultsPanel.hidden = true;
  availablePlaylists = [];
  selectedPlaylistIds.clear();
  playlistSets = [];
  activePlaylistSetId = null;
  tagStates.clear();
  userTags = [];
  expandedTrackIds.clear();
  draftTagIdsByTrackId.clear();
  importedTracks = [];
  spotifyProfileId = null;
  playlistList.replaceChildren();
  playlistStatus.textContent = "";
}

function renderProfile(profile) {
  profileStatus.textContent = `Hello, ${profile.display_name || profile.id}!`;
  loginButton.disabled = false;
  loginButton.textContent = "Log out";
  profileDetails.hidden = false;
  profileDetails.replaceChildren();

  const image = profile.images?.[0]?.url;
  if (image) {
    const avatar = document.createElement("img");
    avatar.className = "profile-avatar";
    avatar.src = image;
    avatar.alt = `${profile.display_name || "Spotify"} profile`;
    profileDetails.append(avatar);
  }

  const details = document.createElement("div");
  details.className = "profile-copy";
  details.innerHTML = `
    <strong></strong>
    <span></span>
    <a target="_blank" rel="noreferrer"></a>
  `;
  details.querySelector("strong").textContent = profile.display_name || "Spotify user";
  details.querySelector("span").textContent = `User ID: ${profile.id}`;
  const profileLink = details.querySelector("a");
  profileLink.href = profile.external_urls?.spotify || `https://open.spotify.com/user/${profile.id}`;
  profileLink.textContent = "Open profile on Spotify";
  profileDetails.append(details);
}

function getAvailableTags() {
  const selectedPlaylists = availablePlaylists
    .filter((playlist) => selectedPlaylistIds.has(playlist.id))
    .map((playlist) => ({ playlist, name: playlist.name }));
  const countsByName = new Map();
  selectedPlaylists.forEach(({ name }) => {
    countsByName.set(name, (countsByName.get(name) || 0) + 1);
  });
  const playlistTags = selectedPlaylists
    .map(({ playlist, name }) => ({
      id: playlist.id,
      name,
      kind: "source-playlist",
      label: countsByName.get(name) > 1
        ? `${name} — ${playlist.owner?.display_name || playlist.owner?.id || playlist.id.slice(0, 8)}`
        : name,
    }));
  const associatedCustomTagIds = new Set(
    importedTracks.flatMap((track) => track.customTagIds || []),
  );
  const customTags = userTags
    .filter((tag) => associatedCustomTagIds.has(tag.id))
    .map((tag) => ({
      id: `custom:${tag.id}`,
      name: tag.name,
      kind: "custom",
      label: tag.name,
      customTagId: tag.id,
    }));
  return [...playlistTags, ...customTags]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function renderTagPicker() {
  const tags = getAvailableTags();
  const availableTags = new Set(tags.map((tag) => tag.id));
  [...tagStates.keys()].forEach((tag) => {
    if (!availableTags.has(tag)) tagStates.delete(tag);
  });
  tagPicker.replaceChildren();
  const groups = [
    {
      label: "Playlist tags",
      tags: tags.filter((tag) => tag.kind === "source-playlist"),
      className: "",
    },
    {
      label: "Release date",
      tags: tags.filter((tag) => /^\d{4}s$/.test(tag.name)),
      className: "",
    },
    {
      label: "Clean or explicit",
      tags: tags.filter((tag) => ["Clean", "Explicit"].includes(tag.name)),
      className: "tag-group-compact",
    },
    {
      label: "Custom tags",
      tags: tags.filter(
        (tag) => tag.kind === "custom"
          && !/^\d{4}s$/.test(tag.name)
          && !["Clean", "Explicit"].includes(tag.name),
      ),
      className: "",
    },
  ];
  groups.forEach(({ label, tags, className }) => {
    if (!tags.length) return;
    const group = document.createElement("section");
    group.className = `tag-group ${className}`.trim();
    const heading = document.createElement("h3");
    heading.textContent = `${label} (${tags.length})`;
    group.append(heading);
    const chips = document.createElement("div");
    chips.className = "tag-group-chips";
    tags.forEach((tag) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tag-choice tag-choice-${tagStates.get(tag.id) || "neutral"}`;
      const state = tagStates.get(tag.id) || "neutral";
      const indicator = document.createElement("span");
      indicator.className = "tag-state-indicator";
      indicator.setAttribute("aria-hidden", "true");
      indicator.textContent = state === "include" ? "+" : state === "exclude" ? "−" : "";
      const label = document.createElement("span");
      label.textContent = tag.label;
      button.append(indicator, label);
      button.setAttribute("aria-pressed", String(tagStates.get(tag.id) === "include"));
      button.setAttribute("aria-label", state === "include"
        ? `Include ${tag.label}`
        : state === "exclude"
          ? `Exclude ${tag.label}`
          : `Use ${tag.label}`);
      button.title = state === "include"
        ? "Included. Click again to exclude."
        : state === "exclude"
          ? "Excluded. Click again to clear."
          : "Not used. Click to include.";
      button.addEventListener("click", () => {
        const currentState = tagStates.get(tag.id) || "neutral";
        const nextState = currentState === "neutral"
          ? "include"
          : currentState === "include"
            ? "exclude"
            : "neutral";
        if (nextState === "neutral") tagStates.delete(tag.id);
        else tagStates.set(tag.id, nextState);
        renderTagPicker();
        updateTagStatus();
        renderTrackResults(importedTracks);
      });
      chip.append(button);
      chips.append(chip);
    });
    group.append(chips);
    tagPicker.append(group);
  });
}

function getTagStateLabels() {
  const labelsById = new Map(getAvailableTags().map((tag) => [tag.id, tag.label]));
  return {
    included: [...tagStates]
      .filter(([, state]) => state === "include")
      .map(([tagId]) => labelsById.get(tagId))
      .filter(Boolean),
    excluded: [...tagStates]
      .filter(([, state]) => state === "exclude")
      .map(([tagId]) => labelsById.get(tagId))
      .filter(Boolean),
  };
}

function updateTagStatus() {
  const { included, excluded } = getTagStateLabels();
  const parts = [];
  if (included.length) parts.push(`Include: ${included.join(", ")}`);
  if (excluded.length) parts.push(`Exclude: ${excluded.join(", ")}`);
  tagStatus.textContent = parts.join(" · ") || "No tags selected";
}

function getPlaylistIdsForTagState(state) {
  return new Set(
    [...tagStates]
      .filter(([tagId, tagState]) => tagState === state && !tagId.startsWith("custom:"))
      .map(([playlistId]) => playlistId),
  );
}

function getCustomTagIdsForTagState(state) {
  const customTagIdsByFilterId = new Map(
    getAvailableTags()
      .filter((tag) => tag.kind === "custom")
      .map((tag) => [tag.id, tag.customTagId]),
  );
  return new Set(
    [...tagStates]
      .filter(([tagId, tagState]) => tagState === state && tagId.startsWith("custom:"))
      .map(([tagId]) => customTagIdsByFilterId.get(tagId))
      .filter(Boolean),
  );
}

function getFilteredTracks(tracks) {
  return filterTracks(tracks, {
    includeSourcePlaylistIds: getPlaylistIdsForTagState("include"),
    excludeSourcePlaylistIds: getPlaylistIdsForTagState("exclude"),
    includeTagIds: getCustomTagIdsForTagState("include"),
    excludeTagIds: getCustomTagIdsForTagState("exclude"),
  });
}

function renderTrackResults(tracks) {
  const { included, excluded } = getTagStateLabels();
  const filteredTracks = getFilteredTracks(tracks);

  trackResultCount.textContent = filteredTracks.length;
  createPlaylistButton.disabled = !filteredTracks.length || playlistCreationInProgress;
  trackFilterDescription.textContent = included.length || excluded.length
    ? [
      included.length ? `Including: ${included.join(" + ")}` : "",
      excluded.length ? `Excluding: ${excluded.join(", ")}` : "",
    ].filter(Boolean).join(" · ")
    : "No filters selected · showing every imported song in this set";
  trackSongList.replaceChildren();

  if (!filteredTracks.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = tracks.length
      ? "No imported songs match this combination."
      : "Import the selected playlists to see filtered songs here.";
    trackSongList.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredTracks.forEach((track) => {
    const card = document.createElement("article");
    card.className = "song-card";
    card.classList.toggle("song-card-expanded", expandedTrackIds.has(track.id));
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = track.title;
    const artist = document.createElement("p");
    artist.textContent = track.artistNames.join(", ") || "Artist details pending";
    const album = document.createElement("p");
    album.textContent = track.albumName || "Album details pending";
    copy.append(title, artist, album);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "song-card-toggle";
    toggle.textContent = expandedTrackIds.has(track.id) ? "Hide tags" : "View tags";
    toggle.addEventListener("click", () => {
      if (expandedTrackIds.has(track.id)) expandedTrackIds.delete(track.id);
      else expandedTrackIds.add(track.id);
      renderTrackResults(importedTracks);
    });
    card.append(copy, toggle);
    if (expandedTrackIds.has(track.id)) {
      card.append(renderTrackTagEditor(track));
    }
    fragment.append(card);
  });
  trackSongList.append(fragment);
}

async function createSpotifyPlaylist() {
  const filteredTracks = getFilteredTracks(importedTracks);
  if (!filteredTracks.length || !spotifyAccessToken || !spotifyProfileId) return;
  const name = window.prompt(
    `Create a Spotify playlist with ${filteredTracks.length} songs. Enter a name:`,
    "Filtered playlist",
  )?.trim();
  if (!name) return;

  playlistCreationInProgress = true;
  createPlaylistButton.disabled = true;
  createPlaylistStatus.textContent = `Creating "${name}"…`;
  let jobId;
  try {
    if (supabaseUser) {
      jobId = await createPlaylistJob(supabaseUser, name);
    }
    if (jobId) await updatePlaylistJob(jobId, "running");
    const playlist = await spotifyRequest(
      spotifyAccessToken,
      `/users/${encodeURIComponent(spotifyProfileId)}/playlists`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          public: false,
          collaborative: false,
          description: "Created from Spotify Tag Filter.",
        }),
      },
    );
    const uris = filteredTracks
      .map((track) => track.spotifyTrackId)
      .filter(Boolean)
      .map((spotifyTrackId) => `spotify:track:${spotifyTrackId}`);
    const batchSize = 100;
    for (let offset = 0; offset < uris.length; offset += batchSize) {
      const batch = uris.slice(offset, offset + batchSize);
      await spotifyRequest(spotifyAccessToken, `/playlists/${encodeURIComponent(playlist.id)}/tracks`, {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      });
      createPlaylistStatus.textContent =
        `Created "${name}" — added ${Math.min(offset + batch.length, uris.length)} of ${uris.length} songs…`;
    }
    if (jobId) await updatePlaylistJob(jobId, "complete", playlist.id);
    createPlaylistStatus.innerHTML = "";
    const success = document.createElement("span");
    success.textContent = `Created "${name}" with ${uris.length} songs. `;
    const link = document.createElement("a");
    link.href = playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open in Spotify";
    createPlaylistStatus.append(success, link);
  } catch (error) {
    if (jobId) {
      try {
        await updatePlaylistJob(jobId, "failed", null, error.message);
      } catch (jobError) {
        console.error("Could not update playlist creation job:", jobError);
      }
    }
    const needsReauthorization = error.message.toLowerCase().includes("insufficient client scope")
      || error.message.toLowerCase().includes("insufficient scope");
    createPlaylistStatus.textContent = needsReauthorization
      ? `Spotify did not grant playlist-creation permission. Log out, log back in, and approve the playlist modification permission, then try again.`
      : `Could not create "${name}": ${error.message}`;
  } finally {
    playlistCreationInProgress = false;
    createPlaylistButton.disabled = !getFilteredTracks(importedTracks).length;
  }
}

function renderTrackTagEditor(track) {
  const editor = document.createElement("div");
  editor.className = "song-tag-editor";
  const draftTagIds = draftTagIdsByTrackId.get(track.id)
    || new Set(track.customTagIds);
  draftTagIdsByTrackId.set(track.id, draftTagIds);

  const tagList = document.createElement("div");
  tagList.className = "song-tag-list";
  const heading = document.createElement("strong");
  heading.textContent = "Associated tags";
  editor.append(heading);
  const sourceTags = track.sourcePlaylistIds
    .map((playlistId) => getAvailableTags().find((tag) => tag.id === playlistId)?.label)
    .filter(Boolean);
  [...new Set(sourceTags)].forEach((name) => {
      const tag = document.createElement("span");
      tag.className = "song-tag";
      tag.textContent = name;
      tagList.append(tag);
  });
  editor.append(tagList);

  const associatedTags = new Set(draftTagIds);
  const sourcePlaylistIds = new Set(track.sourcePlaylistIds);
  const controls = document.createElement("div");
  controls.className = "song-tag-controls associated-tag-controls";
  userTags.filter((tag) => associatedTags.has(tag.id)).forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song-tag-option";
    button.textContent = tag.name;
    button.addEventListener("click", () => {
      draftTagIds.delete(tag.id);
      renderTrackResults(importedTracks);
    });
    controls.append(button);
  });
  editor.append(controls);

  const unassociatedHeading = document.createElement("strong");
  unassociatedHeading.textContent = "Available tags";
  editor.append(unassociatedHeading);
  const availableControls = document.createElement("div");
  availableControls.className = "song-tag-controls";
  const availableTagNames = new Set(
    userTags
      .filter((tag) => !associatedTags.has(tag.id))
      .map((tag) => tag.name),
  );
  userTags.filter((tag) => !associatedTags.has(tag.id)).forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song-tag-option";
    button.textContent = tag.name;
    button.addEventListener("click", () => {
      draftTagIds.add(tag.id);
      renderTrackResults(importedTracks);
    });
    availableControls.append(button);
  });
  availablePlaylists
    .filter((playlist) => (
      selectedPlaylistIds.has(playlist.id)
      && !sourcePlaylistIds.has(playlist.id)
      && !availableTagNames.has(playlist.name)
    ))
    .forEach((playlist) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "song-tag-option source-tag-option";
      button.textContent = getAvailableTags().find((tag) => tag.id === playlist.id)?.label
        || playlist.name;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const tag = userTags.find((existingTag) => existingTag.name === playlist.name)
            || await createUserTag(supabaseUser, playlist.name);
          if (!userTags.some((existingTag) => existingTag.id === tag.id)) userTags.push(tag);
          draftTagIds.add(tag.id);
          renderTrackResults(importedTracks);
        } catch (error) {
          playlistStatus.textContent = error.message;
          button.disabled = false;
        }
      });
      availableControls.append(button);
    });
  editor.append(availableControls);

  const form = document.createElement("form");
  form.className = "inline-tag-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 50;
  input.placeholder = "Create a new tag";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "button button-secondary";
  button.textContent = "Add tag";
  form.append(input, button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name || !supabaseUser) return;
    button.disabled = true;
    try {
      const tag = await createUserTag(supabaseUser, name);
      if (!userTags.some((existingTag) => existingTag.id === tag.id)) userTags.push(tag);
      draftTagIds.add(tag.id);
      renderTrackResults(importedTracks);
    } catch (error) {
      playlistStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  editor.append(form);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "button";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      const originalTagIds = new Set(track.customTagIds);
      for (const tagId of originalTagIds) {
        if (!draftTagIds.has(tagId)) await setTrackTag(track.id, tagId, false);
      }
      for (const tagId of draftTagIds) {
        if (!originalTagIds.has(tagId)) await setTrackTag(track.id, tagId, true);
      }
      track.customTagIds = [...draftTagIds];
      draftTagIdsByTrackId.delete(track.id);
      renderTrackResults(importedTracks);
    } catch (error) {
      playlistStatus.textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  });
  editor.append(saveButton);
  return editor;
}

async function refreshTrackResults() {
  if (!supabaseUser || !selectedPlaylistIds.size) {
    importedTracks = [];
    renderTagPicker();
    updateTagStatus();
    renderTrackResults(importedTracks);
    return;
  }
  const requestId = ++trackResultsRequest;
  try {
    importedTracks = await loadTracksForPlaylists(supabaseUser, [...selectedPlaylistIds]);
    if (requestId === trackResultsRequest) {
      renderTagPicker();
      updateTagStatus();
      renderTrackResults(importedTracks);
    }
  } catch (error) {
    if (requestId !== trackResultsRequest) return;
    importedTracks = [];
    renderTagPicker();
    updateTagStatus();
    trackFilterDescription.textContent = error.message;
    trackSongList.replaceChildren();
  }
}

function renderPlaylists() {
  playlistList.replaceChildren();
  if (!availablePlaylists.length) {
    playlistList.textContent = "No playlists were found.";
    return;
  }

  const visiblePlaylists = availablePlaylists
    .filter((playlist) => playlist.name.toLocaleLowerCase().includes(playlistSearch))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

  function renderPlaylist(playlist) {
    const label = document.createElement("label");
    label.className = "playlist-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedPlaylistIds.has(playlist.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedPlaylistIds.add(playlist.id);
      } else {
        selectedPlaylistIds.delete(playlist.id);
      }
      saveActivePlaylistSet()
        .then(() => {
          playlistSetStatus.textContent = `"${getActivePlaylistSet()?.name}" saved.`;
        })
        .catch((error) => {
          playlistSetStatus.textContent = `Could not save this set: ${error.message}`;
        });
      updatePlaylistStatus();
      renderPlaylists();
      renderTagPicker();
      updateTagStatus();
      refreshTrackResults();
    });
    const copy = document.createElement("span");
    copy.className = "playlist-option-copy";
    copy.textContent = playlist.name;
    const count = document.createElement("small");
    count.textContent = `${playlist.tracks.total} tracks`;
    label.append(checkbox, copy, count);
    return label;
  }

  visiblePlaylists.forEach((playlist) => playlistList.append(renderPlaylist(playlist)));
  if (!visiblePlaylists.length) {
    playlistList.textContent = "No playlists match your search.";
  }
}

function updatePlaylistStatus() {
  playlistStatus.textContent = selectedPlaylistIds.size
    ? `${selectedPlaylistIds.size} playlist${selectedPlaylistIds.size === 1 ? "" : "s"} selected.`
    : "Select at least one playlist to load its tracks.";
}

function saveActivePlaylistSet() {
  const activeSet = getActivePlaylistSet();
  if (!activeSet || !supabaseUser) return Promise.resolve();
  activeSet.playlistIds = [...selectedPlaylistIds];
  const snapshot = {
    ...activeSet,
    playlistIds: [...activeSet.playlistIds],
  };
  playlistSetSaveQueue = playlistSetSaveQueue
    .catch(() => {})
    .then(() => savePlaylistSet(supabaseUser, snapshot));
  return playlistSetSaveQueue;
}

function getActivePlaylistSet() {
  return playlistSets.find((set) => set.id === activePlaylistSetId);
}

function renderPlaylistSets() {
  playlistSetSelect.replaceChildren();
  playlistSets.forEach((set) => playlistSetSelect.append(new Option(set.name, set.id)));
  playlistSetSelect.value = activePlaylistSetId || "";
}

async function initializePlaylistSets() {
  playlistSets = await loadPlaylistSets(supabaseUser, availablePlaylists);
  if (!playlistSets.length) {
    let legacySet;
    try {
      const legacy = JSON.parse(
        localStorage.getItem(`spotify-playlist-sets:${spotifyProfileId}`) || "{}",
      );
      legacySet = legacy.sets?.[0];
    } catch {
      legacySet = null;
    }
    const defaultSet = {
      id: crypto.randomUUID(),
      name: legacySet?.name || "My playlists",
      playlistIds: legacySet?.playlistIds || [],
    };
    playlistSets = [defaultSet];
    activePlaylistSetId = defaultSet.id;
    await saveActivePlaylistSet();
  }
  activePlaylistSetId = activePlaylistSetId && playlistSets.some((set) => set.id === activePlaylistSetId)
    ? activePlaylistSetId
    : playlistSets[0].id;
  const activeSet = playlistSets.find((set) => set.id === activePlaylistSetId) || playlistSets[0];
  activePlaylistSetId = activeSet.id;
  selectedPlaylistIds = new Set(activeSet.playlistIds);
  renderPlaylistSets();
  updatePlaylistStatus();
  playlistSetStatus.textContent = `"${activeSet.name}" loaded. Select playlists to update it.`;
}

async function loadPlaylists() {
  if (!spotifyAccessToken) return;
  loadPlaylistsButton.disabled = true;
  playlistStatus.textContent = "Loading your playlists…";
  try {
    const playlists = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const payload = await spotifyGet(spotifyAccessToken, `/me/playlists?limit=50&offset=${offset}`);
      playlists.push(...(payload.items || []).filter(Boolean));
      total = payload.total || playlists.length;
      offset += payload.items?.length || 0;
      if (!payload.items?.length) break;
    }
    availablePlaylists = playlists;
    if (supabaseUser) {
      await savePlaylistCatalog(supabaseUser, availablePlaylists);
    }

    renderPlaylists();
    renderTagPicker();
    refreshTrackResults();
    playlistStatus.textContent = availablePlaylists.length
      ? "Select the playlists you want to use for filtering."
      : "No playlists were found.";
  } catch (error) {
    playlistStatus.textContent = error.message;
  } finally {
    loadPlaylistsButton.disabled = false;
  }
}

createSetButton.addEventListener("click", async () => {
  const name = window.prompt("Name this playlist set");
  if (!name?.trim()) return;
  const newSet = {
    id: crypto.randomUUID(),
    name: name.trim(),
    playlistIds: [],
  };
  playlistSets.push(newSet);
  activePlaylistSetId = newSet.id;
  selectedPlaylistIds = new Set();
  renderPlaylistSets();
  renderPlaylists();
  renderTagPicker();
  updateTagStatus();
  updatePlaylistStatus();
  trackResultsPanel.hidden = false;
  refreshTrackResults();
  playlistSetStatus.textContent = `Saving "${newSet.name}"…`;
  try {
    await saveActivePlaylistSet();
  } catch (error) {
    playlistSetStatus.textContent = `Could not save "${newSet.name}": ${error.message}`;
    return;
  }
  playlistSetStatus.textContent = `"${newSet.name}" saved. Select playlists to add them.`;
});

playlistSetSelect.addEventListener("change", () => {
  const previousSet = playlistSets.find((set) => set.id === activePlaylistSetId);
  const nextSetId = playlistSetSelect.value;
  const activeSet = playlistSets.find((set) => set.id === nextSetId);
  if (!activeSet) return;
  activePlaylistSetId = nextSetId;
  const previousSetSnapshot = previousSet && {
    ...previousSet,
    playlistIds: [...previousSet.playlistIds],
  };
  playlistSetSaveQueue = playlistSetSaveQueue
    .catch(() => {})
    .then(() => previousSetSnapshot && savePlaylistSet(supabaseUser, previousSetSnapshot));
  playlistSetSaveQueue.catch((error) => {
    playlistSetStatus.textContent = `Could not save the previous set: ${error.message}`;
  });
  selectedPlaylistIds = new Set(activeSet?.playlistIds || []);
  renderPlaylists();
  renderTagPicker();
  updatePlaylistStatus();
  updateTagStatus();
  refreshTrackResults();
  playlistSetStatus.textContent = `"${activeSet.name}" loaded. Select playlists to update it.`;
});

async function fetchAllPlaylistTracks(playlistId) {
  const items = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const payload = await spotifyGet(
      spotifyAccessToken,
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&offset=${offset}`,
    );
    items.push(...(payload.items || []));
    total = payload.total || items.length;
    offset += payload.items?.length || 0;
    if (!payload.items?.length) break;
  }
  return items;
}

async function importSelectedTracks() {
  if (!supabaseUser || !selectedPlaylistIds.size) {
    playlistStatus.textContent = "Select at least one playlist first.";
    return;
  }
  importTracksButton.disabled = true;
  playlistStatus.textContent = "Importing selected playlist tracks…";
  try {
    const selectedPlaylists = availablePlaylists
      .filter((playlist) => selectedPlaylistIds.has(playlist.id))
      .map((playlist) => ({ ...playlist, selected: true }));
    const summary = await saveSelectedPlaylistTracks(
      supabaseUser,
      selectedPlaylists,
      fetchAllPlaylistTracks,
      (progress) => {
        const completedCount = progress.importedTrackCount + progress.alreadyImportedTrackCount;
        const pendingCount = Math.max(0, progress.uniqueTrackCount - completedCount);
        playlistStatus.textContent =
          `${progress.uniqueTrackCount} unique tracks found · `
          + `${completedCount} imported/already imported · `
          + `${pendingCount} still processing`;
      },
    );
    userTags = await loadUserTags(supabaseUser);
    renderTagPicker();
    refreshTrackResults();
    playlistStatus.textContent =
      `${summary.uniqueTrackCount} unique tracks selected · `
      + `${summary.importedTrackCount + summary.alreadyImportedTrackCount} imported/already imported `
      + `(${summary.importedTrackCount} new, ${summary.alreadyImportedTrackCount} already imported) · `
      + `${summary.failedTrackCount} failed to import.`;
    if (summary.failedPlaylists.length) {
      playlistStatus.title = summary.failedPlaylists.join("\n");
    } else {
      playlistStatus.removeAttribute("title");
    }
  } catch (error) {
    playlistStatus.textContent = error.message;
  } finally {
    importTracksButton.disabled = false;
  }
}

async function initializeSpotifyProfile() {
  const query = new URLSearchParams(window.location.search);
  const error = query.get("error");
  const errorDescription = query.get("error_description");

  if (error) {
    profileStatus.textContent = `Spotify login failed: ${errorDescription || error}.`;
    window.history.replaceState({}, document.title, redirectUri);
    return;
  }

  try {
    const session = await getSupabaseSession();
    if (!session?.provider_token) return;
    spotifyAccessToken = session.provider_token;
    const profile = await fetchSpotifyProfile(spotifyAccessToken);
    spotifyProfileId = profile.id;
    supabaseUser = session.user;
    userTags = await loadUserTags(supabaseUser);
    await saveSpotifyUser(supabaseUser, profile);
    renderProfile(profile);
    playlistPanel.hidden = false;
    await loadPlaylists();
    await initializePlaylistSets();
    renderPlaylists();
    tagPanel.hidden = false;
    trackResultsPanel.hidden = false;
    await refreshTrackResults();
    window.history.replaceState({}, document.title, redirectUri);
  } catch (loginError) {
    profileStatus.textContent = loginError.message;
  }
}

loadPlaylistsButton.addEventListener("click", loadPlaylists);
importTracksButton.addEventListener("click", importSelectedTracks);
createPlaylistButton.addEventListener("click", createSpotifyPlaylist);
playlistSearchInput.addEventListener("input", (event) => {
  playlistSearch = event.target.value.trim().toLocaleLowerCase();
  renderPlaylists();
});

loginButton.addEventListener("click", () => {
if (spotifyAccessToken) {
  signOutOfSupabase()
    .then(resetSpotifyConnection)
    .catch((error) => {
      profileStatus.textContent = error.message;
    });
  return;
}
signInWithSpotify().catch((error) => {
  profileStatus.textContent = error.message;
});
});

const includeContainer = document.querySelector("#include-tags");
const excludeContainer = document.querySelector("#exclude-tags");

function createTagButton(tag, type) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tag tag-${type}`;
  button.dataset.tagId = tag.id;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => toggleTag(tag.id, type));
  button.textContent = tag.name;
  return button;
}

demoTags.forEach((tag) => {
  includeContainer.append(createTagButton(tag, "include"));
  excludeContainer.append(createTagButton(tag, "exclude"));
});

function getTagNames(tagIds) {
  return [...tagIds]
    .map((tagId) => demoTags.find((tag) => tag.id === tagId)?.name)
    .filter(Boolean);
}

function toggleTag(tagId, type) {
  const target = type === "include" ? selectedTags : excludedTags;
  const other = type === "include" ? excludedTags : selectedTags;

  if (target.has(tagId)) {
    target.delete(tagId);
  } else {
    target.add(tagId);
    other.delete(tagId);
  }

  updateTagButtons();
  renderResults();
}

function updateTagButtons() {
  document.querySelectorAll(".tag").forEach((button) => {
    const { tagId } = button.dataset;
    const selected = button.classList.contains("tag-include")
      ? selectedTags.has(tagId)
      : excludedTags.has(tagId);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  document.querySelector("#include-summary").textContent =
    selectedTags.size ? getTagNames(selectedTags).join(" · ") : "None selected";
  document.querySelector("#exclude-summary").textContent =
    excludedTags.size ? getTagNames(excludedTags).join(" · ") : "None selected";
}

function filterSongs() {
  return filterTracks(demoTracks, {
    includeSourcePlaylistIds: selectedTags,
    excludeSourcePlaylistIds: excludedTags,
  });
}

function renderResults() {
  const filteredSongs = filterSongs();
  document.querySelector("#result-count").textContent = filteredSongs.length;

  const includeText = selectedTags.size ? getTagNames(selectedTags).join(" + ") : "";
  const excludeText = excludedTags.size
    ? `excluding ${getTagNames(excludedTags).join(", ")}`
    : "";
  document.querySelector("#filter-description").textContent =
    includeText || excludeText ? [includeText, excludeText].filter(Boolean).join(" · ") : "Showing every song";

  const songList = document.querySelector("#song-list");
  songList.replaceChildren();

  if (!filteredSongs.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No songs match this combination. Try removing a tag.";
    songList.append(emptyState);
    return;
  }

  filteredSongs.forEach((song) => {
    const card = document.createElement("article");
    card.className = "song-card";
    card.innerHTML = `
      <div>
        <h3>${song.title}</h3>
        <p>${song.artistNames.join(", ")}</p>
      </div>
      <div class="song-tags">${
        song.sourcePlaylistIds
          .map((playlistId) => demoSourcePlaylists.find((playlist) => playlist.id === playlistId)?.name)
          .filter(Boolean)
          .map((tag) => `<span>${tag}</span>`)
          .join("")
      }</div>
    `;
    songList.append(card);
  });
}

document.querySelector("#reset").addEventListener("click", () => {
  selectedTags.clear();
  excludedTags.clear();
  updateTagButtons();
  renderResults();
});

function resetDemo() {
  selectedTags.clear();
  excludedTags.clear();
  updateTagButtons();
  renderResults();
}

function openDemo() {
  appPanels.forEach((panel) => appPanelVisibility.set(panel, panel.hidden));
  appPanels.forEach((panel) => {
    panel.hidden = true;
  });
  demoPanel.hidden = false;
  demoResults.hidden = false;
  showDemoButton.hidden = true;
}

function closeDemo() {
  resetDemo();
  demoPanel.hidden = true;
  demoResults.hidden = true;
  appPanels.forEach((panel) => {
    panel.hidden = appPanelVisibility.get(panel) ?? false;
  });
  showDemoButton.hidden = false;
}

showDemoButton.addEventListener("click", openDemo);
closeDemoButton.addEventListener("click", closeDemo);

updateTagButtons();
renderResults();
initializeSpotifyProfile();
