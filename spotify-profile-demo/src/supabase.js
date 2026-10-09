import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);

export async function signInWithSpotify() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "spotify",
    options: {
      redirectTo: `${window.location.origin}/`,
      scopes: "user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-private",
      queryParams: {
        show_dialog: "true",
      },
    },
  });
  if (error) throw new Error(`Spotify authentication failed: ${error.message}`);
}

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Supabase session lookup failed: ${error.message}`);
  return data.session;
}

export async function signOutOfSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Supabase sign-out failed: ${error.message}`);
}
