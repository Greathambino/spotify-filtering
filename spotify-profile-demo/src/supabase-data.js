import { supabase } from "./supabase";
import { normalizeTrack } from "./track-model";

const QUERY_CHUNK_SIZE = 500;
const RELATIONSHIP_PAGE_SIZE = 1000;
const RELATIONSHIP_PAGE_BATCH_SIZE = 3;
const SUPABASE_READ_CONCURRENCY = 6;
const SUPABASE_WRITE_CONCURRENCY = 6;

function chunk(values, size = QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function runWithConcurrency(values, concurrency, worker) {
  const results = [];
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runNext),
  );
  return results;
}

function mapBy(items, key) {
  return new Map(items.map((item) => [key(item), item]));
}

async function upsertTagsForUser(userId, names) {
  const uniqueNames = [...new Set(names)];
  if (!uniqueNames.length) return new Map();

  const { data: upsertedTags, error: upsertError } = await supabase
    .from("tags")
    .upsert(
      uniqueNames.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" },
    )
    .select("id, name");
  if (upsertError) throw new Error(`Could not create tags: ${upsertError.message}`);

  const { data: tags, error: lookupError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("user_id", userId)
    .in("name", uniqueNames);
  if (lookupError) throw new Error(`Could not load tags: ${lookupError.message}`);

  return new Map((tags?.length ? tags : upsertedTags || []).map((tag) => [tag.name, tag.id]));
}

async function upsertTrackTagLinks(trackNamesById, tagIdsByName) {
  const links = [...trackNamesById]
    .map(([trackId, name]) => ({ track_id: trackId, tag_id: tagIdsByName.get(name) }))
    .filter((link) => link.track_id && link.tag_id);
  for (const rows of chunk(links)) {
    const { error } = await supabase
      .from("track_tags")
      .upsert(rows, { onConflict: "track_id,tag_id" });
    if (error) throw new Error(`Could not assign tags: ${error.message}`);
  }
}

export async function saveSpotifyUser(supabaseUser, spotifyProfile) {
  const { error } = await supabase.from("users").upsert(
    {
      id: supabaseUser.id,
      spotify_user_id: spotifyProfile.id,
      display_name: spotifyProfile.display_name || null,
      profile_url: spotifyProfile.external_urls?.spotify || null,
      image_url: spotifyProfile.images?.[0]?.url || null,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Could not save your profile: ${error.message}`);
}

export async function savePlaylistCatalog(supabaseUser, playlists) {
  const rows = [...new Map(playlists.map((playlist) => [playlist.id, playlist])).values()].map((playlist) => ({
    user_id: supabaseUser.id,
    spotify_playlist_id: playlist.id,
    name: playlist.name,
    description: playlist.description || null,
    image_url: playlist.images?.[0]?.url || null,
    owner_spotify_user_id: playlist.owner?.id || null,
    track_count: playlist.tracks?.total || 0,
    spotify_url: playlist.external_urls?.spotify || null,
  }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("playlists")
    .upsert(rows, { onConflict: "user_id,spotify_playlist_id" });
  if (error) throw new Error(`Could not save playlists: ${error.message}`);
}

export async function loadPlaylistSets(supabaseUser, playlists) {
  const { data: sets, error: setError } = await supabase
    .from("playlist_sets")
    .select("id, name")
    .eq("user_id", supabaseUser.id)
    .order("created_at");
  if (setError) throw new Error(`Could not load playlist sets: ${setError.message}`);

  const { data: savedPlaylists, error: playlistError } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, snapshot_id")
    .eq("user_id", supabaseUser.id)
    .in("spotify_playlist_id", playlists.map((playlist) => playlist.id));
  if (playlistError) throw new Error(`Could not load saved playlists: ${playlistError.message}`);

  const savedPlaylistsById = mapBy(savedPlaylists, (playlist) => playlist.id);
  const { data: links, error: linkError } = await supabase
    .from("playlist_set_playlists")
    .select("set_id, playlist_id");
  if (linkError) throw new Error(`Could not load playlist set memberships: ${linkError.message}`);

  const playlistIdsBySetId = new Map();
  links.forEach((link) => {
    const ids = playlistIdsBySetId.get(link.set_id) || [];
    ids.push(link.playlist_id);
    playlistIdsBySetId.set(link.set_id, ids);
  });
  return sets.map((set) => ({
    id: set.id,
    name: set.name,
    playlistIds: (playlistIdsBySetId.get(set.id) || [])
      .map((id) => savedPlaylistsById.get(id)?.spotify_playlist_id)
      .filter(Boolean),
  }));
}

export async function loadTracksForPlaylists(supabaseUser, spotifyPlaylistIds) {
  if (!spotifyPlaylistIds.length) return [];

  const { data: playlists, error: playlistError } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id")
    .eq("user_id", supabaseUser.id)
    .in("spotify_playlist_id", spotifyPlaylistIds);
  if (playlistError) throw new Error(`Could not load source playlists: ${playlistError.message}`);

  const databasePlaylistIds = playlists.map((playlist) => playlist.id);
  if (!databasePlaylistIds.length) return [];

  const links = [];
  for (let batchOffset = 0; ; batchOffset += RELATIONSHIP_PAGE_SIZE * RELATIONSHIP_PAGE_BATCH_SIZE) {
    const pages = await Promise.all(
      Array.from({ length: RELATIONSHIP_PAGE_BATCH_SIZE }, (_, pageIndex) => {
        const offset = batchOffset + pageIndex * RELATIONSHIP_PAGE_SIZE;
        return supabase
          .from("playlist_tracks")
          .select("playlist_id, position, tracks!inner(id, spotify_track_id, title, album_name)")
          .in("playlist_id", databasePlaylistIds)
          .order("playlist_id")
          .order("position")
          .range(offset, offset + RELATIONSHIP_PAGE_SIZE - 1);
      }),
    );
    const failedPage = pages.find(({ error }) => error);
    if (failedPage?.error) {
      throw new Error(`Could not load imported tracks: ${failedPage.error.message}`);
    }
    const pageLengths = pages.map(({ data }) => data.length);
    pages.forEach(({ data }) => links.push(...data));
    if (pageLengths.some((length) => length < RELATIONSHIP_PAGE_SIZE)) break;
  }

  const spotifyIdsByDatabaseId = new Map(
    playlists.map((playlist) => [playlist.id, playlist.spotify_playlist_id]),
  );
  const tracksById = new Map();
  links.forEach((link) => {
    const track = link.tracks;
    const existing = tracksById.get(track.id);
    if (existing) {
      existing.sourcePlaylistIds.push(spotifyIdsByDatabaseId.get(link.playlist_id));
      return;
    }
    tracksById.set(track.id, normalizeTrack({
      id: track.id,
      spotifyTrackId: track.spotify_track_id,
      title: track.title,
      artistNames: [],
      albumName: track.album_name,
      sourcePlaylistIds: [spotifyIdsByDatabaseId.get(link.playlist_id)],
    }));
  });
  const tracks = [...tracksById.values()].map((track) => ({
    ...track,
    sourcePlaylistIds: [...new Set(track.sourcePlaylistIds)],
  }));
  if (!tracks.length) return tracks;
  const trackIds = tracks.map((track) => track.id);
  const [artistPages, tagPages, externalTagPages] = await Promise.all([
    Promise.all(chunk(trackIds).map((ids) =>
      supabase
        .from("track_artists")
        .select("track_id, artist_order, artists!inner(name)")
        .in("track_id", ids))),
    Promise.all(chunk(trackIds).map((ids) =>
      supabase
        .from("track_tags")
        .select("track_id, tags!inner(id, name)")
        .in("track_id", ids))),
    Promise.all(chunk(trackIds).map((ids) =>
      supabase
        .from("external_track_tags")
        .select("track_id, tag_name, normalized_name, source, popularity")
        .eq("user_id", supabaseUser.id)
        .eq("provider", "lastfm")
        .in("track_id", ids)
        .order("popularity", { ascending: false }))),
  ]);
  const failedArtistPage = artistPages.find(({ error }) => error);
  if (failedArtistPage?.error) {
    throw new Error(`Could not load track artists: ${failedArtistPage.error.message}`);
  }
  const failedTagPage = tagPages.find(({ error }) => error);
  if (failedTagPage?.error) {
    throw new Error(`Could not load track tags: ${failedTagPage.error.message}`);
  }
  const failedExternalTagPage = externalTagPages.find(({ error }) => error);
  if (failedExternalTagPage?.error) {
    throw new Error(`Could not load Last.fm tags: ${failedExternalTagPage.error.message}`);
  }
  const artistLinks = artistPages.flatMap(({ data }) => data);
  const tagLinks = tagPages.flatMap(({ data }) => data);
  const externalTagLinks = externalTagPages.flatMap(({ data }) => data);
  const artistNamesByTrackId = new Map();
  artistLinks.forEach((link) => {
    const names = artistNamesByTrackId.get(link.track_id) || [];
    names.push({ order: link.artist_order, name: link.artists?.name });
    artistNamesByTrackId.set(link.track_id, names);
  });
  tracks.forEach((track) => {
    track.artistNames = (artistNamesByTrackId.get(track.id) || [])
      .sort((left, right) => left.order - right.order)
      .map(({ name }) => name)
      .filter(Boolean);
  });
  const customTagIdsByTrackId = new Map();
  tagLinks.forEach((link) => {
    const tagIds = customTagIdsByTrackId.get(link.track_id) || [];
    tagIds.push(link.tags.id);
    customTagIdsByTrackId.set(link.track_id, tagIds);
  });
  const externalTagsByTrackId = new Map();
  externalTagLinks.forEach((link) => {
  if (/^(?:\d{2}s|(?:19|20)\d{2}s?)$/.test(link.normalized_name)) return;
  const tagId = `external:${link.normalized_name}`;
    const tags = externalTagsByTrackId.get(link.track_id) || [];
    tags.push({
      id: tagId,
      name: link.tag_name,
      source: link.source,
      popularity: link.popularity,
    });
    externalTagsByTrackId.set(link.track_id, tags);
    const tagIds = customTagIdsByTrackId.get(link.track_id) || [];
    if (!tagIds.includes(tagId)) tagIds.push(tagId);
    customTagIdsByTrackId.set(link.track_id, tagIds);
  });
  return tracks.map((track) => ({
    ...track,
    customTagIds: customTagIdsByTrackId.get(track.id) || [],
    externalTags: externalTagsByTrackId.get(track.id) || [],
  }));
}

export async function loadUserTags(supabaseUser) {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .eq("user_id", supabaseUser.id)
    .order("name");
  if (error) throw new Error(`Could not load tags: ${error.message}`);
  return data;
}

export async function createUserTag(supabaseUser, name) {
  const { data, error } = await supabase
    .from("tags")
    .upsert({ user_id: supabaseUser.id, name }, { onConflict: "user_id,name" })
    .select("id, name")
    .single();
  if (error) throw new Error(`Could not create tag: ${error.message}`);
  return data;
}

export async function setTrackTag(trackId, tagId, assigned) {
  if (assigned) {
    const { error } = await supabase
      .from("track_tags")
      .upsert({ track_id: trackId, tag_id: tagId }, { onConflict: "track_id,tag_id" });
    if (error) throw new Error(`Could not add tag: ${error.message}`);
    return;
  }
  const { error } = await supabase
    .from("track_tags")
    .delete()
    .eq("track_id", trackId)
    .eq("tag_id", tagId);
  if (error) throw new Error(`Could not remove tag: ${error.message}`);
}

export async function createPlaylistJob(supabaseUser, playlistName) {
  const { data, error } = await supabase
    .from("playlist_jobs")
    .insert({
      user_id: supabaseUser.id,
      status: "queued",
      error_message: `Creating playlist: ${playlistName}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not start playlist job: ${error.message}`);
  return data.id;
}

export async function updatePlaylistJob(jobId, status, spotifyPlaylistId = null, errorMessage = null) {
  const { error } = await supabase
    .from("playlist_jobs")
    .update({
      status,
      spotify_playlist_id: spotifyPlaylistId,
      error_message: errorMessage,
      completed_at: status === "complete" || status === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`Could not update playlist job: ${error.message}`);
}

export async function savePlaylistSet(supabaseUser, set) {
  const { data: duplicateSet, error: duplicateError } = await supabase
    .from("playlist_sets")
    .select("id")
    .eq("user_id", supabaseUser.id)
    .eq("name", set.name)
    .neq("id", set.id)
    .maybeSingle();
  if (duplicateError) {
    throw new Error(`Could not check playlist set name: ${duplicateError.message}`);
  }
  if (duplicateSet) {
    throw new Error(`A playlist set named "${set.name}" already exists.`);
  }

  const { data: savedSet, error: setError } = await supabase
    .from("playlist_sets")
    .upsert(
      { id: set.id, user_id: supabaseUser.id, name: set.name },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  if (setError) throw new Error(`Could not save playlist set: ${setError.message}`);

  const { error: deleteError } = await supabase
    .from("playlist_set_playlists")
    .delete()
    .eq("set_id", savedSet.id);
  if (deleteError) throw new Error(`Could not update playlist set: ${deleteError.message}`);

  if (!set.playlistIds.length) return;
  const { data: playlists, error: playlistError } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id")
    .eq("user_id", supabaseUser.id)
    .in("spotify_playlist_id", set.playlistIds);
  if (playlistError) throw new Error(`Could not find playlists for set: ${playlistError.message}`);

  const { error: linkError } = await supabase
    .from("playlist_set_playlists")
    .insert(playlists.map((playlist) => ({ set_id: savedSet.id, playlist_id: playlist.id })));
  if (linkError) throw new Error(`Could not save playlist set memberships: ${linkError.message}`);
}

export async function enqueueLastfmEnrichment(supabaseUser, trackIds) {
  const uniqueTrackIds = [...new Set(trackIds)];
  if (!uniqueTrackIds.length) {
    return { queuedCount: 0, alreadyQueriedCount: 0, pendingCount: 0 };
  }
  const existingRows = [];
  for (const ids of chunk(uniqueTrackIds)) {
    const { data, error } = await supabase
      .from("lastfm_enrichment_queue")
      .select("track_id, status")
      .eq("user_id", supabaseUser.id)
      .in("track_id", ids);
    if (error) throw new Error(`Could not check Last.fm query history: ${error.message}`);
    existingRows.push(...(data || []));
  }
  const existingByTrackId = new Map(existingRows.map((row) => [row.track_id, row.status]));
  const { data: localTracks, error: localTrackError } = await supabase
    .from("tracks")
    .select("id")
    .eq("user_id", supabaseUser.id)
    .eq("is_local", true)
    .in("id", uniqueTrackIds);
  if (localTrackError) {
    throw new Error(`Could not check Last.fm eligibility: ${localTrackError.message}`);
  }
  const localTrackIds = new Set((localTracks || []).map((track) => track.id));
  const eligibleTrackIds = uniqueTrackIds.filter((trackId) => !localTrackIds.has(trackId));
  const newTrackIds = eligibleTrackIds.filter((trackId) => !existingByTrackId.has(trackId));
  const newTrackIdSet = new Set(newTrackIds);
  const rows = newTrackIds.map((trackId) => ({
    user_id: supabaseUser.id,
    track_id: trackId,
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("lastfm_enrichment_queue")
      .insert(rows);
    if (error) throw new Error(`Could not queue Last.fm enrichment: ${error.message}`);
  }
  return {
    queuedCount: newTrackIds.length,
    alreadyQueriedCount: eligibleTrackIds.filter((trackId) =>
      ["complete", "failed"].includes(existingByTrackId.get(trackId))).length,
    pendingCount: eligibleTrackIds.filter((trackId) =>
      ["queued", "running"].includes(existingByTrackId.get(trackId))).length,
    ineligibleCount: localTrackIds.size,
    workTrackIds: eligibleTrackIds.filter((trackId) =>
      ["queued", "running"].includes(existingByTrackId.get(trackId))
      || newTrackIdSet.has(trackId)),
  };
}

export async function saveSelectedPlaylistTracks(
  supabaseUser,
  playlists,
  fetchPlaylistTracks,
  onProgress = () => {},
) {
  const selectedPlaylists = [...new Map(
    playlists
      .filter((playlist) => playlist.selected)
      .map((playlist) => [playlist.id, playlist]),
  ).values()];
  if (!selectedPlaylists.length) {
    return {
      uniqueTrackCount: 0,
      importedTrackCount: 0,
      alreadyImportedTrackCount: 0,
      failedTrackCount: 0,
      failedPlaylists: [],
    };
  }

  const { data: savedPlaylists, error: playlistError } = await supabase
    .from("playlists")
    .select("id, spotify_playlist_id, snapshot_id")
    .eq("user_id", supabaseUser.id)
    .in(
      "spotify_playlist_id",
      selectedPlaylists.map((playlist) => playlist.id),
    );
  if (playlistError) {
    throw new Error(`Could not find saved playlists: ${playlistError.message}`);
  }

  const databasePlaylistIds = new Map(
    savedPlaylists.map((playlist) => [playlist.spotify_playlist_id, playlist.id]),
  );
  const failedPlaylists = [];
  const fetchedPlaylists = [];
  let nextPlaylistIndex = 0;
  let fetchedPlaylistCount = 0;
  async function fetchNextPlaylist() {
    while (nextPlaylistIndex < selectedPlaylists.length) {
      const playlist = selectedPlaylists[nextPlaylistIndex];
      nextPlaylistIndex += 1;
      const savedPlaylist = savedPlaylists.find(
        (candidate) => candidate.spotify_playlist_id === playlist.id,
      );
      if (savedPlaylist?.snapshot_id && savedPlaylist.snapshot_id === playlist.snapshot_id) {
        fetchedPlaylistCount += 1;
        onProgress({
          phase: "fetching",
          playlistsCompleted: fetchedPlaylistCount,
          playlistsTotal: selectedPlaylists.length,
          uniqueTrackCount: 0,
          processedTrackCount: 0,
          importedTrackCount: 0,
          alreadyImportedTrackCount: 0,
          failedTrackCount: 0,
          cachedPlaylist: true,
        });
        continue;
      }
      try {
        const items = await fetchPlaylistTracks(playlist.id);
        fetchedPlaylists.push({
          playlist,
          items: [...new Map(
            items.filter((item) => item.track?.id).map((item) => [item.track.id, item]),
          ).values()],
          fetched: true,
        });
        fetchedPlaylistCount += 1;
        onProgress({
          phase: "fetching",
          playlistsCompleted: fetchedPlaylistCount,
          playlistsTotal: selectedPlaylists.length,
          uniqueTrackCount: 0,
          processedTrackCount: 0,
          importedTrackCount: 0,
          alreadyImportedTrackCount: 0,
          failedTrackCount: 0,
        });
      } catch (error) {
        failedPlaylists.push(`${playlist.name}: ${error.message}`);
        fetchedPlaylists.push({ playlist, items: [], fetched: false });
        fetchedPlaylistCount += 1;
        onProgress({
          phase: "fetching",
          playlistsCompleted: fetchedPlaylistCount,
          playlistsTotal: selectedPlaylists.length,
          uniqueTrackCount: 0,
          processedTrackCount: 0,
          importedTrackCount: 0,
          alreadyImportedTrackCount: 0,
          failedTrackCount: 0,
        });
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(3, selectedPlaylists.length) },
      () => fetchNextPlaylist(),
    ),
  );
  const fetchedPlaylistMetadata = fetchedPlaylists
    .filter(({ fetched }) => fetched)
    .map(({ playlist }) => playlist);
  let snapshotError = null;
  if (fetchedPlaylistMetadata.length) {
    ({ error: snapshotError } = await supabase
      .from("playlists")
      .upsert(
        fetchedPlaylistMetadata.map((playlist) => ({
        user_id: supabaseUser.id,
        spotify_playlist_id: playlist.id,
        name: playlist.name,
        description: playlist.description || null,
        image_url: playlist.images?.[0]?.url || null,
        owner_spotify_user_id: playlist.owner?.id || null,
        track_count: playlist.tracks?.total || 0,
        snapshot_id: playlist.snapshot_id || null,
        spotify_url: playlist.external_urls?.spotify || null,
        })),
        { onConflict: "user_id,spotify_playlist_id" },
      ));
  }
  if (snapshotError) {
    failedPlaylists.push(`Playlist snapshot cache: ${snapshotError.message}`);
  }
  const successfullyFetchedPlaylists = fetchedPlaylists.filter(({ fetched }) => fetched);
  if (!successfullyFetchedPlaylists.length) {
    return {
      uniqueTrackCount: 0,
      importedTrackCount: 0,
      alreadyImportedTrackCount: 0,
      failedTrackCount: 0,
      failedPlaylists,
    };
  }
  const uniqueItems = [...new Map(
    successfullyFetchedPlaylists
      .flatMap(({ items }) => items)
      .map((item) => [item.track.id, item]),
  ).values()];
  const uniqueTrackIds = new Set(uniqueItems.map(({ track }) => track.id));
  onProgress({
    phase: "persisting",
    uniqueTrackCount: uniqueTrackIds.size,
    processedTrackCount: 0,
    importedTrackCount: 0,
    alreadyImportedTrackCount: 0,
    failedTrackCount: 0,
  });
  const trackIdChunks = chunk([...uniqueTrackIds]);
  const existingTrackResults = await runWithConcurrency(
    trackIdChunks,
    SUPABASE_READ_CONCURRENCY,
    async (ids) => supabase
      .from("tracks")
      .select("id, spotify_track_id, release_year")
      .eq("user_id", supabaseUser.id)
      .in("spotify_track_id", ids),
  );
  const existingTracks = [];
  existingTrackResults.forEach(({ data, error }) => {
    if (error) {
      failedPlaylists.push(`Track lookup: ${error.message}`);
    } else {
      existingTracks.push(...data);
    }
  });
  const existingTrackIds = new Set(existingTracks.map((track) => track.spotify_track_id));
  const newItems = uniqueItems.filter(({ track }) => !existingTrackIds.has(track.id));
  const reportPersistenceProgress = (progressPercent, processedTrackCount) => onProgress({
    phase: "persisting",
    progressPercent,
    uniqueTrackCount: uniqueTrackIds.size,
    processedTrackCount,
    importedTrackCount: Math.max(0, processedTrackCount - existingTracks.length),
    alreadyImportedTrackCount: existingTracks.length,
    failedTrackCount: 0,
  });
  const trackRows = newItems.map(({ track }) => ({
      user_id: supabaseUser.id,
      spotify_track_id: track.id,
      title: track.name,
      album_id: track.album?.id || null,
      album_name: track.album?.name || null,
      release_date: track.album?.release_date || null,
      release_date_precision: track.album?.release_date_precision || null,
      release_year: getReleaseYear(track),
      duration_ms: track.duration_ms || null,
      disc_number: track.disc_number || null,
      track_number: track.track_number || null,
      explicit: Boolean(track.explicit),
      spotify_uri: track.uri || null,
      spotify_url: track.external_urls?.spotify || null,
      is_local: Boolean(track.is_local),
      available_markets: track.available_markets || null,
  }));
  const trackUpsertResults = await runWithConcurrency(
    chunk(trackRows),
    SUPABASE_WRITE_CONCURRENCY,
    async (rows) => supabase
      .from("tracks")
      .upsert(rows, { onConflict: "user_id,spotify_track_id" })
      .select("id, spotify_track_id, release_year"),
  );
  const savedTracks = [];
  trackUpsertResults.forEach(({ data, error }) => {
    if (error) {
      failedPlaylists.push(`Track metadata batch: ${error.message}`);
    } else {
      savedTracks.push(...data);
    }
  });
  reportPersistenceProgress(45, existingTracks.length + savedTracks.length);
  const trackIds = new Map([...existingTracks, ...savedTracks]
    .map((track) => [track.spotify_track_id, track.id]));
  const releaseYearsByTrackId = new Map();
  uniqueItems.forEach(({ track }) => {
    const releaseYear = getReleaseYear(track);
    const databaseTrackId = trackIds.get(track.id);
    if (releaseYear && databaseTrackId) releaseYearsByTrackId.set(databaseTrackId, releaseYear);
  });
  const decadeNamesByTrackId = new Map();
  releaseYearsByTrackId.forEach((releaseYear, databaseTrackId) => {
    const decadeStart = Math.floor(releaseYear / 10) * 10;
    decadeNamesByTrackId.set(databaseTrackId, `${decadeStart}s`);
  });
  const decadeNames = [...new Set(decadeNamesByTrackId.values())];
  if (decadeNames.length) {
    try {
      const decadeTagIdsByName = await upsertTagsForUser(supabaseUser.id, decadeNames);
      await upsertTrackTagLinks(decadeNamesByTrackId, decadeTagIdsByName);
    } catch (error) {
      failedPlaylists.push(`Decade tag processing: ${error.message}`);
    }
  }
  const contentTagNameByTrackId = new Map();
  uniqueItems.forEach(({ track }) => {
    const databaseTrackId = trackIds.get(track.id);
    if (databaseTrackId) {
      contentTagNameByTrackId.set(databaseTrackId, track.explicit ? "Explicit" : "Clean");
    }
  });
  const contentTagNames = [...new Set(contentTagNameByTrackId.values())];
  if (contentTagNames.length) {
    try {
      const contentTagIdsByName = await upsertTagsForUser(supabaseUser.id, contentTagNames);
      await upsertTrackTagLinks(contentTagNameByTrackId, contentTagIdsByName);
      for (const [name] of contentTagIdsByName) {
        const oppositeTagId = contentTagIdsByName.get(name === "Explicit" ? "Clean" : "Explicit");
        const trackIdsForName = [...contentTagNameByTrackId]
          .filter(([, trackName]) => trackName === name)
          .map(([trackId]) => trackId);
        if (!oppositeTagId) continue;
        for (const trackIdChunk of chunk(trackIdsForName)) {
          const { error } = await supabase
            .from("track_tags")
            .delete()
            .in("track_id", trackIdChunk)
            .eq("tag_id", oppositeTagId);
          if (error) throw new Error(`Could not clean up stale content tags: ${error.message}`);
        }
      }
      reportPersistenceProgress(55, existingTracks.length + savedTracks.length);
    } catch (error) {
      failedPlaylists.push(`Content tag processing: ${error.message}`);
    }
  }
  const artistRows = newItems.flatMap(({ track }) =>
    (track.artists || []).map((artist) => ({
      user_id: supabaseUser.id,
      spotify_artist_id: artist.id,
      name: artist.name,
      spotify_url: artist.external_urls?.spotify || null,
      image_url: artist.images?.[0]?.url || null,
    })));
  const uniqueArtistRows = [...new Map(
    artistRows.map((artist) => [artist.spotify_artist_id, artist]),
  ).values()];
  const artistIds = new Map();
  const artistResults = await runWithConcurrency(
    chunk(uniqueArtistRows),
    SUPABASE_READ_CONCURRENCY,
    async (rows) => {
      const ids = rows.map((artist) => artist.spotify_artist_id);
      const { data: existing, error: lookupError } = await supabase
        .from("artists")
        .select("id, spotify_artist_id")
        .eq("user_id", supabaseUser.id)
        .in("spotify_artist_id", ids);
      if (lookupError) return { error: `Artist lookup: ${lookupError.message}` };
      const existingIds = new Set(existing.map((artist) => artist.spotify_artist_id));
      const newRows = rows.filter((artist) => !existingIds.has(artist.spotify_artist_id));
      if (!newRows.length) return { data: existing };
      const { data: inserted, error: insertError } = await supabase
        .from("artists")
        .insert(newRows)
        .select("id, spotify_artist_id");
      if (insertError) return { error: `Artist insert: ${insertError.message}` };
      return { data: [...existing, ...inserted] };
    },
  );
  artistResults.forEach(({ data, error }) => {
    if (error) {
      failedPlaylists.push(error);
      return;
    }
    data.forEach((artist) => artistIds.set(artist.spotify_artist_id, artist.id));
  });
  reportPersistenceProgress(65, existingTracks.length + savedTracks.length);
  await runWithConcurrency(
    successfullyFetchedPlaylists,
    SUPABASE_WRITE_CONCURRENCY,
    async ({ playlist, items }) => {
    const databasePlaylistId = databasePlaylistIds.get(playlist.id);
    if (!databasePlaylistId) {
      failedPlaylists.push(`${playlist.name}: saved playlist record not found`);
      return;
    }
    const { error: deleteRelationshipsError } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", databasePlaylistId);
    if (deleteRelationshipsError) {
      failedPlaylists.push(
        `${playlist.name}: could not reconcile existing tracks: ${deleteRelationshipsError.message}`,
      );
      reportPersistenceProgress(80, existingTracks.length + savedTracks.length);
      return;
    }
    const playlistTrackRows = items.flatMap(({ track }, position) => {
      const trackId = trackIds.get(track.id);
      const item = items[position];
      return trackId ? [{
        playlist_id: databasePlaylistId,
        track_id: trackId,
        position,
        added_at: item.added_at || null,
        added_by_spotify_user_id: item.added_by?.id || null,
      }] : [];
      },
    );
    const { error } = await supabase
      .from("playlist_tracks")
      .upsert(playlistTrackRows, { onConflict: "playlist_id,track_id" });
    if (error) failedPlaylists.push(`${playlist.name}: ${error.message}`);
  });
  const trackArtistResults = await runWithConcurrency(
    chunk(newItems.flatMap(({ track }) => {
      const trackId = trackIds.get(track.id);
      return trackId ? (track.artists || []).flatMap((artist, artistOrder) => {
        const artistId = artistIds.get(artist.id);
        return artistId ? [{ track_id: trackId, artist_id: artistId, artist_order: artistOrder }] : [];
      }) : [];
    })),
    SUPABASE_WRITE_CONCURRENCY,
    (rows) => supabase
      .from("track_artists")
      .upsert(rows, { onConflict: "track_id,artist_id" }),
  );
  trackArtistResults.forEach(({ error }) => {
    if (error) failedPlaylists.push(`Track artist links: ${error.message}`);
  });
  reportPersistenceProgress(90, existingTracks.length + savedTracks.length);
  const snapshotRows = newItems
    .map(({ track }) => {
      const trackId = trackIds.get(track.id);
      return trackId ? {
        user_id: supabaseUser.id,
        track_id: trackId,
        spotify_track_id: track.id,
        payload: track,
      } : null;
    })
    .filter(Boolean);
  const snapshotResults = await runWithConcurrency(
    chunk(snapshotRows),
    SUPABASE_WRITE_CONCURRENCY,
    (rows) => supabase
      .from("spotify_track_snapshots")
      .insert(rows),
  );
  snapshotResults.forEach(({ error }) => {
    if (error) failedPlaylists.push(`Track snapshot insert: ${error.message}`);
  });
  reportPersistenceProgress(95, existingTracks.length + savedTracks.length);
  const importedTrackIds = new Set(
    savedTracks
      .map((track) => track.spotify_track_id)
      .filter((spotifyTrackId) => !existingTrackIds.has(spotifyTrackId)),
  );
  const alreadyImportedTrackIds = new Set(existingTracks.map((track) => track.spotify_track_id));
  onProgress({
    phase: "complete",
    uniqueTrackCount: uniqueTrackIds.size,
    processedTrackCount: importedTrackIds.size + alreadyImportedTrackIds.size,
    importedTrackCount: importedTrackIds.size,
    alreadyImportedTrackCount: alreadyImportedTrackIds.size,
    failedTrackCount: Math.max(0, uniqueTrackIds.size - importedTrackIds.size - alreadyImportedTrackIds.size),
  });

  return {
    uniqueTrackCount: uniqueTrackIds.size,
    importedTrackCount: importedTrackIds.size,
    alreadyImportedTrackCount: alreadyImportedTrackIds.size,
    failedTrackCount: Math.max(
      0,
      uniqueTrackIds.size - importedTrackIds.size - alreadyImportedTrackIds.size,
    ),
    failedPlaylists,
  };
}

function getReleaseYear(track) {
  const releaseYear = Number.parseInt(track.album?.release_date?.slice(0, 4), 10);
  return Number.isInteger(releaseYear) && releaseYear >= 1900 && releaseYear <= new Date().getFullYear()
    ? releaseYear
    : null;
}
