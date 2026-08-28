/**
 * チーム共通の型。
 *
 * DBの列そのままの形（*Row）と、コードの中で扱いやすい形（PhotoMeta / Scene）を
 * 分けています。変換は toPhotoMeta() が担当します。
 */

// ---------------------------------------------------------------- DBの行

/** photos テーブルの1行 */
export type PhotoRow = {
  id: string;
  trip_id: string;
  uploaded_by: string | null;
  storage_path: string;
  captured_at: string | null; // ISO文字列。EXIFが無い写真では null
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  caption: string | null;
  created_at: string;
};

/** trips テーブルの1行 */
export type TripRow = {
  id: string;
  owner_token: string;
  title: string | null;
  created_at: string;
};

/** scenes テーブルの1行 */
export type SceneRow = {
  id: string;
  trip_id: string;
  seq: number;
  started_at: string;
  ended_at: string;
  photo_ids: string[];
  is_gap: boolean;
  summary: string | null;
  created_at: string;
};

export type PanelMode = "i2i" | "gen";
export type PanelStatus = "pending" | "running" | "done" | "failed";

/** panels テーブルの1行 */
export type PanelRow = {
  id: string;
  trip_id: string;
  scene_id: string;
  seq: number;
  mode: PanelMode;
  status: PanelStatus;
  image_path: string | null;
  prompt: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
};

// ---------------------------------------------------------------- 変換

import type { PhotoMeta } from "./splitScenes.ts";
export type { PhotoMeta, Scene, SplitConfig } from "./splitScenes.ts";

/**
 * DBの行を splitScenes に渡せる形に変換する。
 *
 * captured_at が無い写真は created_at（＝アップロード順）で代用する。
 * この方針を決めているのはここ1箇所だけなので、変えたくなったらここを直す。
 */
export function toPhotoMeta(row: PhotoRow): PhotoMeta {
  return {
    id: row.id,
    takenAt: new Date(row.captured_at ?? row.created_at),
    lat: row.latitude,
    lng: row.longitude,
  };
}

/** captured_at が入っている写真の割合。EXIFが落ちていないかの確認用 */
export function exifCoverage(rows: PhotoRow[]): {
  withTime: number;
  withLocation: number;
  total: number;
} {
  return {
    withTime: rows.filter((r) => r.captured_at !== null).length,
    withLocation: rows.filter((r) => r.latitude !== null && r.longitude !== null).length,
    total: rows.length,
  };
}
