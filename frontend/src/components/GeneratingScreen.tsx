import React, {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  Sparkles,
  Check,
  ArrowRight,
  BookOpen,
  ImageIcon,
  Wand2,
  AlertTriangle,
} from 'lucide-react';

import confetti from 'canvas-confetti';

import {
  getScenes,
  getPanels,
} from '../lib/scenes';

import { subscribePanels } from '../lib/realtime';

import type { PanelStatus } from '../lib/types';


interface GeneratingScreenProps {
  /**
   * Supabase 上の旅行ID。
   * null のときは何も待たずに先へ進みます
   */
  tripId: string | null;

  onComplete: () => void;
}


type Frame = {
  sceneId: string;
  seq: number;
  isGap: boolean;
  status: PanelStatus;
};


/**
 * これを過ぎても終わらなければ、
 * Pythonバックエンド側のAI生成処理が
 * 動いていない可能性を伝える
 */
const SLOW_AFTER_MS = 60_000;


/**
 * GeneratingScreen
 *
 * この画面自身はAI生成を開始しません。
 *
 * Pythonバックエンドの main.py が
 *
 * process_pending_panels()
 *
 * を定期的に実行し、
 * Supabase の pending panel を処理します。
 *
 * この画面の役割は、
 *
 * 1. scenes / panels を読み込む
 * 2. Supabase Realtime で panels の状態を監視
 * 3. pending → running → done / failed を表示
 * 4. 全コマ終了後に日記画面へ進む
 *
 * です。
 */
export const GeneratingScreen:
React.FC<GeneratingScreenProps> = ({
  tripId,
  onComplete,
}) => {

  const [
    frames,
    setFrames,
  ] = useState<Frame[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    isDone,
    setIsDone,
  ] = useState(false);


  const [
    isSlow,
    setIsSlow,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState<string | null>(null);


  /**
   * 完了処理を複数回実行しないため
   */
  const celebrated =
    useRef(false);


  /* =========================================================
     1.
     現在の scenes / panels を取得
  ========================================================= */

  useEffect(() => {

    if (!tripId) {

      setLoading(false);

      return;
    }


    let cancelled = false;


    const loadFrames = async () => {

      try {

        console.log(
          '[GeneratingScreen] scenes / panels 読み込み開始',
          tripId,
        );


        const [
          scenes,
          panels,
        ] = await Promise.all([

          getScenes(tripId),

          getPanels(tripId),

        ]);


        if (cancelled) {
          return;
        }


        const byScene =
          new Map(
            panels.map(
              (panel) => [
                panel.scene_id,
                panel,
              ],
            ),
          );


        const list: Frame[] =
          [...scenes]

            .sort(
              (a, b) =>
                a.seq - b.seq,
            )

            .map(
              (scene) => ({

                sceneId:
                  scene.id,

                seq:
                  scene.seq,

                isGap:
                  scene.is_gap,

                status:
                  byScene.get(
                    scene.id,
                  )?.status ??
                  'pending',

              }),
            );


        console.log(
          '[GeneratingScreen] 読み込み完了',
          list,
        );


        setFrames(list);

        setError(null);

        setLoading(false);

      } catch (e) {

        console.error(
          '[GeneratingScreen] 読み込み失敗',
          e,
        );


        if (!cancelled) {

          setError(
            `生成データの読み込みに失敗しました: ${String(e)}`,
          );

          setLoading(false);
        }
      }
    };


    void loadFrames();


    return () => {

      cancelled = true;

    };

  }, [tripId]);


  /* =========================================================
     2.
     panels の変更をリアルタイム受信

     ★ここが重要

     AI生成自体はPythonバックエンドが行います。

     この画面から
     supabase.functions.invoke()
     は呼びません。
  ========================================================= */

  useEffect(() => {

    if (!tripId) {
      return;
    }


    console.log(
      '[GeneratingScreen] realtime 購読開始',
      tripId,
    );


    const unsubscribe =
      subscribePanels(
        tripId,
        {

          onChange:
            (panel) => {

              console.log(
                '[GeneratingScreen] panel変更',
                panel,
              );


              setFrames(
                (prev) =>

                  prev.map(
                    (frame) =>

                      frame.sceneId ===
                      panel.scene_id

                        ? {
                            ...frame,

                            status:
                              panel.status,
                          }

                        : frame,

                  ),
              );
            },

        },
      );


    return unsubscribe;

  }, [tripId]);


  /* =========================================================
     3.
     Realtime が取りこぼした場合の保険として
     定期的に panels を再取得する

     PythonバックエンドがSupabaseを更新していても
     Realtime設定などの問題で画面に反映されない場合が
     あるため、3秒ごとに状態を確認します。
  ========================================================= */

  useEffect(() => {

    if (!tripId) {
      return;
    }


    let cancelled = false;


    const refreshPanels = async () => {

      try {

        const panels =
          await getPanels(tripId);


        if (cancelled) {
          return;
        }


        const byScene =
          new Map(
            panels.map(
              (panel) => [
                panel.scene_id,
                panel,
              ],
            ),
          );


        setFrames(
          (prev) =>
            prev.map(
              (frame) => {

                const panel =
                  byScene.get(
                    frame.sceneId,
                  );


                if (!panel) {
                  return frame;
                }


                if (
                  panel.status ===
                  frame.status
                ) {
                  return frame;
                }


                console.log(
                  '[GeneratingScreen] pollingでpanel変更を検出',
                  {
                    sceneId:
                      frame.sceneId,

                    before:
                      frame.status,

                    after:
                      panel.status,
                  },
                );


                return {
                  ...frame,

                  status:
                    panel.status,
                };
              },
            ),
        );

      } catch (e) {

        console.error(
          '[GeneratingScreen] panels再取得失敗',
          e,
        );
      }
    };


    const timer =
      window.setInterval(
        () => {
          void refreshPanels();
        },
        3000,
      );


    return () => {

      cancelled = true;

      window.clearInterval(
        timer,
      );

    };

  }, [tripId]);


  /* =========================================================
     4.
     時間がかかりすぎていないか
  ========================================================= */

  useEffect(() => {

    const timer =
      setTimeout(
        () => {

          setIsSlow(true);

        },
        SLOW_AFTER_MS,
      );


    return () =>
      clearTimeout(timer);

  }, []);


  /* =========================================================
     5.
     進捗計算
  ========================================================= */

  const total =
    frames.length;


  /**
   * 本当に成功した数
   */
  const completed =
    frames.filter(
      (frame) =>
        frame.status ===
        'done',
    ).length;


  /**
   * 失敗した数
   */
  const failed =
    frames.filter(
      (frame) =>
        frame.status ===
        'failed',
    ).length;


  /**
   * running
   */
  const running =
    frames.filter(
      (frame) =>
        frame.status ===
        'running',
    ).length;


  /**
   * 処理自体が終了したもの
   */
  const finished =
    completed + failed;


  const progress =
    total === 0

      ? 0

      : Math.round(
          (finished / total) *
          100,
        );


  /* =========================================================
     6.
     全コマの処理終了
  ========================================================= */

  useEffect(() => {

    if (loading) {
      return;
    }


    if (total === 0) {
      return;
    }


    /*
     * まだ処理中
     */
    if (finished < total) {
      return;
    }


    /*
     * すでに完了処理済み
     */
    if (celebrated.current) {
      return;
    }


    celebrated.current = true;


    /*
     * 全件失敗の場合は
     * 自動で成功扱いにしない
     */
    if (
      failed === total
    ) {

      setError(
        'すべてのAI生成に失敗しました。PythonバックエンドまたはGemini APIの設定を確認してください。',
      );

      return;
    }


    setIsDone(true);


    try {

      confetti({

        particleCount: 55,

        spread: 65,

        origin: {
          y: 0.6,
        },

        colors: [
          '#2563EB',
          '#38BDF8',
          '#0D9488',
          '#FBBF24',
        ],

      });

    } catch {

      /*
       * confetti が失敗しても
       * 処理には影響させない
       */
    }


    /*
     * ★修正点
     *
     * setTimeout を使わず、
     * 全コマ終了後すぐに日記画面へ進む。
     *
     * 以前は timeout の cleanup によって
     * onComplete が実行されない可能性がありました。
     */
    console.log(
      '[GeneratingScreen] 全コマ完了 → 日記画面へ移動',
    );

    onComplete();

  }, [
    loading,
    total,
    finished,
    failed,
    onComplete,
  ]);


  /* =========================================================
     7.
     tripId が無い場合
  ========================================================= */

  useEffect(() => {

    if (
      !tripId &&
      !loading
    ) {

      onComplete();

    }

  }, [
    tripId,
    loading,
    onComplete,
  ]);


  /* =========================================================
     表示用テキスト
  ========================================================= */

  const headline =
    isDone

      ? '写真日記ができました'

      : failed === total &&
        total > 0

        ? '生成に失敗しました'

        : running > 0

          ? '一日を絵と日記にしています'

          : finished === 0

            ? '生成の準備をしています'

            : '一日を絵と日記にしています';


  /* =========================================================
     UI
  ========================================================= */

  return (

    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 max-w-xl mx-auto text-center py-10">


      {/* =====================================
          回転リング
      ====================================== */}

      <div className="relative mb-8">

        <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-sky-200/50 via-blue-100/50 to-teal-100/50 flex items-center justify-center p-3 animate-spin duration-[15000ms]">

          <div className="w-full h-full rounded-full border-2 border-dashed border-sky-400/80" />

        </div>


        <div className="absolute inset-0 m-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-sky-400 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">

          <div className="relative">

            {isDone ? (

              <BookOpen className="w-11 h-11" />

            ) : (

              <Wand2 className="w-11 h-11 animate-pulse" />

            )}


            <Sparkles className="w-5 h-5 text-sky-200 absolute -top-2 -right-2 animate-bounce" />

          </div>

        </div>

      </div>


      {/* =====================================
          タイトル
      ====================================== */}

      <div className="space-y-2 mb-8">

        <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-blue-800 text-xs font-bold tracking-wider">

          写真と旅の情報から、AIが日記を作っています

        </span>


        <h2 className="text-2xl sm:text-3xl font-bold font-title text-slate-800">

          {headline}

        </h2>


        <p className="text-sm text-slate-500 font-diary max-w-md mx-auto min-h-10 flex items-center justify-center">

          {loading

            ? 'コマ割りを読み込んでいます…'

            : total === 0

              ? 'コマがまだありません'

              : failed > 0

                ? `${total}コマ中 ${completed}コマ完成・${failed}コマ失敗`

                : `${total}コマ中 ${completed}コマが完成しました`}

        </p>

      </div>


      {/* =====================================
          進捗カード
      ====================================== */}

      <div className="w-full bg-white rounded-3xl p-6 border border-sky-100 shadow-md shadow-sky-100/50 mb-6">


        <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-2">

          <span className="flex items-center gap-1.5 text-blue-600">

            <Sparkles
              className={`w-3.5 h-3.5 ${
                !isDone &&
                finished < total
                  ? 'animate-spin'
                  : ''
              }`}
            />

            写真日記を自動生成中

          </span>


          <span className="font-mono text-sm text-blue-700">

            {progress}%

          </span>

        </div>


        {/* プログレスバー */}

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">

          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-teal-400 rounded-full transition-all duration-500 ease-out"

            style={{
              width:
                `${progress}%`,
            }}

          />

        </div>


        {/* =====================================
            コマごとの状態
        ====================================== */}

        <div className="grid grid-cols-1 gap-2 mt-5 text-left text-xs">

          {frames.map(
            (frame) => {

              const done =
                frame.status ===
                'done';


              const isFailed =
                frame.status ===
                'failed';


              const isRunning =
                frame.status ===
                'running';


              return (

                <div
                  key={
                    frame.sceneId
                  }

                  className={`flex items-center gap-2.5 p-2.5 rounded-2xl transition-colors ${
                    done

                      ? 'bg-blue-50/70 text-blue-900 font-medium'

                      : isFailed

                        ? 'bg-rose-50/70 text-rose-800 font-medium'

                        : isRunning

                          ? 'bg-sky-100/70 text-blue-950 font-bold border border-sky-300/80 shadow-2xs'

                          : 'text-slate-400'
                  }`}

                >

                  {/* 状態アイコン */}

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      done

                        ? 'bg-blue-600 text-white'

                        : isFailed

                          ? 'bg-rose-500 text-white'

                          : isRunning

                            ? 'bg-sky-500 text-white animate-pulse'

                            : 'bg-slate-200 text-slate-400'
                    }`}
                  >

                    {done ? (

                      <Check className="w-3 h-3 stroke-[3]" />

                    ) : isFailed ? (

                      <AlertTriangle className="w-3 h-3" />

                    ) : (

                      frame.seq

                    )}

                  </div>


                  <span className="truncate flex items-center gap-1.5">

                    {frame.isGap ? (

                      <>

                        <Wand2 className="w-3 h-3 shrink-0" />

                        {isFailed
                          ? 'AI補完に失敗しました'
                          : done
                            ? '写真がない時間の日記・画像が完成しました'
                            : isRunning
                              ? '写真が残っていない時間をAIが補完しています'
                              : '写真が残っていない時間の生成を待っています'}

                      </>

                    ) : (

                      <>

                        <ImageIcon className="w-3 h-3 shrink-0" />

                        {isFailed
                          ? '写真の日記生成に失敗しました'
                          : done
                            ? '写真の日記が完成しました'
                            : isRunning
                              ? '写真から日記を作っています'
                              : '写真の日記生成を待っています'}

                      </>

                    )}

                  </span>

                </div>

              );

            },
          )}

        </div>


        {/* =====================================
            エラー
        ====================================== */}

        {error && (

          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3">

            <div className="flex gap-2 text-left">

              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />


              <p className="text-[11px] text-rose-700 whitespace-pre-line">

                {error}

              </p>

            </div>

          </div>

        )}


        {/* =====================================
            遅延警告
        ====================================== */}

        {isSlow &&
          !isDone &&
          finished < total && (

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">

              <p className="text-[11px] text-amber-700 text-left font-diary">

                時間がかかっています。
                PythonバックエンドのAI生成処理が正常に動いているか確認してください。
                下のボタンから、できたぶんだけ先に見ることもできます。

              </p>

            </div>

          )}

      </div>


      {/* =====================================
          スキップ
      ====================================== */}

      <button

        type="button"

        onClick={
          onComplete
        }

        id="skip-generation-btn"

        className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer py-2 px-4 rounded-full hover:bg-sky-50"

      >

        <span>

          できたところまで見る

        </span>


        <ArrowRight className="w-3.5 h-3.5" />

      </button>

    </div>

  );
};