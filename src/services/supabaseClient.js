import { createClient } from "@supabase/supabase-js";

const env = import.meta.env ?? {};
const SUPPORTED_DATA_MODES = new Set(["local", "supabase"]);

export const DATA_MODE = env.VITE_DATA_MODE;

let client = null;
let configurationError = null;

if (!SUPPORTED_DATA_MODES.has(DATA_MODE)) {
  configurationError = "VITE_DATA_MODE must be either 'local' or 'supabase'.";
} else if (DATA_MODE === "supabase") {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    configurationError = "Supabase mode requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.";
  } else {
    client = createClient(supabaseUrl, publishableKey);
  }
}

export function getSupabaseClient() {
  if (configurationError) return { ok: false, error: configurationError };
  if (DATA_MODE !== "supabase" || !client) {
    return { ok: false, error: "Supabase client is unavailable in local data mode." };
  }
  return { ok: true, client };
}
