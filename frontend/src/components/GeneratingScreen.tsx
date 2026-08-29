import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, ArrowRight, BookOpen, ImageIcon, Wand2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getScenes, getPanels } from '../lib/scenes';
import { subscribePanels } from '../lib/realtime';
import type { PanelStatus } from '../lib/types';

interface GeneratingScreenProps {
  /** Supabase 上の旅行ID。null のときは何も待たずに先へ進みます */
  tripId: string | null;
  onComplete: () => void;
}

type Frame = {
  sceneId: string;
  seq: number;
  isGap: boolean;
  status: PanelStatus;
};

/** これを過ぎても終わらなければ、生成が動いていない可能性を伝える */
const SLOW_AFTER_MS = 60_000;

export const GeneratingScreen: React.FC<GeneratingScreenProps> = ({ tripId, onComplete }) => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const celebrated = useRef(false);

  // 1. いまのコマの状態を読む
  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [scenes, panels] = await Promise.all([getScenes(tripId), getPanels(tripId)]);
        const byScene = new Map(panels.map((p) => [p.scene_id, p]));
        const list: Frame[] = [...scenes]
          .sort((a, b) => a.seq - b.seq)
          .map((s) => ({
            sceneId: s.id,
            seq: s.seq,
            isGap: s.is_gap,
            status: byScene.get(s.id)?.status ?? 'pending',
          }));
        if (!cancelled) {
          setFrames(list);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tripId]);

  // 2. 生成の進み具合をリアルタイムで受け取る
  useEffect(() => {
    if (!tripId) return;
    const unsubscribe = subscribePanels(tripId, {
      onChange: (panel) => {
        setFrames((prev) =>
          prev.map((f) =>
            f.sceneId === panel.scene_id ? { ...f, status: panel.status } : f,
          ),
        );
      },
    });
    return unsubscribe;
  }, [tripId]);

  // 3. 時間がかかりすぎていないか
  useEffect(() => {
    const t = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const total = frames.length;
  const finished = frames.filter((f) => f.status === 'done' || f.status === 'failed').length;
  const progress = total === 0 ? 0 : Math.round((finished / total) * 100);

  // 4. 全部終わったら日記へ
  useEffect(() => {
    if (loading || total === 0 || finished < total || celebrated.current) return;
    celebrated.current = true;
    setIsDone(true);
    try {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#2563EB', '#38BDF8', '#0D9488', '#FBBF24'],
      });
    } catch {
      /* 失敗しても進行に影響しない */
    }
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [loading, total, finished, onComplete]);

  // 旅行IDが無い場合（モックから来たときなど）はそのまま進む
  useEffect(() => {
    if (!tripId && !loading) {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [tripId, loading, onComplete]);

  const headline = isDone
    ? '写真日記ができました'
    : finished === 0
      ? '生成の準備をしています'
      : '一日を絵にしています';

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 max-w-xl mx-auto text-center py-10">
      {/* 回転するリングと中央のアイコン */}
      <div className="relative mb-8">
        <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-sky-200/50 via-blue-100/50 to-teal-100/50 flex items-center justify-center p-3 animate-spin duration-[15000ms]">
          <div className="w-full h-full rounded-full border-2 border-dashed border-sky-400/80"></div>
        </div>
        <div className="absolute inset-0 m-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-sky-400 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">
          <div className="relative">
            {isDone ? <BookOpen className="w-11 h-11" /> : <Wand2 className="w-11 h-11 animate-pulse" />}
            <Sparkles className="w-5 h-5 text-sky-200 absolute -top-2 -right-2 animate-bounce" />
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-blue-800 text-xs font-bold tracking-wider">
          写真が残っていない時間も、絵にしています
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold font-title text-slate-800">
          {headline}
        </h2>
        <p className="text-sm text-slate-500 font-diary max-w-md mx-auto h-10 flex items-center justify-center">
          {loading
            ? 'コマ割りを読み込んでいます…'
            : total === 0
              ? 'コマがまだありません'
              : `${total}コマ中 ${finished}コマが完成しました`}
        </p>
      </div>

      {/* 進捗 */}
      <div className="w-full bg-white rounded-3xl p-6 border border-sky-100 shadow-md shadow-sky-100/50 mb-6">
        <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-2">
          <span className="flex items-center gap-1.5 text-blue-600">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            写真日記を自動生成中
          </span>
          <span className="font-mono text-sm text-blue-700">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-teal-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* コマごとの状態 */}
        <div className="grid grid-cols-1 gap-2 mt-5 text-left text-xs">
          {frames.map((f) => {
            const done = f.status === 'done';
            const failed = f.status === 'failed';
            const running = f.status === 'running';
            return (
              <div
                key={f.sceneId}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl transition-colors ${
                  done
                    ? 'bg-blue-50/70 text-blue-900 font-medium'
                    : failed
                      ? 'bg-rose-50/70 text-rose-800 font-medium'
                      : running
                        ? 'bg-sky-100/70 text-blue-950 font-bold border border-sky-300/80 shadow-2xs'
                        : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    done
                      ? 'bg-blue-600 text-white'
                      : failed
                        ? 'bg-rose-500 text-white'
                        : running
                          ? 'bg-sky-500 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {done ? <Check className="w-3 h-3 stroke-[3]" /> : f.seq}
                </div>
                <span className="truncate flex items-center gap-1.5">
                  {f.isGap ? (
                    <>
                      <Wand2 className="w-3 h-3 shrink-0" />
                      写真が残っていない時間を描いています
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3 shrink-0" />
                      写真から起こしています
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 text-[11px] text-rose-600 text-left">{error}</p>
        )}

        {isSlow && !isDone && (
          <p className="mt-4 text-[11px] text-amber-700 text-left font-diary">
            時間がかかっています。生成の処理が動いているか確認してください。
            下のリンクから、できたぶんだけ先に見ることもできます。
          </p>
        )}
      </div>

      <button
        onClick={onComplete}
        id="skip-generation-btn"
        className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer py-2 px-4 rounded-full hover:bg-sky-50"
      >
        <span>できたところまで見る</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
