"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

// Public (anon) key only. Used just to upload files with one-time tokens
// issued by the server; the bucket has no client policies otherwise.
export function browserSupabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
