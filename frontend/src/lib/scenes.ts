import { supabase } from "./supabase.ts";
import { splitScenes, DEFAULT_CONFIG } from "./splitScenes.ts";
import { toPhotoMeta } from "./types.ts";
import type { PhotoRow, SceneRow, PanelRow, Scene, SplitConfig } from "./types.ts";
import { listPhotos } from "./photos.ts";

/**
 * 写真からシーンを作って保存し、コマ（panels）の枠を用意するところまで。
 *
 * 絵の生成そのものは生成担当の Edge Function がやります。
 * ここは「何コマにするか」「各コマは写真から起こすのか想像で描くのか」を決めて、
 * pending の枠を並べるまでが仕事です。
 */

/** 写真の行からシーンを組み立てる（DBには触らない） */
export function buildScenes(rows: PhotoRow[], config: SplitConfig = DEFAULT_CONFIG): Scene[] {
  return splitScenes(rows.map(toPhotoMeta), config);
}

/** シーンと、そのコマ枠をまとめて保存する */
export async function saveScenes(
  tripId: string,
  scenes: Scene[],
): Promise<{ scenes: SceneRow[]; panels: PanelRow[] }> {
  if (scenes.length === 0) return { scenes: [], panels: [] };

  // 作り直しに強くするため、その旅行の既存シーンは消してから入れる
  // （panels は scene_id の on delete cascade で一緒に消える）
  // scenes の DELETE ポリシーが必要な箇所はここだけです。
  // 閾値を変えてシーン分割をやり直す操作で使います。
  const { error: delErr } = await supabase.from("scenes").delete().eq("trip_id", tripId);
  if (delErr) {
    throw new Error(
      `古いシーンの削除に失敗しました: ${delErr.message}\n` +
        "scenes に anon の DELETE ポリシーが設定されているか確認してください。",
    );
  }

  const { data: sceneRows, error } = await supabase
    .from("scenes")
    .insert(
      scenes.map((s) => ({
        trip_id: tripId,
        seq: s.seq,
        started_at: s.startedAt.toISOString(),
        ended_at: s.endedAt.toISOString(),
        photo_ids: s.photoIds,
        is_gap: s.isGap,
      })),
    )
    .select();

  if (error) throw new Error(`シーンの保存に失敗しました: ${error.message}`);

  const rows = (sceneRows ?? []) as SceneRow[];

  const { data: panelRows, error: pErr } = await supabase
    .from("panels")
    .insert(
      rows.map((r) => ({
        trip_id: tripId,
        scene_id: r.id,
        seq: r.seq,
        // 写真があるコマは写真から変換、無いコマは想像で描かせる
        mode: r.is_gap ? "gen" : "i2i",
        status: "pending",
      })),
    )
    .select();

  if (pErr) throw new Error(`コマの作成に失敗しました: ${pErr.message}`);

  return { scenes: rows, panels: (panelRows ?? []) as PanelRow[] };
}

/** 写真の取得からシーン保存までを一息でやる。画面からはこれを呼べば足りる */
export async function prepareScenes(
  tripId: string,
  config: SplitConfig = DEFAULT_CONFIG,
): Promise<{ scenes: SceneRow[]; panels: PanelRow[] }> {
  const photos = await listPhotos(tripId);
  return saveScenes(tripId, buildScenes(photos, config));
}

export async function getScenes(tripId: string): Promise<SceneRow[]> {
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("trip_id", tripId)
    .order("seq", { ascending: true });

  if (error) throw new Error(`シーンの取得に失敗しました: ${error.message}`);
  return (data ?? []) as SceneRow[];
}

export async function getPanels(tripId: string): Promise<PanelRow[]> {
  const { data, error } = await supabase
    .from("panels")
    .select("*")
    .eq("trip_id", tripId)
    .order("seq", { ascending: true });

  if (error) throw new Error(`コマの取得に失敗しました: ${error.message}`);
  return (data ?? []) as PanelRow[];
}
