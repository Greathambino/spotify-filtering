export function filterTracks(
  tracks,
  {
    includeSourcePlaylistIds = new Set(),
    excludeSourcePlaylistIds = new Set(),
    includeTagIds = new Set(),
    excludeTagIds = new Set(),
  } = {},
) {
  return tracks.filter((track) => {
    const sourcePlaylistIds = new Set(track.sourcePlaylistIds);
    const customTagIds = new Set(track.customTagIds);

    const hasIncludedSourcePlaylists = [...includeSourcePlaylistIds]
      .every((playlistId) => sourcePlaylistIds.has(playlistId));
    const hasExcludedSourcePlaylists = [...excludeSourcePlaylistIds]
      .every((playlistId) => !sourcePlaylistIds.has(playlistId));
    const hasIncludedTags = [...includeTagIds]
      .every((tagId) => customTagIds.has(tagId));
    const hasExcludedTags = [...excludeTagIds]
      .every((tagId) => !customTagIds.has(tagId));

    return (
      hasIncludedSourcePlaylists
      && hasExcludedSourcePlaylists
      && hasIncludedTags
      && hasExcludedTags
    );
  });
}

export function normalizeTrack({
  id,
  spotifyTrackId = null,
  title,
  artistNames,
  albumName = null,
  sourcePlaylistIds = [],
  customTagIds = [],
}) {
  return {
    id,
    spotifyTrackId,
    title,
    artistNames: [...artistNames],
    albumName,
    sourcePlaylistIds: [...sourcePlaylistIds],
    customTagIds: [...customTagIds],
  };
}
