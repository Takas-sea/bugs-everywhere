/**
 * adapters — DB の行を、画面が期待する形に変換する層
 *
 * DB（photos テーブル）と UI（src/types.ts の PhotoItem）は同じものを違う形で
 * 持っています。ここで一度だけ変換することで、
 *   ・DB担当が列名を変えても、直すのはこのファイルだけ
 *   ・フロント担当が型を変えても、直すのはこのファイルだけ
 * という状態を保ちます。コンポーネントの中で直接変換しないでください。
 */

import type { PhotoRow } from "./types";
import type { PhotoItem, Contributor } from "../types";
import { photoUrls, listPhotos } from "./photos";

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
