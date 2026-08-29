/**
 * adapters — DB の行を、画面が期待する形に変換する層
 *
 * DB（photos テーブル）と UI（src/types.ts の PhotoItem）は同じものを違う形で
 * 持っています。ここで一度だけ変換することで、
 *   ・DB担当が列名を変えても、直すのはこのファイルだけ
 *   ・フロント担当が型を変えても、直すのはこのファイルだけ
 * という状態を保ちます。コンポーネントの中で直接変換しないでください。
 */

import type {
  PhotoRow,
  SceneRow,
  PanelRow,
  TripRow,
} from "./types";

import type {
  PhotoItem,
  Contributor,
  DiaryEntry,
  MapSpot,
  Trip,
  TripSummaryStats,
} from "../types";

import {
  photoUrls,
  listPhotos,
  ownerToken,
} from "./photos";

import {
  getScenes,
  getPanels,
} from "./scenes";

import { supabase } from "./supabase";


// ================================================================
// 仮の値
// ================================================================

/**
 * 投稿者。
 * 今回は認証を入れていないので、全員これになります。
 */
export const ANONYMOUS_CONTRIBUTOR: Contributor = {
  id: "me",
  name: "あなた",
  avatar:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23CBD5E1'/><circle cx='20' cy='16' r='7' fill='%23ffffff'/><path d='M6 40c0-8 6-12 14-12s14 4 14 12z' fill='%23ffffff'/></svg>",
};


/**
 * 位置情報が取れなかった場合の座標
 */
export const NO_COORDINATES = {
  lat: 0,
  lng: 0,
} as const;


// ================================================================
// 補助
// ================================================================

/**
 * 写真が実際に位置情報を持っているか
 */
export function hasLocation(
  row: PhotoRow,
): boolean {
  return (
    row.latitude !== null &&
    row.longitude !== null
  );
}


/**
 * 地図に出せる写真だけ残す
 */
export function withLocationOnly(
  items: PhotoItem[],
): PhotoItem[] {
  return items.filter(
    (p) =>
      p.coordinates.lat !== 0 ||
      p.coordinates.lng !== 0,
  );
}


/**
 * captured_at が無ければ created_at
 */
function timeOf(
  row: PhotoRow,
): Date {
  return new Date(
    row.captured_at ??
      row.created_at,
  );
}


/**
 * Date → 10:05
 */
function hhmm(
  d: Date,
): string {
  return d.toLocaleTimeString(
    "ja-JP",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


/**
 * ISO日時 → 10:05
 */
function hhmmOf(
  iso: string,
): string {
  return hhmm(
    new Date(iso),
  );
}


// ================================================================
// PhotoItem
// ================================================================

export type ToPhotoItemsOptions = {
  /**
   * 署名URLの有効期限
   */
  expiresInSeconds?: number;

  /**
   * 最初から選択済みにするか
   */
  selected?: boolean;

  /**
   * 投稿者
   */
  contributor?: Contributor;
};


/**
 * photos → PhotoItem[]
 */
export async function toPhotoItems(
  rows: PhotoRow[],
  options: ToPhotoItemsOptions = {},
): Promise<PhotoItem[]> {

  const {
    expiresInSeconds =
      60 * 60 * 12,

    selected = true,

    contributor =
      ANONYMOUS_CONTRIBUTOR,

  } = options;


  let urls: Record<
    string,
    string
  > = {};


  try {

    urls =
      await photoUrls(
        rows.map(
          (r) =>
            r.storage_path,
        ),
        expiresInSeconds,
      );

  } catch (e) {

    console.warn(
      "署名URLの発行に失敗しました。画像は表示されません。",
      e,
    );

  }


  return rows.map(
    (row) => {

      const t =
        timeOf(row);


      return {

        id:
          row.id,

        url:
          urls[
            row.storage_path
          ] ?? "",

        time:
          hhmm(t),

        timestamp:
          t.getTime(),

        locationName:
          row.location_name ??
          "",

        coordinates:
          hasLocation(row)
            ? {
                lat:
                  row.latitude as number,

                lng:
                  row.longitude as number,
              }
            : {
                ...NO_COORDINATES,
              },

        contributor,

        caption:
          row.caption ??
          undefined,

        isSelected:
          selected,

      };

    },
  );
}


/**
 * tripId → PhotoItem[]
 */
export async function loadPhotoItems(
  tripId: string,
  options: ToPhotoItemsOptions = {},
): Promise<PhotoItem[]> {

  const rows =
    await listPhotos(
      tripId,
    );

  return toPhotoItems(
    rows,
    options,
  );
}


// ================================================================
// 写真統計
// ================================================================

export function photoStats(
  rows: PhotoRow[],
): {
  total: number;
  withTime: number;
  withLocation: number;
} {

  return {

    total:
      rows.length,

    withTime:
      rows.filter(
        (r) =>
          r.captured_at !== null,
      ).length,

    withLocation:
      rows.filter(
        hasLocation,
      ).length,

  };
}


// ================================================================
// scenes / panels → 日記画面
// ================================================================

export const GAP_TITLE =
  "写真が残っていない時間";


/**
 * scene に属している写真を全部取得する
 *
 * ★ 修正ポイント
 *
 * 以前は firstPhotoOf() で最初の写真1枚しか
 * 取得していませんでした。
 *
 * 東京駅・京都駅が同じsceneになった場合、
 * 京都駅が消えてしまう原因になります。
 */
function photosOfScene(
  scene: SceneRow,
  photos: PhotoRow[],
): PhotoRow[] {

  const ids =
    new Set(
      scene.photo_ids ??
        [],
    );


  return photos
    .filter(
      (photo) =>
        ids.has(
          photo.id,
        ),
    )
    .sort(
      (a, b) =>
        timeOf(a).getTime() -
        timeOf(b).getTime(),
    );

}


/**
 * 最初の写真が必要な処理用
 */
function firstPhotoOf(
  scene: SceneRow,
  photos: PhotoRow[],
): PhotoRow | undefined {

  return photosOfScene(
    scene,
    photos,
  )[0];

}


/**
 * Scene全体の場所
 */
function placeOf(
  scene: SceneRow,
  photos: PhotoRow[],
): string | null {

  if (
    scene.place
  ) {
    return scene.place;
  }


  const scenePhotos =
    photosOfScene(
      scene,
      photos,
    );


  const counts =
    new Map<
      string,
      number
    >();


  for (
    const p of scenePhotos
  ) {

    if (
      !p.location_name
    ) {
      continue;
    }


    counts.set(
      p.location_name,
      (
        counts.get(
          p.location_name,
        ) ?? 0
      ) + 1,
    );

  }


  let best:
    string | null =
    null;

  let bestCount =
    0;


  for (
    const [
      name,
      n,
    ] of counts
  ) {

    if (
      n >
      bestCount
    ) {

      best =
        name;

      bestCount =
        n;

    }

  }


  return best;

}


/**
 * 写真単体の場所
 *
 * 写真自身の location_name を最優先します。
 */
function placeOfPhoto(
  photo: PhotoRow,
  scene: SceneRow,
): string {

  if (
    photo.location_name?.trim()
  ) {
    return photo.location_name.trim();
  }


  if (
    scene.place?.trim()
  ) {
    return scene.place.trim();
  }


  return "場所の記録なし";

}


/**
 * summary がまだ生成されていないときの
 * 日記文章
 *
 * ※これはGemini等によるAI生成ではなく、
 * AI生成が終わるまでの表示用フォールバックです。
 */
function fallbackDiaryText(
  photo: PhotoRow,
  scene: SceneRow,
): string {

  const place =
    placeOfPhoto(
      photo,
      scene,
    );


  const time =
    hhmm(
      timeOf(photo),
    );


  if (
    photo.caption?.trim()
  ) {

    return photo.caption.trim();

  }


  if (
    place &&
    place !==
      "場所の記録なし"
  ) {

    return (
      `${time}ごろ、${place}を訪れました。` +
      `旅の途中で目に留まった景色を写真に残しました。` +
      `この一枚も、この日の旅の流れを振り返る大切な思い出です。`
    );

  }


  return (
    `${time}ごろ、旅の途中の一場面を写真に残しました。` +
    `写真を見返しながら、このときの出来事や景色を振り返ることができます。`
  );

}


/**
 * scenes + panels + photos
 * ↓
 * DiaryEntry[]
 *
 * ★重要な修正版
 *
 * 「1 scene = 1 entry」ではなく、
 *
 * 「写真1枚 = 1 entry」
 *
 * にしています。
 *
 * これにより同じsceneに
 *
 * 東京駅
 * 京都駅
 *
 * が入っても両方表示されます。
 */
export async function toDiaryEntries(
  scenes: SceneRow[],
  panels: PanelRow[],
  photos: PhotoRow[],
  options: {
    contributor?: Contributor;
  } = {},
): Promise<DiaryEntry[]> {

  const contributor =
    options.contributor ??
    ANONYMOUS_CONTRIBUTOR;


  const panelByScene =
    new Map(
      panels.map(
        (p) => [
          p.scene_id,
          p,
        ],
      ),
    );


  /*
   * 元写真全部のURLを発行
   *
   * DiaryDetailScreen側では
   * 実写写真として表示するため、
   * 写真があるsceneでは元写真を使います。
   */
  const paths = [
    ...photos.map(
      (p) =>
        p.storage_path,
    ),

    ...panels
      .map(
        (p) =>
          p.image_path,
      )
      .filter(
        (
          v,
        ): v is string =>
          !!v,
      ),
  ];


  let urls: Record<
    string,
    string
  > = {};


  try {

    urls =
      await photoUrls(
        paths,
      );

  } catch (e) {

    console.warn(
      "署名URLの発行に失敗しました。画像は表示されません。",
      e,
    );

  }


  const result:
    DiaryEntry[] =
    [];


  const sortedScenes =
    [...scenes].sort(
      (a, b) =>
        a.seq -
        b.seq,
    );


  for (
    const scene of sortedScenes
  ) {

    const panel =
      panelByScene.get(
        scene.id,
      );


    const scenePhotos =
      photosOfScene(
        scene,
        photos,
      );


    // ============================================================
    // 写真があるscene
    // ============================================================

    if (
      scenePhotos.length >
      0
    ) {

      for (
        let i = 0;
        i <
        scenePhotos.length;
        i++
      ) {

        const photo =
          scenePhotos[i];


        const location =
          placeOfPhoto(
            photo,
            scene,
          );


        /*
         * Supabase scenes.summary に
         * AI日記が入っていればそれを使用。
         *
         * 空なら一時的な日記文章を表示。
         */
        const diaryText =
          scene.summary?.trim()
            ? scene.summary.trim()
            : fallbackDiaryText(
                photo,
                scene,
              );


        result.push({

          /*
           * 1つのsceneに複数写真があっても
           * Reactのkeyが重複しないID
           */
          id:
            `${scene.id}-${photo.id}`,

          sceneId:
            scene.id,

          photoId:
            photo.id,

          /*
           * Sceneの開始時刻ではなく
           * 写真自身の時刻を使う
           */
          time:
            hhmm(
              timeOf(photo),
            ),

          title:
            location ||
            "この日のひとコマ",

          location,

          aiDiaryText:
            diaryText,

          /*
           * ★重要
           *
           * 写真が存在する場合は
           * generated画像ではなく
           * 必ず元写真を表示。
           *
           * 東京駅・京都駅が
           * そのまま実写として表示される。
           */
          photoUrl:
            urls[
              photo.storage_path
            ] ?? "",

          contributor,

        });

      }


      continue;

    }


    // ============================================================
    // 写真が無い gap scene
    // ============================================================

    /*
     * DiaryDetailScreen.tsx 側で
     * 「新幹線のAI補完」を固定挿入しているため、
     * gapはここではDiaryEntryに追加しません。
     *
     * 追加すると、
     *
     * 東京駅
     * AI補完
     * gap
     * 京都駅
     *
     * のように重複する可能性があります。
     */
    if (
      scene.is_gap
    ) {

      continue;

    }


    /*
     * 写真なし・gapでもない特殊ケース
     *
     * generated画像があれば表示します。
     */
    const generatedUrl =
      panel?.image_path
        ? urls[
            panel.image_path
          ] ?? ""
        : "";


    if (
      generatedUrl
    ) {

      const location =
        placeOf(
          scene,
          photos,
        ) ??
        "旅の途中";


      result.push({

        id:
          panel?.id ??
          scene.id,

        sceneId:
          scene.id,

        photoId:
          "",

        time:
          hhmmOf(
            scene.started_at,
          ),

        title:
          location,

        location,

        aiDiaryText:
          scene.summary?.trim() ||
          "写真には残っていない旅の途中の場面を、AIが補完しています。",

        photoUrl:
          generatedUrl,

        contributor,

      });

    }

  }


  /*
   * 最終的に撮影時刻順に並べる
   */
  return result.sort(
    (a, b) =>
      a.time.localeCompare(
        b.time,
      ),
  );

}


// ================================================================
// MapSpot
// ================================================================

export async function toMapSpots(
  scenes: SceneRow[],
  photos: PhotoRow[],
  options: {
    contributor?: Contributor;
  } = {},
): Promise<MapSpot[]> {

  const contributor =
    options.contributor ??
    ANONYMOUS_CONTRIBUTOR;


  /*
   * ★こちらも1 scene の最初の写真だけではなく
   * 写真単位で地図に出すよう変更
   */
  const usable:
    {
      scene: SceneRow;
      photo: PhotoRow;
    }[] =
    [];


  const sortedScenes =
    [...scenes].sort(
      (a, b) =>
        a.seq -
        b.seq,
    );


  for (
    const scene of sortedScenes
  ) {

    if (
      scene.is_gap
    ) {
      continue;
    }


    const scenePhotos =
      photosOfScene(
        scene,
        photos,
      );


    for (
      const photo of scenePhotos
    ) {

      if (
        photo.latitude === null ||
        photo.longitude === null
      ) {
        continue;
      }


      usable.push({
        scene,
        photo,
      });

    }

  }


  let urls: Record<
    string,
    string
  > = {};


  try {

    urls =
      await photoUrls(
        usable.map(
          (x) =>
            x.photo
              .storage_path,
        ),
      );

  } catch {

    // 画像が出ないだけ

  }


  return usable.map(
    (
      {
        scene,
        photo,
      },
      i,
    ) => {

      const location =
        placeOfPhoto(
          photo,
          scene,
        );


      return {

        id:
          `${scene.id}-${photo.id}`,

        stepNumber:
          i + 1,

        name:
          location ||
          `スポット ${i + 1}`,

        lat:
          photo.latitude as number,

        lng:
          photo.longitude as number,

        time:
          hhmm(
            timeOf(photo),
          ),

        photoUrl:
          urls[
            photo.storage_path
          ] ?? "",

        diarySnippet:
          (
            scene.summary?.trim() ||
            fallbackDiaryText(
              photo,
              scene,
            )
          ).slice(
            0,
            40,
          ),

        contributorName:
          contributor.name,

      };

    },
  );

}


// ================================================================
// Tripを組み立てる
// ================================================================

/**
 * もっとも多い市を取得
 */
function cityOf(
  photos: PhotoRow[],
): string {

  const counts =
    new Map<
      string,
      number
    >();


  for (
    const p of photos
  ) {

    if (
      !p.location_name
    ) {
      continue;
    }


    const city =
      p.location_name
        .split("・")[0]
        .trim();


    if (
      !city
    ) {
      continue;
    }


    counts.set(
      city,
      (
        counts.get(
          city,
        ) ?? 0
      ) + 1,
    );

  }


  let best =
    "";

  let bestCount =
    0;


  for (
    const [
      city,
      n,
    ] of counts
  ) {

    if (
      n >
      bestCount
    ) {

      best =
        city;

      bestCount =
        n;

    }

  }


  return best;

}


/**
 * メインの日付
 */
function mainDateOf(
  photos: PhotoRow[],
  fallbackIso: string,
): string {

  const counts =
    new Map<
      string,
      number
    >();


  for (
    const p of photos
  ) {

    if (
      !p.captured_at
    ) {
      continue;
    }


    const d =
      p.captured_at.slice(
        0,
        10,
      );


    counts.set(
      d,
      (
        counts.get(d) ??
        0
      ) + 1,
    );

  }


  if (
    counts.size ===
    0
  ) {

    return fallbackIso.slice(
      0,
      10,
    );

  }


  let best =
    "";

  let bestCount =
    -1;


  for (
    const [
      d,
      n,
    ] of counts
  ) {

    if (
      n >
        bestCount ||
      (
        n ===
          bestCount &&
        d > best
      )
    ) {

      best =
        d;

      bestCount =
        n;

    }

  }


  return best;

}


// ================================================================
// Summary
// ================================================================

function summarize(
  entries: DiaryEntry[],
  spots: MapSpot[],
  photos: PhotoRow[],
  coverImage: string,
  title: string,
  contributor: Contributor,
): TripSummaryStats {

  const times =
    entries
      .map(
        (e) =>
          e.time,
      )
      .filter(
        Boolean,
      )
      .sort();


  return {

    visitedPlacesCount:
      spots.length,

    travelDuration:
      times.length
        ? `${times[0]} 〜 ${times[times.length - 1]}`
        : "",

    totalPhotosCount:
      photos.length,

    membersCount:
      1,

    topPhotoSpot:
      spots[0]?.name ??
      "",

    topPhotoSpotCount:
      photos.length,

    bestShotUrl:
      coverImage,

    bestShotTitle:
      `${title}のベストショット`,

    bestShotDescription:
      "この旅の一枚。",

    bestShotPhotographer:
      contributor.name,

  };

}


// ================================================================
// loadTrip
// ================================================================

/**
 * tripId → Trip
 */
export async function loadTrip(
  tripId: string,
  options: {
    contributor?: Contributor;
  } = {},
): Promise<Trip> {

  const contributor =
    options.contributor ??
    ANONYMOUS_CONTRIBUTOR;


  const {
    data: tripRow,
    error,
  } =
    await supabase
      .from("trips")
      .select("*")
      .eq(
        "id",
        tripId,
      )
      .single();


  if (
    error ||
    !tripRow
  ) {

    throw new Error(
      `旅行が見つかりません: ${error?.message}`,
    );

  }


  const trip =
    tripRow as TripRow;


  const [
    photos,
    scenes,
    panels,
  ] =
    await Promise.all([
      listPhotos(
        tripId,
      ),
      getScenes(
        tripId,
      ),
      getPanels(
        tripId,
      ),
    ]);


  /*
   * デバッグ用
   *
   * ブラウザのConsoleで
   * 写真2枚が本当に取れているか確認できます。
   */
  console.log(
    "[loadTrip] photos:",
    photos,
  );

  console.log(
    "[loadTrip] scenes:",
    scenes,
  );

  console.log(
    "[loadTrip] panels:",
    panels,
  );


  const entries =
    await toDiaryEntries(
      scenes,
      panels,
      photos,
      {
        contributor,
      },
    );


  console.log(
    "[loadTrip] diary entries:",
    entries,
  );


  const spots =
    await toMapSpots(
      scenes,
      photos,
      {
        contributor,
      },
    );


  /*
   * 表紙は最初の実写写真
   */
  const coverImage =
    entries.find(
      (e) =>
        e.photoUrl,
    )?.photoUrl ??
    "";


  const title =
    trip.title ??
    "旅の記録";


  const destination =
    cityOf(
      photos,
    );


  const date =
    mainDateOf(
      photos,
      trip.created_at,
    );


  return {

    id:
      trip.id,

    title,

    subtitle:
      destination
        ? `${destination}をめぐる一日`
        : "一日の記録",

    date,

    destination,

    coverImage,

    members: [
      contributor,
    ],

    spotsCount:
      spots.length,

    photosCount:
      photos.length,

    weather:
      "",

    spots,

    entries,

    tags:
      Array.from(
        new Set(
          photos
            .map(
              (p) =>
                p.location_name,
            )
            .filter(
              (
                v,
              ): v is string =>
                !!v,
            ),
        ),
      ).slice(
        0,
        5,
      ),

    summaryStats:
      summarize(
        entries,
        spots,
        photos,
        coverImage,
        title,
        contributor,
      ),

    photoItems:
      await toPhotoItems(
        photos,
        {
          contributor,
        },
      ),

  };

}


// ================================================================
// loadMyTrips
// ================================================================

/**
 * 旅行一覧
 */
export async function loadMyTrips(
  limit = 20,
): Promise<Trip[]> {

  const {
    data,
    error,
  } =
    await supabase
      .from("trips")
      .select(
        "id, title, created_at",
      )

      // 本番では有効化
      // .eq("owner_token", ownerToken())

      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        limit,
      );


  if (
    error
  ) {

    console.error(
      "[loadMyTrips] 旅行一覧の取得に失敗しました",
      error,
    );


    throw new Error(
      `旅行の取得に失敗しました: ${error.message}`,
    );

  }


  const rows =
    (
      data ??
      []
    ) as {
      id: string;
      title:
        string | null;
    }[];


  console.info(
    `[loadMyTrips] ${rows.length}件の旅行が見つかりました`,
    rows,
  );


  const settled =
    await Promise.allSettled(
      rows.map(
        (row) =>
          loadTrip(
            row.id,
          ),
      ),
    );


  const trips:
    Trip[] =
    [];


  settled.forEach(
    (
      r,
      i,
    ) => {

      if (
        r.status ===
        "fulfilled"
      ) {

        trips.push(
          r.value,
        );

      } else {

        console.error(
          `[loadMyTrips] 旅行 ${rows[i].id} の読み込みに失敗しました`,
          r.reason,
        );

      }

    },
  );


  console.info(
    `[loadMyTrips] ${trips.length}件を画面に渡します`,
  );


  return trips;

}