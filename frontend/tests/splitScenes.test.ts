/**
 * splitScenes のテスト
 *
 *   npx tsx --test splitScenes.test.ts     … テストを走らせる
 *   npx tsx splitScenes.demo.ts            … 一日ぶんの結果を目で見る
 */

import test from "node:test";
import assert from "node:assert/strict";
import { splitScenes, DEFAULT_CONFIG, type PhotoMeta } from "../src/lib/splitScenes.ts";

// 京都のだいたいの座標。テストしやすいように名前をつけておく
const KIYOMIZU = { lat: 34.9949, lng: 135.7850 };
const GION = { lat: 35.0037, lng: 135.7752 };
const KINKAKUJI = { lat: 35.0394, lng: 135.7292 };

let n = 0;
/** "09:20" のような文字列から写真を1枚つくる */
function photo(hhmm: string, place: { lat: number; lng: number } | null): PhotoMeta {
  const [h, m] = hhmm.split(":").map(Number);
  return {
    id: `p${++n}`,
    takenAt: new Date(2026, 7, 15, h, m),
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
  };
}

test("近い時刻・近い場所の写真は1つのシーンになる", () => {
  const scenes = splitScenes([
    photo("09:12", KIYOMIZU),
    photo("09:15", KIYOMIZU),
    photo("09:20", KIYOMIZU),
  ]);

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].photoIds.length, 3);
  assert.equal(scenes[0].isGap, false);
});

test("時間が大きく空くとシーンが切れる", () => {
  const scenes = splitScenes([
    photo("09:12", KIYOMIZU),
    photo("09:20", KIYOMIZU),
    photo("11:40", GION), // 2時間20分あく
    photo("11:50", GION),
  ]);

  const real = scenes.filter((s) => !s.isGap);
  assert.equal(real.length, 2);
});

test("時刻が近くても場所が離れていれば別のシーンになる", () => {
  const scenes = splitScenes([
    photo("09:12", KIYOMIZU),
    photo("09:30", KINKAKUJI), // 18分後だが約8km先
  ]);

  assert.equal(scenes.filter((s) => !s.isGap).length, 2);
});

test("位置が無い写真は、時間だけで判定される", () => {
  const scenes = splitScenes([
    photo("09:12", null),
    photo("09:20", null),
    photo("09:25", KIYOMIZU),
  ]);

  // 距離が測れないので切らない
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].photoIds.length, 3);
});

test("90分以上あいたら空白シーンが差し込まれる", () => {
  const scenes = splitScenes([
    photo("09:12", KIYOMIZU),
    photo("09:20", KIYOMIZU),
    photo("13:00", GION), // 3時間40分あく
    photo("13:10", GION),
  ]);

  const gaps = scenes.filter((s) => s.isGap);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].photoIds.length, 0);
  // 空白シーンは前のシーンの終わりから次のシーンの始まりまで
  assert.equal(gaps[0].startedAt.getHours(), 9);
  assert.equal(gaps[0].endedAt.getHours(), 13);
});

test("シーンが多すぎるときは、間隔の短いものから順にまとめられる", () => {
  const scenes = splitScenes(
    [
      // 30分おき。どこも空白コマになるほどは空いていない
      photo("09:00", KIYOMIZU),
      photo("10:00", GION),
      photo("11:00", KINKAKUJI),
      photo("12:00", KIYOMIZU),
      photo("13:00", GION),
      photo("14:00", KINKAKUJI),
      photo("15:00", KIYOMIZU),
    ],
    { ...DEFAULT_CONFIG, targetSceneCount: 3 },
  );

  assert.equal(scenes.filter((s) => !s.isGap).length, 3);
  // 写真が消えていないこと
  const total = scenes.flatMap((s) => s.photoIds).length;
  assert.equal(total, 7);
});

test("大きく空いた時間は、コマ数を減らすときも潰されない", () => {
  // 午前に3枚、午後に3枚。間の11:00〜16:00は写真が無い
  const scenes = splitScenes(
    [
      photo("09:00", KIYOMIZU),
      photo("10:00", KIYOMIZU),
      photo("11:00", GION),
      photo("16:00", KINKAKUJI),
      photo("17:00", KINKAKUJI),
      photo("18:00", GION),
    ],
    { ...DEFAULT_CONFIG, targetSceneCount: 2 },
  );

  // 目標が2コマでも、空白の時間帯は残る
  const gaps = scenes.filter((s) => s.isGap);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].startedAt.getHours(), 11);
  assert.equal(gaps[0].endedAt.getHours(), 16);

  const total = scenes.flatMap((s) => s.photoIds).length;
  assert.equal(total, 6);
});

test("コマ数の上限を超えたら、大きな間隔でもまとめる", () => {
  // 2時間おきに7枚。全部が空白コマ級に空いている
  const scenes = splitScenes(
    [
      photo("07:00", KIYOMIZU),
      photo("09:00", GION),
      photo("11:00", KINKAKUJI),
      photo("13:00", KIYOMIZU),
      photo("15:00", GION),
      photo("17:00", KINKAKUJI),
      photo("19:00", KIYOMIZU),
    ],
    { ...DEFAULT_CONFIG, targetSceneCount: 3, maxSceneCount: 5 },
  );

  const withPhotos = scenes.filter((s) => !s.isGap).length;
  assert.ok(withPhotos <= 5, `写真のあるコマが多すぎます: ${withPhotos}`);

  const total = scenes.flatMap((s) => s.photoIds).length;
  assert.equal(total, 7);
});

test("歩きながら撮り続けても1シーンに繋がらない", () => {
  // 10分おきに5時間、少しずつ移動しながら撮り続けた日
  const photos: PhotoMeta[] = [];
  for (let i = 0; i < 30; i++) {
    const h = 9 + Math.floor((i * 10) / 60);
    const m = (i * 10) % 60;
    photos.push(
      photo(`${h}:${String(m).padStart(2, "0")}`, {
        lat: KIYOMIZU.lat + i * 0.0002,
        lng: KIYOMIZU.lng + i * 0.0002,
      }),
    );
  }

  const scenes = splitScenes(photos);
  assert.ok(scenes.filter((s) => !s.isGap).length > 1, "1つに繋がってしまった");
});

test("写真が0枚なら空の配列", () => {
  assert.deepEqual(splitScenes([]), []);
});

test("並び順がバラバラでも結果は同じ", () => {
  const photos = [
    photo("13:00", GION),
    photo("09:12", KIYOMIZU),
    photo("13:10", GION),
    photo("09:20", KIYOMIZU),
  ];
  const a = splitScenes(photos);
  const b = splitScenes([...photos].reverse());

  assert.deepEqual(
    a.map((s) => s.photoIds.sort()),
    b.map((s) => s.photoIds.sort()),
  );
});
