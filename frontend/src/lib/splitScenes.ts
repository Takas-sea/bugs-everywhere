/**
 * splitScenes — 一日ぶんの写真を「シーン」に分ける
 *
 * 【現在の仕様】
 * ・実写真は原則「1枚 = 1シーン」
 * ・実写真を勝手に1つのシーンへまとめない
 * ・実写真と実写真の間に AI 補完用の空白シーンを入れる
 * ・写真が2枚なら
 *
 *   写真1
 *     ↓
 *   AI補完
 *     ↓
 *   写真2
 *
 *   という3シーンになる
 *
 * Supabase / DB に依存しない純粋関数です。
 */

// ---------------------------------------------------------------- 型

export type PhotoMeta = {
  id: string;

  /**
   * 撮影時刻。
   * EXIF が無い場合は、呼び出し側でアップロード順に
   * 擬似的な時刻を入れてから渡す。
   */
  takenAt: Date;

  /** 緯度。位置情報が無い場合は null */
  lat: number | null;

  /** 経度。位置情報が無い場合は null */
  lng: number | null;
};

export type Scene = {
  /** 表示順 */
  seq: number;

  /** シーン開始時刻 */
  startedAt: Date;

  /** シーン終了時刻 */
  endedAt: Date;

  /** このシーンに含まれる実写真ID */
  photoIds: string[];

  /**
   * true:
   * 写真が存在しないAI補完シーン
   *
   * false:
   * 実写真シーン
   */
  isGap: boolean;
};

export type SplitConfig = {
  /**
   * 以前のシーン分割との互換性のため残している設定。
   * 現在は「1写真 = 1シーン」を優先する。
   */
  maxGapMinutes: number;

  maxDistanceMeters: number;

  maxSceneMinutes: number;

  maxPhotosPerScene: number;

  targetSceneCount: number;

  /**
   * AI補完シーンを入れる基準時間。
   *
   * 現在の実装では、
   * insertGapBetweenEveryPhoto が true の場合は
   * 時間差に関係なく写真間へAI補完を入れる。
   */
  gapThresholdMinutes: number;

  maxSceneCount: number;

  /**
   * true:
   * 実写真と実写真の間へ必ずAI補完シーンを入れる。
   *
   * false:
   * gapThresholdMinutes 以上離れている場合だけ入れる。
   */
  insertGapBetweenEveryPhoto?: boolean;
};

// ---------------------------------------------------------------- 設定

export const DEFAULT_CONFIG: SplitConfig = {
  maxGapMinutes: 45,

  maxDistanceMeters: 500,

  maxSceneMinutes: 90,

  maxPhotosPerScene: 1,

  targetSceneCount: 5,

  gapThresholdMinutes: 90,

  maxSceneCount: 20,

  /**
   * 今回のアプリでは、
   *
   * 実写真
   * ↓
   * AI補完
   * ↓
   * 実写真
   *
   * としたいので true。
   */
  insertGapBetweenEveryPhoto: true,
};

// ---------------------------------------------------------------- 補助

const MIN = 60 * 1000;

/**
 * 2つの時刻の差を分で返す
 */
function minutesBetween(a: Date, b: Date): number {
  return Math.abs(
    b.getTime() - a.getTime(),
  ) / MIN;
}

/**
 * 2つの時刻の中間時刻を求める。
 *
 * 例:
 *
 * 10:00
 *  ↓
 * 10:30
 *  ↓
 * 11:00
 *
 * AI補完シーンの代表時刻として使用する。
 */
function midpointDate(a: Date, b: Date): Date {
  return new Date(
    Math.floor(
      (a.getTime() + b.getTime()) / 2,
    ),
  );
}

// ---------------------------------------------------------------- 本体

/**
 * 写真をシーンへ分割する。
 *
 * 現在の重要仕様:
 *
 * 「1枚の実写真 = 1つの実写シーン」
 *
 * これにより、
 * 複数の写真が1つのsceneへまとめられて
 * 2枚目以降が日記画面に表示されなくなる問題を防ぐ。
 */
export function splitScenes(
  photos: PhotoMeta[],
  config: SplitConfig = DEFAULT_CONFIG,
): Scene[] {

  // 写真が無ければ何もしない
  if (photos.length === 0) {
    return [];
  }

  // ------------------------------------------------------------
  // 1. 写真を撮影時刻順に並べる
  // ------------------------------------------------------------

  const sorted = [...photos].sort(
    (a, b) =>
      a.takenAt.getTime() -
      b.takenAt.getTime(),
  );

  // ------------------------------------------------------------
  // 2. シーンを作る
  // ------------------------------------------------------------

  const scenes: Scene[] = [];

  for (
    let i = 0;
    i < sorted.length;
    i++
  ) {

    const photo = sorted[i];

    // ----------------------------------------------------------
    // 実写真シーン
    // ----------------------------------------------------------

    scenes.push({
      seq: 0,

      startedAt: photo.takenAt,

      endedAt: photo.takenAt,

      /**
       * ★重要
       *
       * 写真1枚だけをこのsceneへ入れる。
       *
       * 以前:
       *
       * photoIds: [
       *   東京駅,
       *   京都駅
       * ]
       *
       * となる可能性があった。
       *
       * 今回:
       *
       * Scene1
       * photoIds: [東京駅]
       *
       * Scene3
       * photoIds: [京都駅]
       *
       * となる。
       */
      photoIds: [
        photo.id,
      ],

      isGap: false,
    });

    // 最後の写真なら、この後にAI補完は不要
    if (i >= sorted.length - 1) {
      continue;
    }

    const nextPhoto =
      sorted[i + 1];

    // ----------------------------------------------------------
    // AI補完シーンを入れるか判定
    // ----------------------------------------------------------

    const gapMinutes =
      minutesBetween(
        photo.takenAt,
        nextPhoto.takenAt,
      );

    const shouldInsertGap =
      config.insertGapBetweenEveryPhoto ===
        true ||
      gapMinutes >=
        config.gapThresholdMinutes;

    if (!shouldInsertGap) {
      continue;
    }

    // ----------------------------------------------------------
    // AI補完シーン
    // ----------------------------------------------------------

    const middle =
      midpointDate(
        photo.takenAt,
        nextPhoto.takenAt,
      );

    scenes.push({
      seq: 0,

      /**
       * AI補完シーンは中間時刻を使用する。
       */
      startedAt: middle,

      endedAt: middle,

      /**
       * 実写真が無いことを表す。
       *
       * backendでは、この空のphotoIdsと
       * isGap=trueを使ってAI補完画像を生成する。
       */
      photoIds: [],

      isGap: true,
    });
  }

  // ------------------------------------------------------------
  // 3. seqを振り直す
  // ------------------------------------------------------------

  return scenes.map(
    (scene, index) => ({
      ...scene,

      seq: index + 1,
    }),
  );
}