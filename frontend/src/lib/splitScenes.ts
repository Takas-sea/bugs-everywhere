/**
 * splitScenes — 一日ぶんの写真を「シーン」に束ねる
 *
 * 写真の中身は一切見ません。撮影時刻と緯度経度だけを使って、
 * 「近い時刻・近い場所で撮られた写真」をひとつのシーンにまとめ、
 * 写真が途切れている時間帯には空白シーンを差し込みます。
 *
 * Supabase にも DB にも依存しない純粋関数なので、単体でテストできます。
 */

// ---------------------------------------------------------------- 型

export type PhotoMeta = {
  id: string;
  /** 撮影時刻。EXIF が無かった写真は、呼び出し側でアップロード順の
   *  擬似的な時刻を入れてから渡すこと（この関数では null を扱わない） */
  takenAt: Date;
  /** 位置。無い写真は普通にあるので null 許容 */
  lat: number | null;
  lng: number | null;
};

export type Scene = {
  seq: number;
  startedAt: Date;
  endedAt: Date;
  photoIds: string[];
  /** true なら写真が1枚もない時間帯。AI が想像で描くコマ */
  isGap: boolean;
};

export type SplitConfig = {
  /** これ以上時間が空いたら別のシーンにする（分） */
  maxGapMinutes: number;
  /** これ以上離れていたら別のシーンにする（メートル） */
  maxDistanceMeters: number;
  /** 1シーンがこれ以上長くならないようにする（分）＝連鎖の防止 */
  maxSceneMinutes: number;
  /** 1シーンに入れる写真の上限 */
  maxPhotosPerScene: number;
  /** 最終的に何コマの日記にするか */
  targetSceneCount: number;
  /** シーンとシーンの間がこれ以上空いていたら空白シーンを挿入（分） */
  gapThresholdMinutes: number;
  /** どれだけ間隔が空いていても、これ以上のコマ数にはしない（生成の時間と費用の上限） */
  maxSceneCount: number;
};

export const DEFAULT_CONFIG: SplitConfig = {
  maxGapMinutes: 45,
  maxDistanceMeters: 500,
  maxSceneMinutes: 90,
  maxPhotosPerScene: 8,
  targetSceneCount: 5,
  gapThresholdMinutes: 90,
  maxSceneCount: 8,
};

// ---------------------------------------------------------------- 補助

const MIN = 60 * 1000;

function minutesBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / MIN;
}

/** 2点間の距離（メートル）。どちらかに位置が無ければ null */
function distanceMeters(a: PhotoMeta, b: PhotoMeta): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------- 本体

export function splitScenes(
  photos: PhotoMeta[],
  config: SplitConfig = DEFAULT_CONFIG,
): Scene[] {
  if (photos.length === 0) return [];

  // 1. 撮影時刻の昇順に並べる
  const sorted = [...photos].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
  );

  // 2. 隣り合う2枚を比べて、条件を満たさなくなったところで切る
  let groups: PhotoMeta[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const photo = sorted[i];
    const current = groups[groups.length - 1];
    const prev = current[current.length - 1];
    const dist = distanceMeters(prev, photo);

    const sameScene =
      // 直前の写真から離れすぎていない
      minutesBetween(prev.takenAt, photo.takenAt) <= config.maxGapMinutes &&
      // 位置が両方に有るときだけ距離を見る
      (dist === null || dist <= config.maxDistanceMeters) &&
      // シーンが長くなりすぎない（歩きながら撮り続けた日への保険）
      minutesBetween(current[0].takenAt, photo.takenAt) <= config.maxSceneMinutes &&
      // 1シーンに詰め込みすぎない
      current.length < config.maxPhotosPerScene;

    if (sameScene) current.push(photo);
    else groups.push([photo]);
  }

  // 3. コマ数を減らす。
  //
  //    隣り合うグループのうち「間隔が一番短いペア」から順にくっつけます。
  //    写真の枚数が多い順に残す方式だと、遠く離れた写真を無理やり吸収して
  //    シーンの終了時刻が引き伸ばされ、本来そこにあった「写真が残っていない
  //    時間」が消えてしまいます。このプロダクトで一番見せたいコマなので、
  //    大きく空いた間隔は最後まで残るようにしています。
  //
  //    ただし生成には時間と費用がかかるので、maxSceneCount を超えている間は
  //    大きな間隔でもくっつけます。
  while (groups.length > config.targetSceneCount) {
    let bestIndex = -1;
    let bestGap = Infinity;

    for (let i = 0; i < groups.length - 1; i++) {
      const gap = minutesBetween(
        groups[i][groups[i].length - 1].takenAt,
        groups[i + 1][0].takenAt,
      );
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    // 空白コマになるほど空いているなら、上限を超えていない限り残す
    if (bestGap >= config.gapThresholdMinutes && groups.length <= config.maxSceneCount) {
      break;
    }

    groups[bestIndex].push(...groups[bestIndex + 1]);
    groups.splice(bestIndex + 1, 1);
  }

  // 4. シーンに変換し、間が大きく空いていれば空白シーンを差し込む
  const scenes: Scene[] = [];

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const startedAt = g[0].takenAt;
    const endedAt = g[g.length - 1].takenAt;

    if (i > 0) {
      const prevEnd = scenes[scenes.length - 1].endedAt;
      if (minutesBetween(prevEnd, startedAt) >= config.gapThresholdMinutes) {
        scenes.push({
          seq: 0, // あとで振り直す
          startedAt: prevEnd,
          endedAt: startedAt,
          photoIds: [],
          isGap: true,
        });
      }
    }

    scenes.push({
      seq: 0,
      startedAt,
      endedAt,
      photoIds: g.map((p) => p.id),
      isGap: false,
    });
  }

  // 5. 通し番号を振る
  return scenes.map((s, i) => ({ ...s, seq: i + 1 }));
}
