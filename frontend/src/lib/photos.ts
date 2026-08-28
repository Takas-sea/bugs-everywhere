import { supabase, PHOTO_BUCKET } from "./supabase.ts";
import { readExif } from "./exif.ts";
import type { PhotoRow, TripRow } from "./types.ts";

// ---------------------------------------------------------------- 匿名ID

const TOKEN_KEY = "mtrip_owner_token";

/** ログインの代わり。ブラウザごとに1つ発行して使い回す */
export function ownerToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

// ---------------------------------------------------------------- trips

export async function createTrip(title?: string): Promise<TripRow> {
  const { data, error } = await supabase
    .from("trips")
    .insert({ owner_token: ownerToken(), title: title ?? null })
    .select()
    .single();

  if (error) throw new Error(`旅行の作成に失敗しました: ${error.message}`);
  return data as TripRow;
}

export async function listTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_token", ownerToken())
    .order("created_at", { ascending: false });

  if (error) throw new Error(`旅行の取得に失敗しました: ${error.message}`);
  return (data ?? []) as TripRow[];
}

// ---------------------------------------------------------------- photos

function extensionOf(file: File): string {
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "jpg";
}

/**
 * 写真を1枚アップロードして、photos に1行入れる。
 *
 * 順番が大事です：
 *   1. EXIF を読む（アップロード前でないと落ちることがある）
 *   2. Storage に画像を置く
 *   3. DB に数字を入れる
 *
 * 3 が失敗したら、2 で上げた画像は消して整合を保ちます。
 */
export async function uploadPhoto(file: File, tripId: string): Promise<PhotoRow> {
  const exif = await readExif(file);

  const path = `${tripId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });

  if (upErr) throw new Error(`画像のアップロードに失敗しました: ${upErr.message}`);

  const { data, error } = await supabase
    .from("photos")
    .insert({
      trip_id: tripId,
      storage_path: path,
      captured_at: exif.capturedAt ? exif.capturedAt.toISOString() : null,
      latitude: exif.latitude,
      longitude: exif.longitude,
    })
    .select()
    .single();

  if (error) {
    // DB に入らなかった画像は残さない
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(`写真の登録に失敗しました: ${error.message}`);
  }
  return data as PhotoRow;
}

/**
 * 複数枚をまとめてアップロードする。
 * 同時に走らせすぎると回線を詰まらせるので3枚ずつ。
 * 1枚失敗しても全体は止めず、結果に分けて返します。
 */
export async function uploadPhotos(
  files: File[],
  tripId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: PhotoRow[]; failed: { file: string; reason: string }[] }> {
  const uploaded: PhotoRow[] = [];
  const failed: { file: string; reason: string }[] = [];
  let done = 0;

  const CONCURRENCY = 3;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((f) => uploadPhoto(f, tripId)),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") uploaded.push(r.value);
      else failed.push({ file: chunk[j].name, reason: String(r.reason?.message ?? r.reason) });
      done++;
      onProgress?.(done, files.length);
    });
  }
  return { uploaded, failed };
}

/** その旅行の写真を、撮影時刻順に取ってくる */
export async function listPhotos(tripId: string): Promise<PhotoRow[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("trip_id", tripId)
    .order("captured_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`写真の取得に失敗しました: ${error.message}`);
  return (data ?? []) as PhotoRow[];
}

/** Storage のパスから、img タグに渡せる URL を作る（バケットは Public 前提） */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
