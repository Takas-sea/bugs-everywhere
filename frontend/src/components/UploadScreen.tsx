import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Sparkles, Clock, MapPin, UserPlus,
  ArrowRight, ArrowLeft, Image as ImageIcon, Camera, AlertTriangle, Loader2,
} from 'lucide-react';
import { PhotoItem, Trip } from '../types';
import { createTrip, uploadPhotos } from '../lib/photos';
import { prepareScenes } from '../lib/scenes';
import { renameTrip } from '../lib/trips';
import { loadPhotoItems } from '../lib/adapters';

interface UploadScreenProps {
  currentTrip: Trip;
  /** 実際の trip_id を渡します。App 側はこれを使って loadTrip してください */
  onGenerateDiary: (tripId: string) => void;
  onBack: () => void;
  onOpenInviteModal: () => void;
}

/** モックの旅行IDと本物のUUIDを見分ける */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 写真の撮影日のうち、枚数が一番多い日を「その旅の日」として返す。
 *
 * 一番古い写真をそのまま使うと、混ざった1枚に引っぱられます。
 */
function mainDateLabel(items: PhotoItem[]): string {
  const counts = new Map<string, number>();

  for (const p of items) {
    if (!p.timestamp) continue;
    const d = new Date(p.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best = '';
  let bestCount = 0;
  for (const [key, n] of counts) {
    // 同数なら新しい日を採用する
    if (n > bestCount || (n === bestCount && key > best)) {
      best = key;
      bestCount = n;
    }
  }

  const now = new Date();
  const [y, m, d] = best
    ? best.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1, now.getDate()];

  return `${y}年${m}月${d}日`;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  currentTrip,
  onGenerateDiary,
  onBack,
  onOpenInviteModal,
}) => {
  const [tripId, setTripId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [noExifCount, setNoExifCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const creatingRef = useRef<Promise<string> | null>(null);
  /** この画面で新しく作った旅行か。名前を勝手に付け替えていいかの判断に使います */
  const createdHereRef = useRef(false);
  const [tripTitle, setTripTitle] = useState(currentTrip.title);

  // 既存の旅行に写真を追加しに来た場合だけ、その旅行IDを引き継ぎます。
  useEffect(() => {
    setTripId(UUID_RE.test(currentTrip.id) ? currentTrip.id : null);
  }, [currentTrip.id]);

  /**
   * 旅行IDを用意する。無ければこの時点で作ります。
   *
   * 画面を開いた時点で作らないのが大事です。開いて何もせず戻るたびに、
   * 空の旅行がDBに増えてしまうためです。
   */
  const ensureTripId = async (): Promise<string> => {
    if (tripId) return tripId;
    if (creatingRef.current) return creatingRef.current;

    const now = new Date();
    const title =
      `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日の記録`;

    const promise = createTrip(title).then((trip) => {
      setTripId(trip.id);
      createdHereRef.current = true;
      setTripTitle(title);
      return trip.id;
    });
    creatingRef.current = promise;

    try {
      return await promise;
    } finally {
      creatingRef.current = null;
    }
  };

  const refresh = useCallback(async (id: string) => {
    const items = await loadPhotoItems(id);
    setPhotos(items);
    setNoExifCount(items.filter((p) => p.timestamp === 0).length);

    // 旅行を作った時点では写真がまだ無いので、名前は「今日」の日付になっています。
    // 写真が入ったら、撮影日のほうへ付け替えます。
    // 自分でこの画面から作った旅行のときだけ触ります。
    if (!createdHereRef.current || items.length === 0) return;

    const title = `${mainDateLabel(items)}の記録`;
    if (title === tripTitle) return;

    try {
      await renameTrip(id, title);
      setTripTitle(title);
    } catch (e) {
      // 名前が変わらないだけなので、アップロードは止めません
      console.warn('[UploadScreen] 旅行名の更新に失敗しました', e);
    }
  }, [tripTitle]);

  // 旅行が決まったら、すでに入っている写真を読み込む（追加アップロード時に効きます）
  useEffect(() => {
    if (tripId) refresh(tripId).catch(() => undefined);
  }, [tripId, refresh]);

  /** ここが本体。EXIF読み取り・Storage保存・DB登録は uploadPhotos の中で終わります */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setProgress(`0 / ${files.length} 枚`);

    try {
      const id = await ensureTripId();
      const { failed } = await uploadPhotos(files, id, (done, total) => {
        setProgress(`${done} / ${total} 枚`);
      });
      if (failed.length) {
        setErrors(failed.map((f) => `${f.file}: ${f.reason}`));
      }
      await refresh(id);
    } catch (e) {
      setErrors([String(e)]);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  /** 写真を時系列に並べてコマ割りを作り、生成へ進む */
  const handleGenerate = async () => {
    if (!tripId) return;
    setBusy(true);
    try {
      await prepareScenes(tripId);
      onGenerateDiary(tripId);
    } catch (e) {
      setErrors([`コマ割りの作成に失敗しました: ${String(e)}`]);
      setBusy(false);
    }
  };

  const sortedPhotos = [...photos].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>戻る</span>
        </button>
        <span className="text-xs text-slate-500 font-diary hidden sm:inline">
          写真 {photos.length} 枚アップロード済み
        </span>
      </div>

      {/* 旅行メンバー */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>旅行メンバーと共同アルバム</span>
            </div>
            <h2 className="text-xl font-bold font-title text-slate-800">
              {tripTitle}
            </h2>
            <p className="text-xs text-slate-500 font-diary mt-0.5">
              撮影時刻と位置情報をもとに、AIが一日を時系列に整理します。
            </p>
          </div>
          <button
            onClick={onOpenInviteModal}
            id="upload-invite-member-btn"
            className="px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200 cursor-pointer shadow-2xs self-start"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>メンバーを招待</span>
          </button>
        </div>
      </section>

      {/* アップロード */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold font-title text-slate-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <span>写真をアップロード</span>
          </h3>
          <p className="text-xs text-slate-500 font-diary mt-0.5">
            スマートフォンやデジカメで撮影した写真を選択してください（複数枚一括可能）
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            void handleFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          onClick={() => !busy && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-200 ${
            busy
              ? 'border-slate-200 bg-slate-50 cursor-wait'
              : isDragOver
                ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/20 cursor-pointer'
                : 'border-sky-200 bg-sky-50/40 hover:bg-sky-50/80 hover:border-blue-400 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={busy}
          />
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/30">
            {busy
              ? <Loader2 className="w-8 h-8 stroke-[2.2] animate-spin" />
              : <Upload className="w-8 h-8 stroke-[2.2]" />}
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">
            {busy ? `アップロード中… ${progress}` : 'クリックまたは写真をドラッグ＆ドロップして追加'}
          </h4>
          <p className="text-xs text-slate-500 font-diary">
            JPEG / PNG 推奨 · 撮影日時と位置情報は自動で読み取ります
          </p>
        </div>

        {/* 失敗した写真 */}
        {errors.length > 0 && (
          <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{errors.length}件のエラー</span>
            </div>
            <ul className="text-[11px] text-rose-600 font-diary space-y-0.5">
              {errors.slice(0, 5).map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        )}

        {/* EXIFが取れなかった写真の注意 */}
        {noExifCount > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{noExifCount}枚に撮影日時がありません</span>
            </div>
            <p className="text-[11px] text-amber-700 font-diary">
              スクリーンショットや、SNS経由で受け取った写真は撮影情報が消えていることがあります。
              その写真はアップロード順で並びます。
            </p>
          </div>
        )}
      </section>

      {/* アップロード済みの写真 */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold font-title text-slate-800">
              アップロードされた写真 ({sortedPhotos.length}枚)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-diary">撮影時間順に自動整列</span>
        </div>

        {sortedPhotos.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700 mb-1">まだ写真がありません</h4>
            <p className="text-xs text-slate-400 font-diary">
              上のエリアから旅行の写真をアップロードしてください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {sortedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative rounded-3xl bg-white border border-sky-100 shadow-md shadow-sky-100/50 hover:shadow-xl hover:border-blue-300 transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.locationName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    // 署名URLがまだ発行できない状態（Storageのポリシー待ち）
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/65 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 text-sky-300" />
                    <span>{photo.time}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-gradient-to-b from-white to-sky-50/30">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {photo.locationName || '場所の情報なし'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 生成へ進む */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-sky-200 shadow-xl shadow-blue-500/15 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>AI JOURNAL GENERATOR</span>
          </div>
          <h4 className="text-base sm:text-lg font-bold font-title text-slate-900">
            {photos.length}枚の写真からAI写真日記を生成します
          </h4>
          <p className="text-xs text-slate-500 font-diary">
            撮影時間と場所をもとに一日をコマに分け、写真が残っていない時間も絵で補います
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={photos.length === 0 || busy || !tripId}
          id="generate-photo-diary-btn"
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <Sparkles className="w-5 h-5 text-sky-200" />
          <span>AIで写真日記を作る</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
