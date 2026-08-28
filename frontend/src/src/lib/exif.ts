import exifr from "exifr";

export type ExifResult = {
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
};

const EMPTY: ExifResult = { capturedAt: null, latitude: null, longitude: null };

/**
 * 画像ファイルから撮影日時と位置を取り出す。
 *
 * アップロードの「前」に呼ぶこと。理由が2つあります。
 *   1. サーバー側で読むと、画像をもう一度ダウンロードすることになる
 *   2. リサイズや圧縮を挟むと EXIF が消えることがある
 *
 * スクリーンショットや SNS 経由の写真には EXIF が無いのが普通なので、
 * 失敗しても例外は投げず、null を返します。
 */
export async function readExif(file: File | Blob): Promise<ExifResult> {
  try {
    const raw = await exifr.parse(file, [
      "DateTimeOriginal",
      "CreateDate",
      "GPSLatitude",
      "GPSLongitude",
    ]);
    if (!raw) return EMPTY;

    const taken = raw.DateTimeOriginal ?? raw.CreateDate ?? null;
    const capturedAt =
      taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : null;

    const lat = typeof raw.latitude === "number" ? raw.latitude : null;
    const lng = typeof raw.longitude === "number" ? raw.longitude : null;

    return { capturedAt, latitude: lat, longitude: lng };
  } catch {
    return EMPTY;
  }
}

/**
 * 手元の写真に EXIF が残っているかを確かめるための関数。
 * デモ用の写真セットを用意したら、まずこれを通してください。
 */
export async function inspectExif(files: (File | Blob)[]): Promise<{
  total: number;
  withTime: number;
  withLocation: number;
  details: (ExifResult & { name: string })[];
}> {
  const details = await Promise.all(
    files.map(async (f) => ({
      name: (f as File).name ?? "(no name)",
      ...(await readExif(f)),
    })),
  );
  return {
    total: details.length,
    withTime: details.filter((d) => d.capturedAt !== null).length,
    withLocation: details.filter((d) => d.latitude !== null).length,
    details,
  };
}
