/**
 * Supabase の接続情報。読み込み方をここ1箇所に閉じ込めています。
 *
 * Vite を使っているなら、プロジェクト直下の .env.local に次の2行を書けばそのまま動きます。
 *   VITE_SUPABASE_URL=https://xxxxx.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=xxxxx
 *
 * ビルドツールを使わない構成なら、下の2つを直接文字列に書き換えてください。
 *   export const SUPABASE_URL = "https://xxxxx.supabase.co";
 *
 * Publishable key はブラウザに置いてよい鍵です。
 * Secret key は絶対にここへ書かないこと（Edge Function の中だけで使う）。
 */

const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY: string = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

/** 設定漏れを、原因のわかるエラーにして早めに落とす */
export function assertEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase の接続情報が設定されていません。" +
        ".env.local に VITE_SUPABASE_URL と VITE_SUPABASE_PUBLISHABLE_KEY を書くか、" +
        "src/lib/env.ts に直接記入してください。",
    );
  }
}
