import React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Trip, DiaryEntry } from '../types';

interface PosterScreenProps {
  trip: Trip;
  onBack: () => void;
}

/** 写真が1枚も無いコマ（AIが想像で描いたコマ） */
const isGap = (entry: DiaryEntry) => !entry.photoId;

/** 「10:05 〜 19:20」から「約9時間15分」を作る */
function durationOf(range: string): string {
  const m = range.match(/(\d{1,2}):(\d{2})\D+?(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const diff =
    Number(m[3]) * 60 + Number(m[4]) - (Number(m[1]) * 60 + Number(m[2]));
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const mm = diff % 60;
  return h > 0 ? `約${h}時間${mm > 0 ? `${mm}分` : ''}` : `約${mm}分`;
}

/**
 * 一日の流れをA4縦1枚にまとめた表示。
 *
 * 印刷（PDFとして保存）に耐えるよう、幅をmmで指定しています。
 * 画面上の操作ボタンには no-print を付けて、紙には出ないようにしています。
 */
export const PosterScreen: React.FC<PosterScreenProps> = ({ trip, onBack }) => {
  const entries = trip.entries;
  const photoCount = trip.photoItems?.length ?? trip.photosCount ?? 0;
  const gapCount = entries.filter(isGap).length;
  const range = trip.summaryStats?.travelDuration ?? '';
  const duration = durationOf(range);

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-4">
      {/* 操作バー（紙には出ません） */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          日記に戻る
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#003B95] hover:bg-[#002F75] text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
        >
          <Printer className="w-4 h-4" />
          PDFとして保存 / 印刷
        </button>
      </div>

      <p className="no-print max-w-[210mm] mx-auto mb-4 text-[11px] text-slate-600 leading-relaxed">
        ボタンを押すと印刷画面が開きます。送信先で「PDFに保存」を選ぶと、
        この1枚がファイルとして手元に残ります。
      </p>

      {/* ここから紙 */}
      <div
        id="poster"
        className="mx-auto bg-white text-slate-900 shadow-xl"
        style={{ width: '210mm', padding: '14mm 14mm 12mm' }}
      >
        {/* 見出し */}
        <header className="border-b-2 border-slate-900 pb-3 mb-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[22pt] font-extrabold tracking-tight leading-tight truncate">
                {trip.title}
              </h1>
              <p className="mt-0.5 text-[9pt] text-slate-600">
                {[trip.date, trip.destination].filter(Boolean).join('　')}
              </p>
            </div>
            <p className="shrink-0 text-[8pt] text-slate-500 tracking-widest">
              TABI MEMORY
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[8.5pt] text-slate-700">
            <span>
              コマ数 <strong className="text-[11pt]">{entries.length}</strong>
            </span>
            <span>
              写真 <strong className="text-[11pt]">{photoCount}</strong> 枚
            </span>
            <span>
              写真が残っていない時間{' '}
              <strong className="text-[11pt]">{gapCount}</strong> コマ
            </span>
            {duration && (
              <span>
                {duration}
                {range && <span className="text-slate-500">（{range}）</span>}
              </span>
            )}
          </div>
        </header>

        {/* 一日の流れ */}
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const gap = isGap(entry);
            return (
              <article
                key={entry.id}
                className={`flex gap-3.5 p-3 rounded-lg break-inside-avoid ${
                  gap
                    ? 'border-2 border-dashed border-[#003B95]/50 bg-[#003B95]/[0.03]'
                    : 'border border-slate-200'
                }`}
              >
                {/* 番号と時刻 */}
                <div className="shrink-0 w-[13mm] text-center">
                  <div
                    className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[8pt] font-bold ${
                      gap
                        ? 'bg-[#003B95] text-white'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="mt-1.5 text-[8pt] font-bold text-slate-700 tabular-nums">
                    {entry.time}
                  </div>
                </div>

                {/* 絵 / 写真 */}
                <div
                  className="shrink-0 overflow-hidden rounded bg-slate-100"
                  style={{ width: '34mm', height: '26mm' }}
                >
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt={entry.location || entry.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[7pt] text-slate-400">
                      生成待ち
                    </div>
                  )}
                </div>

                {/* 文章 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    {gap ? (
                      <span className="text-[7.5pt] font-bold text-[#003B95] px-1.5 py-0.5 rounded bg-[#003B95]/10">
                        写真が残っていない時間
                      </span>
                    ) : (
                      <h2 className="text-[10pt] font-bold text-slate-900 truncate">
                        {entry.location || 'この日のひとコマ'}
                      </h2>
                    )}
                  </div>

                  <p className="text-[8.5pt] leading-[1.65] text-slate-800 whitespace-pre-line">
                    {entry.aiDiaryText || '（まだ生成されていません）'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* 脚注 */}
        <footer className="mt-6 pt-3 border-t border-slate-300 text-[7.5pt] text-slate-500 leading-relaxed">
          写真の撮影時刻と位置情報から一日をコマに分け、写真が残っていない時間は
          AIが前後の流れから想像して描いています。
        </footer>
      </div>
    </div>
  );
};
