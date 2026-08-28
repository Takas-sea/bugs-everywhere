/**
 * 一日ぶんのサンプルで、分割結果を目で確かめるためのスクリプト
 *
 *   npx tsx splitScenes.demo.ts
 */

import { splitScenes, type PhotoMeta } from "../src/lib/splitScenes.ts";

const KIYOMIZU  = { lat: 34.9949, lng: 135.7850 };
const GION      = { lat: 35.0037, lng: 135.7752 };
const KINKAKUJI = { lat: 35.0394, lng: 135.7292 };

let n = 0;
function photo(hhmm: string, place: { lat: number; lng: number } | null): PhotoMeta {
  const [h, m] = hhmm.split(":").map(Number);
  return {
    id: `p${++n}`,
    takenAt: new Date(2026, 7, 15, h, m),
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
  };
}

const oneDay: PhotoMeta[] = [
  photo("09:12", KIYOMIZU), photo("09:15", KIYOMIZU), photo("09:24", KIYOMIZU),
  photo("10:40", GION), photo("10:44", GION),
  // ここに約3時間半の空白
  photo("14:10", KINKAKUJI), photo("14:15", KINKAKUJI), photo("14:22", KINKAKUJI),
  photo("16:00", GION), photo("16:08", GION),
  photo("18:30", null), photo("18:36", null),   // 位置情報のない写真
];

const fmt = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

console.log(`\n  写真 ${oneDay.length}枚 → シーンに分割\n`);
for (const s of splitScenes(oneDay)) {
  const label = s.isGap ? "空白シーン（AIが描く）" : `写真 ${s.photoIds.length}枚`;
  console.log(
    `  ${String(s.seq).padStart(2)}  ${fmt(s.startedAt)} - ${fmt(s.endedAt)}   ${label}`,
  );
}
console.log("");
