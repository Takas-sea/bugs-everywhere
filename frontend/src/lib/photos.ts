import { supabase, PHOTO_BUCKET } from "./supabase.ts";
import { readExif } from "./exif.ts";
import { reverseGeocodeName } from "./geocode.ts";
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

  // 地名は画像のアップロードと同時に引きます。地名の取得は1秒に1回までなので、
  // 順番にやると待ち時間が積み上がります。失敗しても写真の登録は止めません。
  const placePromise =
    exif.latitude !== null && exif.longitude !== null
      ? reverseGeocodeName(exif.latitude, exif.longitude).catch((e) => {
          console.warn("[uploadPhoto] 地名の取得に失敗しました", e);
          return null;
        })
      : Promise.resolve(null);

  const path = `${tripId}/${crypto.randomUUID()}.${extensionOf(file)}`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });

  if (upErr) throw new Error(`画像のアップロードに失敗しました: ${upErr.message}`);

  const locationName = await placePromise;

  const { data, error } = await supabase
    .from("photos")
    .insert({
      trip_id: tripId,
      storage_path: path,
      captured_at: exif.capturedAt ? exif.capturedAt.toISOString() : null,
      latitude: exif.latitude,
      longitude: exif.longitude,
      location_name: locationName,
    })
    .select()
    .single();

  if (error) {
    // DB に入らなかった画像は消しておきたいが、バケットは Private で
    // anon に DELETE 権限が無い運用なので、失敗しても無視する。
    // （使われない画像がまれに残るだけで、実害はない）
    try {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    } catch {
      /* 権限が無い場合はそのまま */
    }
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

/**
 * Storage のパスから、img タグに渡せる URL を作る。
 *
 * バケットは Private なので、公開URLではなく期限つきの署名URLを発行します。
 * 期限が切れると画像が表示されなくなるので、画面を開いたときに取り直してください。
 */
export async function photoUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) throw new Error(`画像URLの発行に失敗しました: ${error?.message}`);
  return data.signedUrl;
}

/**
 * 複数枚ぶんの署名URLをまとめて発行する。
 * 1枚ずつ呼ぶとリクエストが枚数ぶん飛ぶので、一覧表示ではこちらを使うこと。
 * 返るのは storage_path をキーにした対応表です。
 */
export async function photoUrls(
  storagePaths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(storagePaths, expiresInSeconds);

  if (error || !data) throw new Error(`画像URLの発行に失敗しました: ${error?.message}`);

  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
  }
  return map;
}
