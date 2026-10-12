import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const MAX_BATCH_SIZE = 20;
const MAX_TAGS_PER_TRACK = 5;
const MIN_TAG_COUNT = 2;
const BLOCKED_TAGS = new Set([
  "awesome", "favorite", "favorites", "favourite", "favourites", "love",
  "music", "my top songs", "seen live", "racist", "racism",
]);
let lastRequestAt = 0;

function normalizeTag(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s+&']/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableTag(name: string, count: number, title: string, artists: string[]) {
  const normalized = normalizeTag(name);
  if (!normalized || count < MIN_TAG_COUNT || BLOCKED_TAGS.has(normalized)) return false;
  if (/^(?:\d{2}s|(?:19|20)\d{2}s?)$/.test(normalized)) return false;
  const haystack = [title, ...artists].map(normalizeTag);
  return !haystack.some((value) => value === normalized);
}

async function lastfm(params: Record<string, string>) {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  for (const [key, value] of Object.entries({
    ...params, api_key: LASTFM_API_KEY!, format: "json",
  })) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "User-Agent": "spotify-filtering-lastfm-enrichment/1.0" },
  });
  lastRequestAt = Date.now();
  if (!response.ok) throw new Error(`Last.fm request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Last.fm ${payload.error}: ${payload.message}`);
  return payload;
}

function cleanTags(payload: any, title: string, artists: string[]) {
  const tags = (payload?.toptags?.tag || [])
    .map((tag: any) => ({ name: String(tag.name || ""), count: Number(tag.count || 0) }))
    .filter((tag: { name: string; count: number }) =>
      isUsableTag(tag.name, tag.count, title, artists))
    .sort((left: { count: number }, right: { count: number }) => right.count - left.count);
  const seen = new Set<string>();
  return tags.filter((tag: { name: string }) => {
    const normalized = normalizeTag(tag.name);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, MAX_TAGS_PER_TRACK);
}

async function getTrackContext(
  userClient: ReturnType<typeof createClient>,
  userId: string,
  trackId: string,
) {
  const { data, error } = await userClient
    .from("tracks")
    .select("id, title, track_artists!inner(artists!inner(name))")
    .eq("user_id", userId)
    .eq("id", trackId)
    .single();
  if (error) throw new Error(`Could not load track context: ${error.message}`);
  return {
    title: data.title,
    artists: (data.track_artists || [])
      .map((link: any) => link.artists?.name)
      .filter(Boolean),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!LASTFM_API_KEY) return jsonResponse({ error: "LASTFM_API_KEY is not configured" }, 500);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);
  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Authentication required" }, 401);
  const userClient = authClient;

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit || MAX_BATCH_SIZE), 1), MAX_BATCH_SIZE);
  const requestedTrackIds = Array.isArray(body.trackIds)
    ? body.trackIds.filter((trackId: unknown) => typeof trackId === "string").slice(0, 500)
    : [];
  let queueQuery = userClient
    .from("lastfm_enrichment_queue")
    .select("id, track_id, attempts")
    .eq("user_id", user.id)
    .eq("status", "queued")
    .lte("next_attempt_at", new Date().toISOString());
  if (requestedTrackIds.length) queueQuery = queueQuery.in("track_id", requestedTrackIds);
  const { data: jobs, error: queueError } = await queueQuery.order("created_at").limit(limit);
  if (queueError) return jsonResponse({ error: queueError.message }, 500);

  let completed = 0;
  let failed = 0;
  const errors: string[] = [];
  const artistTagCache = new Map<string, unknown>();
  for (const job of jobs || []) {
    const { error: claimError } = await userClient.from("lastfm_enrichment_queue")
      .update({
        status: "running",
        attempts: job.attempts + 1,
        error_message: null,
        lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", job.id);
    if (claimError) {
      failed += 1;
      errors.push(`Could not claim job ${job.id}: ${claimError.message}`);
      continue;
    }
    try {
      const context = await getTrackContext(userClient, user.id, job.track_id);
      const artist = context.artists[0];
      if (!artist) throw new Error("Track has no artist");
      const trackPayload = await lastfm({
        method: "track.getTopTags", artist, track: context.title,
      });
      let tags = cleanTags(trackPayload, context.title, context.artists);
      let source: "track" | "artist" = "track";
      if (!tags.length) {
        let artistPayload = artistTagCache.get(artist);
        if (!artistPayload) {
          artistPayload = await lastfm({ method: "artist.getTopTags", artist });
          artistTagCache.set(artist, artistPayload);
        }
        tags = cleanTags(artistPayload, context.title, context.artists);
        source = "artist";
      }
      const { error: deleteError } = await userClient.from("external_track_tags").delete()
        .eq("user_id", user.id).eq("track_id", job.track_id).eq("provider", "lastfm");
      if (deleteError) throw new Error(`Could not clear old Last.fm tags: ${deleteError.message}`);
      if (tags.length) {
        const { error: tagError } = await userClient.from("external_track_tags").insert(
          tags.map((tag: { name: string; count: number }) => ({
            user_id: user.id, track_id: job.track_id, provider: "lastfm",
            source, tag_name: tag.name, normalized_name: normalizeTag(tag.name),
            popularity: tag.count,
          })),
        );
        if (tagError) throw new Error(`Could not save Last.fm tags: ${tagError.message}`);
      }
      const { error: completeError } = await userClient.from("lastfm_enrichment_queue").update({
        status: "complete", completed_at: new Date().toISOString(), lease_expires_at: null,
      }).eq("id", job.id);
      if (completeError) throw new Error(`Could not complete enrichment job: ${completeError.message}`);
      completed += 1;
    } catch (error) {
      failed += 1;
      errors.push(error instanceof Error ? error.message : String(error));
      const { error: failureError } = await userClient.from("lastfm_enrichment_queue").update({
        status: job.attempts + 1 >= 3 ? "failed" : "queued",
        error_message: error instanceof Error ? error.message : String(error),
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        lease_expires_at: null,
      }).eq("id", job.id);
      if (failureError) errors.push(`Could not update failed job ${job.id}: ${failureError.message}`);
    }
  }
  return jsonResponse({
    requested: jobs?.length || 0,
    completed,
    failed,
    errors: errors.slice(0, 3),
  });
});
