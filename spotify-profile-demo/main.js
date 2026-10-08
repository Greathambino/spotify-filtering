import "./style.css";
import {
  getSupabaseSession,
  signInWithSpotify,
  signOutOfSupabase,
} from "./src/supabase";
import {
  savePlaylistCatalog,
  saveSelectedPlaylistTracks,
  saveSpotifyUser,
} from "./src/supabase-data";

const redirectUri = `${window.location.origin}/`;

const songs = [
  { title: "My Boo", artist: "Usher", tags: ["R&B", "Mellow", "2000s", "Favorite"] },
  { title: "Japanese Denim", artist: "Daniel Caesar", tags: ["R&B", "Mellow", "Favorite", "Sing"] },
  { title: "Redbone", artist: "Childish Gambino", tags: ["R&B", "Funk", "2010s", "Favorite"] },
  { title: "Nights", artist: "Frank Ocean", tags: ["R&B", "Mellow", "2010s", "Late Night"] },
  { title: "Electric Feel", artist: "MGMT", tags: ["Indie", "Funk", "2000s", "Upbeat"] },
  { title: "Dog Days Are Over", artist: "Florence + The Machine", tags: ["Indie", "2000s", "Upbeat", "Sing"] },
  { title: "Midnight City", artist: "M83", tags: ["Indie", "Electronic", "2010s", "Late Night"] },
  { title: "Levitating", artist: "Dua Lipa", tags: ["Pop", "Funk", "2020s", "Upbeat"] },
  { title: "Blinding Lights", artist: "The Weeknd", tags: ["Pop", "Electronic", "2020s", "Late Night"] },
  { title: "Sunflower", artist: "Post Malone", tags: ["Pop", "Mellow", "2010s", "Favorite"] },
];

const allTags = [...new Set(songs.flatMap((song) => song.tags))].sort();
const selectedTags = new Set();
const excludedTags = new Set();

document.querySelector("#app").innerHTML = `
  <div class="shell">
    <header class="hero">
      <p class="eyebrow">Spotify filtering · proof of concept</p>
      <h1>Find the songs that belong to <em>every</em> tag.</h1>
      <p class="intro">
        Select multiple tags to simulate chaining playlists together. A song stays
        in the results only when it contains every selected tag.
      </p>
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
          <p class="eyebrow">Your music</p>
          <h2 id="playlist-heading">Choose playlists to filter</h2>
        </div>
        <button id="load-playlists" class="button button-secondary" type="button">Refresh</button>
      </div>
      <p class="panel-copy">
        Spotify does not expose its private desktop folder structure to third-party apps.
        Choose one or more playlists instead; only those playlists will be loaded.
      </p>
      <div class="folder-toolbar">
        <button id="create-folder" class="button button-secondary" type="button">New folder</button>
        <span id="folder-status" class="selection-summary">Folders are saved in this browser.</span>
      </div>
      <div id="playlist-list" class="playlist-list"></div>
      <button id="import-tracks" class="button button-primary" type="button">
        Import selected playlist tracks
      </button>
      <p id="playlist-status" class="profile-status"></p>
    </section>

    <section class="demo" aria-labelledby="filter-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Live demo</p>
          <h2 id="filter-heading">Build your filter</h2>
        </div>
        <button id="reset" class="button button-secondary" type="button">Reset</button>
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

    <section class="results" aria-live="polite" aria-labelledby="results-heading">
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
const profileDetails = document.querySelector("#profile-details");
const playlistPanel = document.querySelector("#playlist-panel");
const playlistList = document.querySelector("#playlist-list");
const playlistStatus = document.querySelector("#playlist-status");
const loadPlaylistsButton = document.querySelector("#load-playlists");
const importTracksButton = document.querySelector("#import-tracks");
const createFolderButton = document.querySelector("#create-folder");
const folderStatus = document.querySelector("#folder-status");
let spotifyAccessToken = null;
let availablePlaylists = [];
let selectedPlaylistIds = new Set();
let folders = [];
let spotifyProfileId;
let supabaseUser;

function createCodeVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
  availablePlaylists = [];
  selectedPlaylistIds.clear();
  folders = [];
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

function renderPlaylists() {
  playlistList.replaceChildren();
  if (!availablePlaylists.length) {
    playlistList.textContent = "No playlists were found.";
    return;
  }

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const childrenByParent = new Map();
  folders.forEach((folder) => {
    const children = childrenByParent.get(folder.parentId) || [];
    children.push(folder);
    childrenByParent.set(folder.parentId, children);
  });

  function folderPlaylistIds(folderId) {
    const folder = folderById.get(folderId);
    const ids = new Set(folder.playlistIds);
    (childrenByParent.get(folderId) || []).forEach((child) => {
      folderPlaylistIds(child.id).forEach((id) => ids.add(id));
    });
    return ids;
  }

  function renderFolder(folder, depth = 0) {
    const wrapper = document.createElement("div");
    wrapper.className = "playlist-folder";
    wrapper.style.marginLeft = `${depth * 18}px`;
    const heading = document.createElement("div");
    heading.className = "folder-heading";
    const toggle = document.createElement("button");
    toggle.className = "folder-toggle";
    toggle.type = "button";
    toggle.textContent = folder.collapsed ? "▸" : "▾";
    toggle.setAttribute("aria-label", `Toggle ${folder.name}`);
    toggle.addEventListener("click", () => {
      folder.collapsed = !folder.collapsed;
      saveFolders();
      renderPlaylists();
    });
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const containedIds = folderPlaylistIds(folder.id);
    checkbox.checked = containedIds.size > 0 && [...containedIds].every((id) => selectedPlaylistIds.has(id));
    checkbox.indeterminate = !checkbox.checked && [...containedIds].some((id) => selectedPlaylistIds.has(id));
    checkbox.addEventListener("change", () => {
      containedIds.forEach((id) => checkbox.checked ? selectedPlaylistIds.add(id) : selectedPlaylistIds.delete(id));
      updatePlaylistStatus();
      renderPlaylists();
    });
    const name = document.createElement("strong");
    name.textContent = folder.name;
    const addChild = document.createElement("button");
    addChild.className = "folder-add";
    addChild.type = "button";
    addChild.textContent = "+";
    addChild.title = `Add a folder inside ${folder.name}`;
    addChild.addEventListener("click", () => {
      const childName = window.prompt(`New folder inside ${folder.name}`);
      if (!childName?.trim()) return;
      folders.push({
        id: crypto.randomUUID(),
        name: childName.trim(),
        parentId: folder.id,
        playlistIds: [],
        collapsed: false,
      });
      folder.collapsed = false;
      saveFolders();
      renderPlaylists();
    });
    heading.append(toggle, checkbox, name, addChild);
    wrapper.append(heading);
    if (!folder.collapsed) {
      (childrenByParent.get(folder.id) || []).forEach((child) => wrapper.append(renderFolder(child, depth + 1)));
      availablePlaylists
        .filter((playlist) => folder.playlistIds.includes(playlist.id))
        .forEach((playlist) => wrapper.append(renderPlaylist(playlist, depth + 1)));
    }
    return wrapper;
  }

  function renderPlaylist(playlist, depth = 0) {
    const label = document.createElement("label");
    label.className = "playlist-option";
    label.style.marginLeft = `${depth * 18}px`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedPlaylistIds.has(playlist.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedPlaylistIds.add(playlist.id);
      } else {
        selectedPlaylistIds.delete(playlist.id);
      }
      updatePlaylistStatus();
      renderPlaylists();
    });
    const copy = document.createElement("span");
    copy.className = "playlist-option-copy";
    copy.textContent = playlist.name;
    const count = document.createElement("small");
    count.textContent = `${playlist.tracks.total} tracks`;
    const folderSelect = document.createElement("select");
    folderSelect.className = "folder-select";
    folderSelect.title = "Move playlist to a folder";
    folderSelect.append(new Option("Unfiled", ""));
    folders.forEach((folder) => folderSelect.append(new Option(folder.name, folder.id)));
    const currentFolder = folders.find((folder) => folder.playlistIds.includes(playlist.id));
    folderSelect.value = currentFolder?.id || "";
    folderSelect.addEventListener("change", () => {
      folders.forEach((folder) => {
        folder.playlistIds = folder.playlistIds.filter((id) => id !== playlist.id);
      });
      if (folderSelect.value) folderById.get(folderSelect.value).playlistIds.push(playlist.id);
      saveFolders();
      renderPlaylists();
    });
    label.append(checkbox, copy, count, folderSelect);
    return label;
  }

  folders.filter((folder) => !folder.parentId).forEach((folder) => playlistList.append(renderFolder(folder)));
  availablePlaylists
    .filter((playlist) => !folders.some((folder) => folder.playlistIds.includes(playlist.id)))
    .forEach((playlist) => playlistList.append(renderPlaylist(playlist)));
}

function updatePlaylistStatus() {
  playlistStatus.textContent = selectedPlaylistIds.size
    ? `${selectedPlaylistIds.size} playlist${selectedPlaylistIds.size === 1 ? "" : "s"} selected.`
    : "Select at least one playlist to load its tracks.";
}

function saveFolders() {
  if (spotifyProfileId) localStorage.setItem(`spotify-folders:${spotifyProfileId}`, JSON.stringify(folders));
}

function loadFolders() {
  try {
    folders = JSON.parse(localStorage.getItem(`spotify-folders:${spotifyProfileId}`) || "[]");
  } catch {
    folders = [];
  }
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
    playlistStatus.textContent = availablePlaylists.length
      ? "Select the playlists you want to use for filtering."
      : "No playlists were found.";
  } catch (error) {
    playlistStatus.textContent = error.message;
  } finally {
    loadPlaylistsButton.disabled = false;
  }
}

createFolderButton.addEventListener("click", () => {
  const name = window.prompt("Folder name");
  if (!name?.trim()) return;
  folders.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    parentId: null,
    playlistIds: [],
    collapsed: false,
  });
  saveFolders();
  renderPlaylists();
  folderStatus.textContent = `Created "${name.trim()}". Use each playlist's folder menu to organize it.`;
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
    const count = await saveSelectedPlaylistTracks(
      supabaseUser,
      selectedPlaylists,
      fetchAllPlaylistTracks,
    );
    playlistStatus.textContent = `Imported ${count} track${count === 1 ? "" : "s"} into Supabase.`;
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
    loadFolders();
    supabaseUser = session.user;
    await saveSpotifyUser(supabaseUser, profile);
    renderProfile(profile);
    playlistPanel.hidden = false;
    await loadPlaylists();
    window.history.replaceState({}, document.title, redirectUri);
  } catch (loginError) {
    profileStatus.textContent = loginError.message;
  }
}

loadPlaylistsButton.addEventListener("click", loadPlaylists);
importTracksButton.addEventListener("click", importSelectedTracks);

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
  button.textContent = tag;
  button.dataset.tag = tag;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => toggleTag(tag, type));
  return button;
}

allTags.forEach((tag) => {
  includeContainer.append(createTagButton(tag, "include"));
  excludeContainer.append(createTagButton(tag, "exclude"));
});

function toggleTag(tag, type) {
  const target = type === "include" ? selectedTags : excludedTags;
  const other = type === "include" ? excludedTags : selectedTags;

  if (target.has(tag)) {
    target.delete(tag);
  } else {
    target.add(tag);
    other.delete(tag);
  }

  updateTagButtons();
  renderResults();
}

function updateTagButtons() {
  document.querySelectorAll(".tag").forEach((button) => {
    const { tag } = button.dataset;
    const selected = button.classList.contains("tag-include")
      ? selectedTags.has(tag)
      : excludedTags.has(tag);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  document.querySelector("#include-summary").textContent =
    selectedTags.size ? [...selectedTags].join(" · ") : "None selected";
  document.querySelector("#exclude-summary").textContent =
    excludedTags.size ? [...excludedTags].join(" · ") : "None selected";
}

function filterSongs() {
  return songs.filter((song) => {
    const hasEveryIncludedTag = [...selectedTags].every((tag) => song.tags.includes(tag));
    const hasNoExcludedTag = [...excludedTags].every((tag) => !song.tags.includes(tag));
    return hasEveryIncludedTag && hasNoExcludedTag;
  });
}

function renderResults() {
  const filteredSongs = filterSongs();
  document.querySelector("#result-count").textContent = filteredSongs.length;

  const includeText = selectedTags.size ? [...selectedTags].join(" + ") : "";
  const excludeText = excludedTags.size ? `excluding ${[...excludedTags].join(", ")}` : "";
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
        <p>${song.artist}</p>
      </div>
      <div class="song-tags">${song.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
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

updateTagButtons();
renderResults();
initializeSpotifyProfile();
