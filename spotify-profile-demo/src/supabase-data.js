import { supabase } from "./supabase";

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

export async function saveSelectedPlaylistTracks(
  supabaseUser,
  playlists,
  fetchPlaylistTracks,
) {
  const selectedPlaylists = playlists.filter((playlist) => playlist.selected);
  if (!selectedPlaylists.length) return 0;

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
  let importedTrackCount = 0;

  for (const playlist of selectedPlaylists) {
    const databasePlaylistId = databasePlaylistIds.get(playlist.id);
    if (!databasePlaylistId) continue;

    const items = await fetchPlaylistTracks(playlist.id);
    const validItems = items.filter((item) => item.track?.id);
    if (!validItems.length) continue;

    const trackRows = validItems.map(({ track }) => ({
      user_id: supabaseUser.id,
      spotify_track_id: track.id,
      title: track.name,
      album_id: track.album?.id || null,
      album_name: track.album?.name || null,
      explicit: Boolean(track.explicit),
      spotify_uri: track.uri || null,
    }));
    const { data: savedTracks, error: trackError } = await supabase
      .from("tracks")
      .upsert(trackRows, { onConflict: "user_id,spotify_track_id" })
      .select("id, spotify_track_id");
    if (trackError) throw new Error(`Could not save tracks: ${trackError.message}`);

    const trackIds = new Map(savedTracks.map((track) => [track.spotify_track_id, track.id]));
    const artistRows = validItems.flatMap(({ track }) =>
      (track.artists || []).map((artist) => ({
        user_id: supabaseUser.id,
        spotify_artist_id: artist.id,
        name: artist.name,
      })),
    );
    const uniqueArtistRows = [...new Map(
      artistRows.map((artist) => [artist.spotify_artist_id, artist]),
    ).values()];
    const { data: savedArtists, error: artistError } = await supabase
      .from("artists")
      .upsert(uniqueArtistRows, { onConflict: "user_id,spotify_artist_id" })
      .select("id, spotify_artist_id");
    if (artistError) throw new Error(`Could not save artists: ${artistError.message}`);

    const artistIds = new Map(
      savedArtists.map((artist) => [artist.spotify_artist_id, artist.id]),
    );
    const playlistTrackRows = validItems.flatMap(({ track }, position) => {
      const trackId = trackIds.get(track.id);
      return trackId
        ? [{ playlist_id: databasePlaylistId, track_id: trackId, position }]
        : [];
    });
    const { error: playlistTrackError } = await supabase
      .from("playlist_tracks")
      .upsert(playlistTrackRows, { onConflict: "playlist_id,track_id" });
    if (playlistTrackError) {
      throw new Error(`Could not link tracks to playlists: ${playlistTrackError.message}`);
    }

    const trackArtistRows = validItems.flatMap(({ track }) => {
      const trackId = trackIds.get(track.id);
      return trackId
        ? (track.artists || []).flatMap((artist, artistOrder) => {
            const artistId = artistIds.get(artist.id);
            return artistId
              ? [{ track_id: trackId, artist_id: artistId, artist_order: artistOrder }]
              : [];
          })
        : [];
    });
    const { error: trackArtistError } = await supabase
      .from("track_artists")
      .upsert(trackArtistRows, { onConflict: "track_id,artist_id" });
    if (trackArtistError) {
      throw new Error(`Could not link artists to tracks: ${trackArtistError.message}`);
    }
    importedTrackCount += validItems.length;
  }

  return importedTrackCount;
}
