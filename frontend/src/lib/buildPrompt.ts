import type { SceneRow, PhotoRow } from "./types.ts";

/**
 * 各コマに渡す指示文を組み立てる。
 *
 * 生成担当は「APIを叩く配管」を作る側なので、何を描かせるかはこちらで決めます。
 * 絵日記としてのまとまりは、ほぼこのファイルで決まります。
 */

/** 全コマ共通のスタイル。ここを1つに固定するのが画風を揃える一番の近道 */
export const STYLE =
  "手描きの水彩絵日記風。やわらかい線と淡い彩色。落ち着いた色調。文字は描かない。";

/** 人物は後ろ姿にする。顔を描かせると、コマごとに別人になって破綻するため */
export const PERSON = "登場人物は後ろ姿かシルエットで描く。顔は描かない。";

function timeOfDay(iso: string): string {
  const h = new Date(iso).getHours();
  if (h < 10) return "朝";
  if (h < 15) return "昼";
  if (h < 18) return "夕方";
  return "夜";
}

function minutesOf(scene: SceneRow): number {
  return Math.round(
    (new Date(scene.ended_at).getTime() - new Date(scene.started_at).getTime()) / 60000,
  );
}

/** そのシーンに紐づく写真から、場所の名前を1つ拾う（無ければ null） */
export function placeOfScene(scene: SceneRow, photos: PhotoRow[]): string | null {
  const inScene = photos.filter((p) => scene.photo_ids.includes(p.id));
  return inScene.find((p) => p.location_name)?.location_name ?? null;
}

/** 写真があるコマ：その写真を絵に変換させる */
export function promptForPhotoScene(scene: SceneRow, photos: PhotoRow[]): string {
  const place = placeOfScene(scene, photos);
  return [
    `${timeOfDay(scene.started_at)}の場面。`,
    place ? `場所は${place}。` : "",
    "参照する写真の構図と被写体をそのまま活かして、絵に描き起こす。",
    PERSON,
    STYLE,
  ]
    .filter(Boolean)
    .join(" ");
}

/** 写真がないコマ：前後のシーンから想像で描かせる */
export function promptForGapScene(
  scene: SceneRow,
  before: SceneRow | undefined,
  after: SceneRow | undefined,
  photos: PhotoRow[],
): string {
  const from = before ? placeOfScene(before, photos) : null;
  const to = after ? placeOfScene(after, photos) : null;

  return [
    `${timeOfDay(scene.started_at)}の、写真が残っていない${minutesOf(scene)}分間の場面。`,
    from && to
      ? `${from}から${to}へ移動している途中の風景を想像して描く。`
      : "旅の途中の、なんでもない時間の風景を想像して描く。",
    "特定の建物を断定せず、雰囲気で描く。",
    PERSON,
    STYLE,
  ]
    .filter(Boolean)
    .join(" ");
}

/** シーン一覧から、全コマぶんのプロンプトをまとめて作る */
export function buildPrompts(
  scenes: SceneRow[],
  photos: PhotoRow[],
): { sceneId: string; seq: number; prompt: string }[] {
  const ordered = [...scenes].sort((a, b) => a.seq - b.seq);
  return ordered.map((s, i) => ({
    sceneId: s.id,
    seq: s.seq,
    prompt: s.is_gap
      ? promptForGapScene(s, ordered[i - 1], ordered[i + 1], photos)
      : promptForPhotoScene(s, photos),
  }));
}
