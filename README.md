# Mトリープ — パイプ層（担当分一式）

DB と、フロント／生成の間をつなぐ部分です。
**Supabase を呼ぶコードはすべてこの `src/lib/` に閉じています。**
画面のコードからは、ここの関数を呼ぶだけで済むようにしてあります。

---

## ファイルの役割

| ファイル | 何をするか | Supabase が要るか |
|---|---|---|
| `src/lib/splitScenes.ts` | 写真を「シーン」に束ねる。このプロダクトの中核 | **不要** |
| `src/lib/buildPrompt.ts` | 各コマに渡す指示文を組み立てる。画風の統一もここ | **不要** |
| `src/lib/types.ts` | チーム共通の型。DBの行 ↔ コード用の型の変換 | **不要** |
| `src/lib/exif.ts` | 写真から撮影時刻と位置を取り出す | 不要 |
| `src/lib/env.ts` | 接続情報の読み込み。設定はここ1箇所 | — |
| `src/lib/supabase.ts` | クライアント | 要 |
| `src/lib/photos.ts` | 旅行の作成、写真のアップロード、一覧取得 | 要 |
| `src/lib/scenes.ts` | シーンとコマ枠の保存・取得 | 要 |
| `src/lib/realtime.ts` | できたコマを順に受け取る購読 | 要 |

上4つは Supabase がなくても動きます。テーブルができるのを待たずに触れます。

---

## 導入

```bash
npm install @supabase/supabase-js exifr
cp .env.local.example .env.local     # 値を入れる
```

`.env.local` に接続情報を書きます（Supabase の Project Settings → API）。
ビルドツールを使っていない構成なら、`src/lib/env.ts` の2行を直接書き換えてください。

**`.env.local` は絶対にコミットしないこと。** `.gitignore` に入れてあります。

### テーブルができたら

```bash
npx supabase gen types typescript --project-id "プロジェクトのref" --schema public \
  > src/lib/database.types.ts
```

A担当が列を変えるたびに、これを叩き直せば型が追従します。

---

## A担当に渡すもの

`sql/schema.sql` をそのまま渡してください。中身は3つです。

1. `trips` / `photos` / `scenes` / `panels` のテーブル定義
2. RLS のポリシー（**これが無いと、入れたデータが読めません**）
3. Realtime の有効化（**これが無いと、絵ができても画面が更新されません**）

あわせて口頭で2つ伝えてください。

- **Storage に `photos` バケットを作り、Public bucket を ON**
- **`captured_at` は絶対に NOT NULL にしない**（スクショや位置情報オフの写真で普通に空になります）

`photos` は確定したスキーマのままです。`scenes` / `panels` は先回りで用意したものなので、
列名の希望があればそちらに合わせて直します。

---

## 使い方

### 写真をアップロードする

```ts
import { createTrip, uploadPhotos } from "./lib/photos.ts";

const trip = await createTrip("京都");

const { uploaded, failed } = await uploadPhotos(files, trip.id, (done, total) => {
  progressBar.textContent = `${done} / ${total}`;
});

if (failed.length) console.warn("失敗した写真:", failed);
```

EXIF の読み取りはこの中で自動的に行われます。呼ぶ側は意識しなくて構いません。

### シーンに分けて、コマ枠を作る

```ts
import { prepareScenes } from "./lib/scenes.ts";

const { scenes, panels } = await prepareScenes(trip.id);
// scenes … 日記のコマ割り（空白シーンを含む）
// panels … 各コマの生成枠（status: 'pending'）
```

このあと、生成担当の Edge Function を `panels` の数だけ呼びます。

### できたコマから順に表示する

```ts
import { subscribePanels } from "./lib/realtime.ts";

const unsubscribe = subscribePanels(trip.id, {
  onDone: (panel) => showPanel(panel),
  onFailed: (panel) => showFallback(panel),
});

// 画面を離れるときに必ず
unsubscribe();
```

ポーリングは不要です。DB が更新された瞬間に届きます。

### 手元の写真に EXIF が残っているか確かめる

```ts
import { inspectExif } from "./lib/exif.ts";

const result = await inspectExif([...fileInput.files]);
console.log(`時刻あり ${result.withTime}/${result.total}、位置あり ${result.withLocation}/${result.total}`);
```

**デモ用の写真を用意したら、まずこれを通してください。** ここが 0 だと何も動きません。

---

## 動作確認

```bash
npm run test        # splitScenes のテスト9件
npm run demo        # 一日ぶんのサンプルで、コマ割りを目で見る
npm run typecheck   # 型チェック
```

`npm run demo` の出力：

```
  写真 12枚 → シーンに分割

   1  09:12 - 09:24   写真 3枚
   2  10:40 - 10:44   写真 2枚
   3  10:44 - 14:10   空白シーン（AIが描く）
   4  14:10 - 14:22   写真 3枚
   ...
```

---

## この実装で決めていること

**EXIF が無い写真の扱い** — `captured_at` が空なら `created_at`（アップロード順）で代用します。
判断しているのは `types.ts` の `toPhotoMeta()` 1箇所だけなので、変えたければそこを直してください。

**位置が無い写真の扱い** — 距離の条件は、両方の写真に位置があるときだけ効かせます。
片方でも欠けていれば時間差だけで判定します。GPS が1件も無くても動きます。

**シーン分割の閾値** — 45分 / 500m / 90分 / 最大5コマ。`splitScenes.ts` の `DEFAULT_CONFIG` にあります。
**デモ用の写真が揃ったら、ここを実データに合わせて調整するのが本番前の最後の仕事です。**

**アップロードの失敗** — DB への登録に失敗したら、Storage に上げた画像を消して整合を保ちます。
複数枚のときは1枚失敗しても止まらず、`failed` に分けて返します。

**人物は後ろ姿** — `buildPrompt.ts` の `PERSON`。顔を描かせるとコマごとに別人になるため。

---

## まだ入っていないもの

- **`location_name` を埋める処理** — 緯度経度から地名を引く逆ジオコーディングが必要です。
  無くても動きますが、あるとプロンプトの質が上がります。余力があれば。
- **`summary`（シーンの文章）の生成** — LLM を呼ぶ部分。生成担当と分担を相談してください。
- **生成 Edge Function の呼び出し** — 関数名が決まり次第、`scenes.ts` に数行足せば繋がります。
