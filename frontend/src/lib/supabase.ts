import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, assertEnv } from "./env.ts";

assertEnv();

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/** 画像を置くバケット名（A担当が Storage に作るもの） */
export const PHOTO_BUCKET = "photos";
