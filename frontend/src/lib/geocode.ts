/**
 * geocode — 緯度経度から地名を引く
 *
 * 写真から取れるのは数字だけなので、そのままでは
 *   ・画面に「34.6878」としか出せない
 *   ・生成AIに「34.6878の夕方」としか言えない
 * という状態になります。ここで「東大寺」「奈良市・大豆山町」に変換します。
 *
 * 2段構えです。
 *   1. Overpass で、近くにある名前付きの観光地・史跡・公園を探す（→「東大寺」）
 *   2. 見つからなければ Nominatim で住所を引く（→「奈良市・大豆山町」）
 *
 * 1 を先にやるのは、逆ジオコーディング（2）が返すのは住所であって
 * ランドマーク名ではないためです。実際 zoom=18 で引くと、
 * 一番近いノードに吸着して「ゴミ箱」を拾ったりします。
 * 絵日記のプロンプトに効くのはランドマーク名のほうなので、そちらを優先します。
 *
 * どちらも無料・APIキー不要ですが、利用規約に「1秒に1リクエストまで」があります。
 *   ・呼び出しを直列にして間隔をあける
 *   ・同じ場所は結果を使い回す（座標を丸めてキャッシュ）
 * の2つで守っています。写真20枚でも実際のリクエストは数回で済みます。
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const OVERPASS = "https://overpass-api.de/api/interpreter";

const MIN_INTERVAL_MS = 1100; // 利用規約：1秒に1回まで
const CACHE_PRECISION = 3; // 小数3桁 ≒ 110m。同じスポットは1回で済ませる
const LANDMARK_RADIUS_M = 400; // この距離までのスポットを「その場所」とみなす

export type Place = {
  /** 具体的な場所。「東大寺」「大豆山町」など。取れなければ null */
  specific: string | null;
  /** 広域。「奈良市」など。取れなければ null */
  area: string | null;
  /** 画面やプロンプトにそのまま使える表記。「奈良市・東大寺」 */
  label: string;
  /** specific がランドマーク（観光地・史跡・公園）から取れたか */
  isLandmark: boolean;
};

const EMPTY: Place = { specific: null, area: null, label: "", isLandmark: false };

const cache = new Map<string, Place>();
/** 直列に流すためのキュー。前のリクエストが終わるまで次を始めない */
let queue: Promise<unknown> = Promise.resolve();

const keyOf = (lat: number, lng: number) =>
  `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------- 1. ランドマーク

type OverpassElement = {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * 近くにある名前付きの観光地・史跡・公園・神社仏閣を探して、
 * 一番近いものの名前を返す。
 */
async function findLandmark(lat: number, lng: number): Promise<string | null> {
  const around = `${LANDMARK_RADIUS_M},${lat},${lng}`;
  const query = [
    "[out:json][timeout:15];",
    "(",
    `  nwr(around:${around})["name"]["tourism"];`,
    `  nwr(around:${around})["name"]["historic"];`,
    `  nwr(around:${around})["name"]["leisure"="park"];`,
    `  nwr(around:${around})["name"]["amenity"="place_of_worship"];`,
    ");",
    "out center 30;",
  ].join("\n");

  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { elements?: OverpassElement[] };
  const elements = json.elements ?? [];

  let best: string | null = null;
  let bestDist = Infinity;

  for (const el of elements) {
    const name = el.tags?.["name:ja"] ?? el.tags?.name;
    if (!name) continue;
    const eLat = el.lat ?? el.center?.lat;
    const eLng = el.lon ?? el.center?.lon;
    if (eLat === undefined || eLng === undefined) continue;

    const d = distanceMeters(lat, lng, eLat, eLng);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// ---------------------------------------------------------------- 2. 住所

/**
 * 住所から、具体的な地名と広域の地名を取り出す。
 *
 * name フィールドは信用しません。zoom を細かくすると一番近いノードに
 * 吸着して、ゴミ箱やベンチの名前を拾うことがあるためです。
 */
async function findAddress(
  lat: number,
  lng: number,
): Promise<{ specific: string | null; area: string | null }> {
  const url =
    `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lng}` +
    `&zoom=16&accept-language=ja`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return { specific: null, area: null };

  const json = (await res.json()) as { address?: Record<string, string> };
  const a = json.address ?? {};

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  return {
    specific: pick("neighbourhood", "quarter", "suburb", "road", "city_district"),
    area: pick("city", "town", "village", "province", "state"),
  };
}

// ---------------------------------------------------------------- 本体

/**
 * 1点の地名を引く。失敗しても例外は投げず、空の Place を返します
 * （地名が無くても他は動くため、ここで止めない）。
 */
export function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const key = keyOf(lat, lng);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const task = queue.then(async () => {
    const again = cache.get(key);
    if (again) return again;

    let place: Place = { ...EMPTY };

    try {
      const landmark = await findLandmark(lat, lng);
      await sleep(MIN_INTERVAL_MS);
      const addr = await findAddress(lat, lng);

      const specific = landmark ?? addr.specific;
      const area = addr.area;
      place = {
        specific,
        area,
        isLandmark: landmark !== null,
        label: [area, specific].filter(Boolean).join("・"),
      };
    } catch (e) {
      console.warn("地名の取得に失敗しました", e);
    } finally {
      await sleep(MIN_INTERVAL_MS);
    }

    cache.set(key, place);
    return place;
  });

  queue = task.catch(() => undefined);
  return task;
}

/** 画面やDBに入れる用の文字列だけ欲しいとき。地名が無ければ null */
export async function reverseGeocodeName(
  lat: number,
  lng: number,
): Promise<string | null> {
  const place = await reverseGeocode(lat, lng);
  return place.label || null;
}

/**
 * 複数の座標をまとめて引く。渡した配列と同じ順番・同じ長さで返ります。
 * キャッシュが効くので、同じ場所の写真が並んでいても通信は1回です。
 */
export async function reverseGeocodeMany(
  points: { lat: number | null; lng: number | null }[],
): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (const p of points) {
    if (p.lat === null || p.lng === null) {
      out.push(null);
      continue;
    }
    out.push(await reverseGeocodeName(p.lat, p.lng));
  }
  return out;
}

/** すでに引いた結果だけを見る（通信しない） */
export function cachedPlace(lat: number, lng: number): Place | undefined {
  return cache.get(keyOf(lat, lng));
}
