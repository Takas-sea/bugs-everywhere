/**
 * 旅行そのものの操作。作成は photos.ts の createTrip にあります。
 */

import { supabase } from "./supabase";

/**
 * 日記の名前を変える。
 *
 * trips への UPDATE は sql/003_trip_rename.sql を実行していないと
 * 権限で弾かれます（RLS のポリシーと GRANT の両方が必要です）。
 */
export async function renameTrip(tripId: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("名前が空です");

  const { error } = await supabase
    .from("trips")
    .update({ title: trimmed })
    .eq("id", tripId);

  if (error) {
    console.error("[renameTrip] 名前の変更に失敗しました", error);
    throw new Error(`名前の変更に失敗しました: ${error.message}`);
  }
}
