import React, { useState } from 'react';
import { User, Award, BookOpen, MapPin, Camera, Sparkles, Heart, Settings, Shield, Sliders, Check } from 'lucide-react';
import { SAMPLE_MEMBERS } from '../data/mockTrips';

export const ProfileScreen: React.FC = () => {
  const user = SAMPLE_MEMBERS[0];
  const [diaryTone, setDiaryTone] = useState<'emotional' | 'humorous' | 'simple' | 'literary'>('emotional');
  const [autoExifAnalyze, setAutoExifAnalyze] = useState(true);

  return (
    <div className="pb-28 md:pb-16 max-w-4xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-sky-100/60 to-transparent rounded-bl-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 text-center sm:text-left">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-sky-200/80 shadow-md"
            />
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-blue-700 text-xs font-bold mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>マスター・フォトグラファー</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-title text-slate-800">
              {user.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-diary mt-1 max-w-md">
              旅行と写真、美味しいグルメが大好きな旅人。京都・大阪・沖縄・金沢など仲間と一緒に全国をめぐっています。
            </p>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-sky-100">
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400 font-diary">写真日記アルバム</span>
                <p className="text-xl font-bold font-title text-slate-800">4 冊</p>
              </div>
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400 font-diary">訪れたスポット</span>
                <p className="text-xl font-bold font-title text-teal-600">18 か所</p>
              </div>
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400 font-diary">総写真枚数</span>
                <p className="text-xl font-bold font-title text-blue-600">174 枚</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Photo Diary Tone Preferences */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-sky-100 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold font-title text-slate-800">
            AI写真日記のデフォルト執筆スタイル
          </h2>
        </div>
        <p className="text-xs text-slate-500 font-diary mb-5">
          AIが写真から日記文章を紡ぐときの文体や雰囲気をカスタマイズできます
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setDiaryTone('emotional')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              diaryTone === 'emotional'
                ? 'bg-sky-50 border-blue-400 ring-2 ring-blue-400/20'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-800">✨ エモーショナル・情景重視 (推奨)</span>
              {diaryTone === 'emotional' && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
            </div>
            <p className="text-xs text-slate-500 font-diary">
              「青空に映える清水の舞台。3人で並んで見たあの絶景が胸に残っています。」
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDiaryTone('humorous')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              diaryTone === 'humorous'
                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-800">😄 ユーモア・友達トーク風</span>
              {diaryTone === 'humorous' && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
            </div>
            <p className="text-xs text-slate-500 font-diary">
              「おみくじでまさかの凶！全員で大爆笑しながら厄落としのお守りを選びましたw」
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDiaryTone('simple')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              diaryTone === 'simple'
                ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-400/20'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-800">📝 シンプル・ダイレクト</span>
              {diaryTone === 'simple' && <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />}
            </div>
            <p className="text-xs text-slate-500 font-diary">
              「11:32 清水寺を訪問。舞台からのパノラマビューを撮影しました。」
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDiaryTone('literary')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              diaryTone === 'literary'
                ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/20'
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-800">🍃 紀行文・文学スタイル</span>
              {diaryTone === 'literary' && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
            </div>
            <p className="text-xs text-slate-500 font-diary">
              「夕暮れの祇園、石畳に夕日が落ちていく。古都の静寂を心に刻んだ。」
            </p>
          </button>
        </div>

        {/* Toggle options */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50/50 border border-sky-100">
          <div>
            <span className="text-xs font-bold text-slate-800 block">写真の位置情報・EXIF日時を自動解析</span>
            <span className="text-[11px] text-slate-500 font-diary">アップロード時に正確な時系列順序を自動判定します</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoExifAnalyze(!autoExifAnalyze)}
            className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
              autoExifAnalyze ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                autoExifAnalyze ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
