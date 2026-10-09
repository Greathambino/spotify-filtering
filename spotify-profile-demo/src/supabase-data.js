import { supabase } from "./supabase";
import { normalizeTrack } from "./track-model";

const QUERY_CHUNK_SIZE = 500;
const RELATIONSHIP_PAGE_SIZE = 1000;
const RELATIONSHIP_PAGE_BATCH_SIZE = 3;

function chunk(values, size = QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
    .select("id, spotify_playlist_id")
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
  const [artistPages, tagPages] = await Promise.all([
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
  ]);
  const failedArtistPage = artistPages.find(({ error }) => error);
  if (failedArtistPage?.error) {
    throw new Error(`Could not load track artists: ${failedArtistPage.error.message}`);
  }
  const failedTagPage = tagPages.find(({ error }) => error);
  if (failedTagPage?.error) {
    throw new Error(`Could not load track tags: ${failedTagPage.error.message}`);
  }
  const artistLinks = artistPages.flatMap(({ data }) => data);
  const tagLinks = tagPages.flatMap(({ data }) => data);
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
  return tracks.map((track) => ({
    ...track,
    customTagIds: customTagIdsByTrackId.get(track.id) || [],
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

export async function saveSelectedPlaylistTracks(
  supabaseUser,
  playlists,
  fetchPlaylistTracks,
  onProgress = () => {},
) {
  const selectedPlaylists = playlists.filter((playlist) => playlist.selected);
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
    .select("id, spotify_playlist_id")
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
  const fetchedPlaylists = await Promise.all(selectedPlaylists.map(async (playlist) => {
    try {
      const items = await fetchPlaylistTracks(playlist.id);
      return {
        playlist,
        items: [...new Map(
          items.filter((item) => item.track?.id).map((item) => [item.track.id, item]),
        ).values()],
      };
    } catch (error) {
      failedPlaylists.push(`${playlist.name}: ${error.message}`);
      return { playlist, items: [] };
    }
  }));
  const uniqueItems = [...new Map(
    fetchedPlaylists.flatMap(({ items }) => items).map((item) => [item.track.id, item]),
  ).values()];
  const uniqueTrackIds = new Set(uniqueItems.map(({ track }) => track.id));
  onProgress({
    uniqueTrackCount: uniqueTrackIds.size,
    importedTrackCount: 0,
    alreadyImportedTrackCount: 0,
    failedTrackCount: 0,
  });
  const existingTracks = [];
  for (const ids of chunk([...uniqueTrackIds])) {
    const { data, error } = await supabase
      .from("tracks")
      .select("id, spotify_track_id, release_year")
      .eq("user_id", supabaseUser.id)
      .in("spotify_track_id", ids);
    if (error) {
      failedPlaylists.push(`Track lookup: ${error.message}`);
      continue;
    }
    existingTracks.push(...data);
  }
  const existingTrackIds = new Set(existingTracks.map((track) => track.spotify_track_id));
  const newTrackRows = uniqueItems
    .filter(({ track }) => !existingTrackIds.has(track.id))
    .map(({ track }) => ({
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
  const insertedTracks = [];
  for (const rows of chunk(newTrackRows)) {
    const { data, error } = await supabase
      .from("tracks")
      .insert(rows)
      .select("id, spotify_track_id, release_year");
    if (error) {
      failedPlaylists.push(`Track insert: ${error.message}`);
      continue;
    }
    insertedTracks.push(...data);
  }
  const trackIds = new Map([...existingTracks, ...insertedTracks]
    .map((track) => [track.spotify_track_id, track.id]));
  for (const rows of chunk(uniqueItems)) {
    const updates = rows
      .map(({ track }) => {
        const id = trackIds.get(track.id);
        return id ? supabase.from("tracks").update({
          title: track.name,
          album_id: track.album?.id || null,
          album_name: track.album?.name || null,
          release_date: track.album?.release_date || null,
          release_date_precision: track.album?.release_date_precision || null,
          duration_ms: track.duration_ms || null,
          disc_number: track.disc_number || null,
          track_number: track.track_number || null,
          explicit: Boolean(track.explicit),
          spotify_uri: track.uri || null,
          spotify_url: track.external_urls?.spotify || null,
          is_local: Boolean(track.is_local),
          available_markets: track.available_markets || null,
        }).eq("id", id) : null;
      })
      .filter(Boolean);
    const results = await Promise.all(updates);
    const failedUpdate = results.find(({ error }) => error);
    if (failedUpdate?.error) failedPlaylists.push(`Track metadata update: ${failedUpdate.error.message}`);
  }
  const releaseYearsByTrackId = new Map();
  uniqueItems.forEach(({ track }) => {
    const releaseYear = getReleaseYear(track);
    const databaseTrackId = trackIds.get(track.id);
    if (releaseYear && databaseTrackId) releaseYearsByTrackId.set(databaseTrackId, releaseYear);
  });
  for (const rows of chunk([...releaseYearsByTrackId])) {
    const updates = rows.map(([id, releaseYear]) =>
      supabase.from("tracks").update({ release_year: releaseYear }).eq("id", id));
    const results = await Promise.all(updates);
    const failedUpdate = results.find(({ error }) => error);
    if (failedUpdate?.error) {
      failedPlaylists.push(`Track release year update: ${failedUpdate.error.message}`);
    }
  }
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
    } catch (error) {
      failedPlaylists.push(`Content tag processing: ${error.message}`);
    }
  }
  const artistRows = uniqueItems.flatMap(({ track }) =>
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
  for (const rows of chunk(uniqueArtistRows)) {
    const ids = rows.map((artist) => artist.spotify_artist_id);
    const { data: existing, error: lookupError } = await supabase
      .from("artists")
      .select("id, spotify_artist_id")
      .eq("user_id", supabaseUser.id)
      .in("spotify_artist_id", ids);
    if (lookupError) {
      failedPlaylists.push(`Artist lookup: ${lookupError.message}`);
      continue;
    }
    existing.forEach((artist) => artistIds.set(artist.spotify_artist_id, artist.id));
    const newRows = rows.filter((artist) => !artistIds.has(artist.spotify_artist_id));
    if (newRows.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("artists")
        .insert(newRows)
        .select("id, spotify_artist_id");
      if (insertError) {
        failedPlaylists.push(`Artist insert: ${insertError.message}`);
        continue;
      }
      inserted.forEach((artist) => artistIds.set(artist.spotify_artist_id, artist.id));
    }
  }
  for (const { playlist, items } of fetchedPlaylists) {
    const databasePlaylistId = databasePlaylistIds.get(playlist.id);
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
    });
    const { error } = await supabase
      .from("playlist_tracks")
      .upsert(playlistTrackRows, { onConflict: "playlist_id,track_id" });
    if (error) failedPlaylists.push(`${playlist.name}: ${error.message}`);
  }
  const trackArtistRows = uniqueItems.flatMap(({ track }) => {
    const trackId = trackIds.get(track.id);
    return trackId ? (track.artists || []).flatMap((artist, artistOrder) => {
      const artistId = artistIds.get(artist.id);
      return artistId ? [{ track_id: trackId, artist_id: artistId, artist_order: artistOrder }] : [];
    }) : [];
  });
  for (const rows of chunk(trackArtistRows)) {
    const { error } = await supabase
      .from("track_artists")
      .upsert(rows, { onConflict: "track_id,artist_id" });
    if (error) failedPlaylists.push(`Track artist links: ${error.message}`);
  }
  const snapshotRows = uniqueItems
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
  for (const rows of chunk(snapshotRows)) {
    const { error } = await supabase
      .from("spotify_track_snapshots")
      .insert(rows);
    if (error) failedPlaylists.push(`Track snapshot insert: ${error.message}`);
  }
  const importedTrackIds = new Set(insertedTracks.map((track) => track.spotify_track_id));
  const alreadyImportedTrackIds = new Set(existingTracks.map((track) => track.spotify_track_id));
  onProgress({
    uniqueTrackCount: uniqueTrackIds.size,
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
