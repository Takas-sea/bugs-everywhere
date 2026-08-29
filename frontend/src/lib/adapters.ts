/**
 * adapters — DB の行を、画面が期待する形に変換する層
 *
 * DB（photos テーブル）と UI（src/types.ts の PhotoItem）は同じものを違う形で
 * 持っています。ここで一度だけ変換することで、
 *   ・DB担当が列名を変えても、直すのはこのファイルだけ
 *   ・フロント担当が型を変えても、直すのはこのファイルだけ
 * という状態を保ちます。コンポーネントの中で直接変換しないでください。
 */

import type { PhotoRow, SceneRow, PanelRow, TripRow } from "./types";
import type {
  PhotoItem, Contributor, DiaryEntry, MapSpot, Trip, TripSummaryStats,
} from "../types";
import { photoUrls, listPhotos, ownerToken } from "./photos";
import { getScenes, getPanels } from "./scenes";
import { supabase } from "./supabase";

// ---------------------------------------------------------------- 仮の値

/**
 * 投稿者。今回は認証を入れていないので、全員これになります。
 * ログインを実装したら、ここを差し替えれば画面側は無変更で済みます。
 */
export const ANONYMOUS_CONTRIBUTOR: Contributor = {
  id: "me",
  name: "あなた",
  avatar:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23CBD5E1'/><circle cx='20' cy='16' r='7' fill='%23ffffff'/><path d='M6 40c0-8 6-12 14-12s14 4 14 12z' fill='%23ffffff'/></svg>",
};

/** 位置が取れなかった写真に入る座標。地図に出す前に必ず除外すること */
export const NO_COORDINATES = { lat: 0, lng: 0 } as const;

// ---------------------------------------------------------------- 補助

/** その写真が実際に位置情報を持っているか */
export function hasLocation(row: PhotoRow): boolean {
  return row.latitude !== null && row.longitude !== null;
}

/**
 * 地図に出せる写真だけを残す。
 * 座標が無い写真をそのまま地図に渡すと、緯度経度 0,0（アフリカ沖）に
 * ピンが立ってしまうため、地図系の画面では必ずこれを通してください。
 */
export function withLocationOnly(items: PhotoItem[]): PhotoItem[] {
  return items.filter(
    (p) => p.coordinates.lat !== 0 || p.coordinates.lng !== 0,
  );
}

/** captured_at が無ければ created_at で代用する（方針は types.ts と揃えています） */
function timeOf(row: PhotoRow): Date {
  return new Date(row.captured_at ?? row.created_at);
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------- 変換

export type ToPhotoItemsOptions = {
  /** 署名URLの有効期限（秒）。既定1時間 */
  expiresInSeconds?: number;
  /** アップロード画面で最初から選択済みにするか。既定 true */
  selected?: boolean;
  /** 投稿者を差し替えたいとき（ログインを入れたら使う） */
  contributor?: Contributor;
};

/**
 * photos の行を、画面用の PhotoItem に変換する。
 *
 * 署名URLはまとめて発行します（1枚ずつだと枚数ぶんリクエストが飛ぶため）。
 * URLの発行に失敗しても変換自体は成功させ、url を空文字にして返します。
 * Storage のポリシー設定待ちでも画面が組めるようにするためです。
 */
export async function toPhotoItems(
  rows: PhotoRow[],
  options: ToPhotoItemsOptions = {},
): Promise<PhotoItem[]> {
  const {
    expiresInSeconds = 60 * 60,
    selected = true,
    contributor = ANONYMOUS_CONTRIBUTOR,
  } = options;

  let urls: Record<string, string> = {};
  try {
    urls = await photoUrls(
      rows.map((r) => r.storage_path),
      expiresInSeconds,
    );
  } catch (e) {
    // 画像が出ないだけで、他の情報は表示できるので止めない
    console.warn("署名URLの発行に失敗しました。画像は表示されません。", e);
  }

  return rows.map((row) => {
    const t = timeOf(row);
    return {
      id: row.id,
      url: urls[row.storage_path] ?? "",
      time: hhmm(t),
      timestamp: t.getTime(),
      locationName: row.location_name ?? "",
      coordinates: hasLocation(row)
        ? { lat: row.latitude as number, lng: row.longitude as number }
        : { ...NO_COORDINATES },
      contributor,
      caption: row.caption ?? undefined,
      isSelected: selected,
      // category は画像分類が必要なため、今回は付けません（省略可の項目です）
    };
  });
}

/**
 * 旅行IDを渡すと、画面にそのまま渡せる PhotoItem の配列が返る。
 * コンポーネントからは基本これだけを呼べば足ります。
 */
export async function loadPhotoItems(
  tripId: string,
  options: ToPhotoItemsOptions = {},
): Promise<PhotoItem[]> {
  const rows = await listPhotos(tripId);
  return toPhotoItems(rows, options);
}

/**
 * EXIF がどれくらい取れているかの内訳。
 * デモ用の写真セットが使えるかどうかを、画面上で確認したいときに。
 */
export function photoStats(rows: PhotoRow[]): {
  total: number;
  withTime: number;
  withLocation: number;
} {
  return {
    total: rows.length,
    withTime: rows.filter((r) => r.captured_at !== null).length,
    withLocation: rows.filter(hasLocation).length,
  };
}

// ================================================================
//  scenes / panels → 日記の画面用の型
// ================================================================

/** 写真が残っていない時間帯のコマに使う表示名 */
export const GAP_TITLE = "写真が残っていない時間";

function hhmmOf(iso: string): string {
  return hhmm(new Date(iso));
}

/** そのシーンに紐づく写真のうち、最初の1枚 */
function firstPhotoOf(scene: SceneRow, photos: PhotoRow[]): PhotoRow | undefined {
  const ids = new Set(scene.photo_ids);
  return photos.find((p) => ids.has(p.id));
}

/** そのシーンの場所名（写真から拾う） */
function placeOf(scene: SceneRow, photos: PhotoRow[]): string | null {
  const ids = new Set(scene.photo_ids);
  for (const p of photos) if (ids.has(p.id) && p.location_name) return p.location_name;
  return null;
}

/**
 * scenes と panels を、日記画面の DiaryEntry に変換する。
 *
 * photoUrl には「生成された絵」が入ります。まだ生成が終わっていないコマは、
 * 元の写真で代用します（写真も無い空白コマは空文字）。
 * 画面側では空文字のときにプレースホルダを出してください。
 */
export async function toDiaryEntries(
  scenes: SceneRow[],
  panels: PanelRow[],
  photos: PhotoRow[],
  options: { contributor?: Contributor } = {},
): Promise<DiaryEntry[]> {
  const contributor = options.contributor ?? ANONYMOUS_CONTRIBUTOR;
  const panelByScene = new Map(panels.map((p) => [p.scene_id, p]));

  // 生成画像と元写真の署名URLをまとめて発行する
  const paths = [
    ...panels.map((p) => p.image_path).filter((v): v is string => !!v),
    ...photos.map((p) => p.storage_path),
  ];
  let urls: Record<string, string> = {};
  try {
    urls = await photoUrls(paths);
  } catch (e) {
    console.warn("署名URLの発行に失敗しました。画像は表示されません。", e);
  }

  return [...scenes]
    .sort((a, b) => a.seq - b.seq)
    .map((scene) => {
      const panel = panelByScene.get(scene.id);
      const photo = firstPhotoOf(scene, photos);
      const place = placeOf(scene, photos);

      // 生成された絵を優先し、まだなら元の写真で代用する
      const generated = panel?.image_path ? urls[panel.image_path] : undefined;
      const original = photo ? urls[photo.storage_path] : undefined;

      return {
        id: panel?.id ?? scene.id,
        photoId: photo?.id ?? "",
        time: hhmmOf(scene.started_at),
        title: scene.is_gap ? GAP_TITLE : (place ?? "この日のひとコマ"),
        location: place ?? "",
        aiDiaryText: scene.summary ?? "",
        photoUrl: generated ?? original ?? "",
        contributor,
      };
    });
}

/**
 * scenes を地図用の MapSpot に変換する。
 *
 * 位置が取れないコマと、写真が無い空白コマは地図に出しません
 * （座標が無いので、出すとアフリカ沖にピンが立ちます）。
 */
export async function toMapSpots(
  scenes: SceneRow[],
  photos: PhotoRow[],
  options: { contributor?: Contributor } = {},
): Promise<MapSpot[]> {
  const contributor = options.contributor ?? ANONYMOUS_CONTRIBUTOR;

  const usable = [...scenes]
    .sort((a, b) => a.seq - b.seq)
    .map((scene) => ({ scene, photo: firstPhotoOf(scene, photos) }))
    .filter(
      (x): x is { scene: SceneRow; photo: PhotoRow } =>
        !x.scene.is_gap &&
        !!x.photo &&
        x.photo.latitude !== null &&
        x.photo.longitude !== null,
    );

  let urls: Record<string, string> = {};
  try {
    urls = await photoUrls(usable.map((x) => x.photo.storage_path));
  } catch {
    /* 画像が出ないだけ */
  }

  return usable.map(({ scene, photo }, i) => ({
    id: scene.id,
    stepNumber: i + 1,
    name: photo.location_name ?? `スポット ${i + 1}`,
    lat: photo.latitude as number,
    lng: photo.longitude as number,
    time: hhmmOf(scene.started_at),
    photoUrl: urls[photo.storage_path] ?? "",
    diarySnippet: (scene.summary ?? "").slice(0, 40),
    contributorName: contributor.name,
  }));
}

// ================================================================
//  Trip をまるごと組み立てる
// ================================================================

function summarize(
  entries: DiaryEntry[],
  spots: MapSpot[],
  photos: PhotoRow[],
  coverImage: string,
  title: string,
  contributor: Contributor,
): TripSummaryStats {
  const times = entries.map((e) => e.time).filter(Boolean).sort();
  return {
    visitedPlacesCount: spots.length,
    travelDuration: times.length ? `${times[0]} 〜 ${times[times.length - 1]}` : "",
    totalPhotosCount: photos.length,
    membersCount: 1,
    topPhotoSpot: spots[0]?.name ?? "",
    topPhotoSpotCount: photos.length,
    bestShotUrl: coverImage,
    bestShotTitle: `${title}のベストショット`,
    bestShotDescription: "この旅の一枚。",
    bestShotPhotographer: contributor.name,
  };
}

/**
 * 旅行IDを渡すと、画面がそのまま使える Trip が返る。
 *
 * mockTrips.ts の代わりに、これを呼んでください。
 * DBを4回読んで（trips / photos / scenes / panels）、
 * 署名URLを発行して、画面用の型に組み立てます。
 */
export async function loadTrip(
  tripId: string,
  options: { contributor?: Contributor } = {},
): Promise<Trip> {
  const contributor = options.contributor ?? ANONYMOUS_CONTRIBUTOR;

  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (error || !tripRow) throw new Error(`旅行が見つかりません: ${error?.message}`);
  const trip = tripRow as TripRow;

  const [photos, scenes, panels] = await Promise.all([
    listPhotos(tripId),
    getScenes(tripId),
    getPanels(tripId),
  ]);

  const entries = await toDiaryEntries(scenes, panels, photos, { contributor });
  const spots = await toMapSpots(scenes, photos, { contributor });

  const coverImage = entries.find((e) => e.photoUrl)?.photoUrl ?? "";
  const title = trip.title ?? "旅の記録";
  const destination = spots[0]?.name ?? "";
  const date = (photos[0]?.captured_at ?? trip.created_at).slice(0, 10);

  return {
    id: trip.id,
    title,
    subtitle: destination ? `${destination}をめぐる一日` : "一日の記録",
    date,
    destination,
    coverImage,
    members: [contributor],
    spotsCount: spots.length,
    photosCount: photos.length,
    weather: "",
    spots,
    entries,
    tags: Array.from(
      new Set(photos.map((p) => p.location_name).filter((v): v is string => !!v)),
    ).slice(0, 5),
    summaryStats: summarize(entries, spots, photos, coverImage, title, contributor),
  };
}

/**
 * 旅行の一覧（新しい順）。HomeScreen / MemoriesListScreen 用。
 *
 * ハッカソン中は端末での絞り込みをしていません。
 * 接続テストのページで作った旅行と、アプリで作った旅行は
 * 別々の owner_token を持つため、絞ると片方しか見えなくなるからです。
 * 本番で複数人が使うなら、下のコメントを外してください。
 */
export async function loadMyTrips(limit = 20): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, title, created_at")
    // .eq("owner_token", ownerToken())   ← 本番ではこれを有効にする
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[loadMyTrips] 旅行一覧の取得に失敗しました", error);
    throw new Error(`旅行の取得に失敗しました: ${error.message}`);
  }

  const rows = (data ?? []) as { id: string; title: string | null }[];
  console.info(`[loadMyTrips] ${rows.length}件の旅行が見つかりました`, rows);

  const trips: Trip[] = [];
  for (const row of rows) {
    try {
      trips.push(await loadTrip(row.id));
    } catch (e) {
      // 何が原因で表示できないのかを必ず出す（黙って消さない）
      console.error(`[loadMyTrips] 旅行 ${row.id} の読み込みに失敗しました`, e);
    }
  }
  console.info(`[loadMyTrips] ${trips.length}件を画面に渡します`);
  return trips;
}
