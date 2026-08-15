import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Server-only cache access. Never import this module from the browser bundle.

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function createInputHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function findActiveCourse(client, courseCode) {
  const { data, error } = await client
    .from("courses")
    .select("code, archived_at")
    .eq("code", courseCode)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("COURSE_LOOKUP_FAILED");
  return data || null;
}

export async function findCachedAnalysis(client, key) {
  const { data, error } = await client
    .from("ai_analyses")
    .select("result, input_tokens, output_tokens, openai_request_id, created_at")
    .eq("course_code", key.courseCode)
    .eq("task", key.task)
    .eq("input_hash", key.inputHash)
    .eq("prompt_version", key.promptVersion)
    .eq("model", key.model)
    .maybeSingle();
  if (error) throw new Error("CACHE_LOOKUP_FAILED");
  return data || null;
}

export async function saveAnalysis(client, analysis) {
  const { data, error } = await client
    .from("ai_analyses")
    .insert({
      course_code: analysis.courseCode,
      task: analysis.task,
      input_hash: analysis.inputHash,
      result: analysis.result,
      prompt_version: analysis.promptVersion,
      model: analysis.model,
      reasoning_effort: analysis.reasoningEffort,
      input_tokens: analysis.inputTokens,
      output_tokens: analysis.outputTokens,
      openai_request_id: analysis.openAiRequestId,
    })
    .select("created_at")
    .single();
  if (!error) return { ok: true, createdAt: data?.created_at || new Date().toISOString() };
  if (error.code === "23505") return { ok: false, duplicate: true };
  return { ok: false, duplicate: false };
}
