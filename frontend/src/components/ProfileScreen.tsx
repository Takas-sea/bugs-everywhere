import React, { useState } from 'react';
import {
  User,
  Award,
  Sliders,
} from 'lucide-react';

export const ProfileScreen: React.FC = () => {
  const [diaryTone, setDiaryTone] = useState<
    'emotional' | 'humorous' | 'simple' | 'literary'
  >('emotional');

  const [autoExifAnalyze, setAutoExifAnalyze] = useState(true);

  return (
    <div
      className="
        w-full
        min-h-screen
        bg-[#F8FAFC]
        text-slate-950
        px-4
        sm:px-6
        py-8
      "
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div className="w-full max-w-5xl mx-auto">

        {/* =========================
            PROFILE HEADER
        ========================= */}
        <div
          className="
            bg-white
            rounded-3xl
            border
            border-slate-200
            shadow-md
            p-6
            sm:p-8
            mb-8
            relative
            overflow-hidden
          "
        >
          {/* Decorative Background */}
          <div
            className="
              absolute
              top-0
              right-0
              w-56
              h-56
              bg-blue-50
              rounded-bl-full
              pointer-events-none
            "
          />

          <div
            className="
              relative
              z-10
              flex
              flex-col
              sm:flex-row
              items-center
              sm:items-start
              gap-7
            "
          >
            {/* Profile Icon */}
            <div className="shrink-0">
              <div
                className="
                  w-24
                  h-24
                  sm:w-28
                  sm:h-28
                  rounded-full
                  bg-[#003B95]
                  text-white
                  flex
                  items-center
                  justify-center
                  shadow-lg
                "
              >
                <User
                  className="
                    w-12
                    h-12
                    sm:w-14
                    sm:h-14
                    text-white
                    stroke-[2.4]
                  "
                />
              </div>
            </div>

            {/* Profile Information */}
            <div
              className="
                flex-1
                w-full
                text-center
                sm:text-left
              "
            >
              {/* Rank */}
              <div
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  px-3
                  py-1.5
                  rounded-full
                  bg-blue-50
                  text-[#003B95]
                  text-xs
                  font-bold
                  mb-3
                "
              >
                <Award className="w-3.5 h-3.5" />

                <span>
                </span>
              </div>

              {/* Name */}
              <h1
                className="
                  text-2xl
                  sm:text-3xl
                  font-extrabold
                  tracking-tight
                  text-slate-950
                "
              >
                山下暉登
              </h1>

              {/* Description */}
              <p
                className="
                  text-sm
                  sm:text-base
                  text-slate-600
                  leading-relaxed
                  mt-2
                  max-w-2xl
                "
              >
                旅行と写真、美味しいグルメが大好きな旅人。
                京都・大阪・沖縄・金沢など仲間と一緒に全国をめぐっています。
              </p>

              {/* Stats */}
              <div
                className="
                  grid
                  grid-cols-3
                  gap-4
                  mt-7
                  pt-6
                  border-t
                  border-slate-200
                "
              >
                {/* Album */}
                <div className="text-center sm:text-left">
                  <span
                    className="
                      text-xs
                      text-slate-500
                      font-medium
                    "
                  >
                    写真日記アルバム
                  </span>

                  <p
                    className="
                      mt-1
                      text-xl
                      sm:text-2xl
                      font-bold
                      text-slate-950
                    "
                  >
                    4 冊
                  </p>
                </div>

                {/* Spots */}
                <div className="text-center sm:text-left">
                  <span
                    className="
                      text-xs
                      text-slate-500
                      font-medium
                    "
                  >
                    訪れたスポット
                  </span>

                  <p
                    className="
                      mt-1
                      text-xl
                      sm:text-2xl
                      font-bold
                      text-[#003B95]
                    "
                  >
                    18 か所
                  </p>
                </div>

                {/* Photos */}
                <div className="text-center sm:text-left">
                  <span
                    className="
                      text-xs
                      text-slate-500
                      font-medium
                    "
                  >
                    総写真枚数
                  </span>

                  <p
                    className="
                      mt-1
                      text-xl
                      sm:text-2xl
                      font-bold
                      text-[#003B95]
                    "
                  >
                    174 枚
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================
            AI DIARY SETTINGS
        ========================= */}
        <div
          className="
            bg-white
            rounded-3xl
            border
            border-slate-200
            shadow-md
            p-6
            sm:p-8
            mb-8
          "
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Sliders className="w-5 h-5 text-[#003B95]" />

            <h2
              className="
                text-lg
                sm:text-xl
                font-bold
                text-slate-950
              "
            >
              AI写真日記のデフォルト執筆スタイル
            </h2>
          </div>

          <p
            className="
              text-sm
              text-slate-500
              mb-6
            "
          >
            AIが写真から日記文章を紡ぐときの文体や雰囲気をカスタマイズできます
          </p>

          {/* Tone Options */}
          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              gap-4
              mb-7
            "
          >
            {/* Emotional */}
            <button
              type="button"
              onClick={() => setDiaryTone('emotional')}
              className={`
                p-5
                rounded-2xl
                text-left
                border-2
                transition-all
                cursor-pointer
                ${
                  diaryTone === 'emotional'
                    ? 'bg-blue-50 border-[#003B95] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#003B95]'
                }
              `}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className="
                    text-sm
                    font-bold
                    text-slate-950
                  "
                >
                  ✨ エモーショナル・情景重視（推奨）
                </span>

                {diaryTone === 'emotional' && (
                  <span
                    className="
                      w-2.5
                      h-2.5
                      rounded-full
                      bg-[#003B95]
                      shrink-0
                    "
                  />
                )}
              </div>

              <p
                className="
                  text-sm
                  text-slate-500
                  leading-relaxed
                "
              >
                「青空に映える清水の舞台。3人で並んで見たあの絶景が胸に残っています。」
              </p>
            </button>

            {/* Humorous */}
            <button
              type="button"
              onClick={() => setDiaryTone('humorous')}
              className={`
                p-5
                rounded-2xl
                text-left
                border-2
                transition-all
                cursor-pointer
                ${
                  diaryTone === 'humorous'
                    ? 'bg-blue-50 border-[#003B95] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#003B95]'
                }
              `}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className="
                    text-sm
                    font-bold
                    text-slate-950
                  "
                >
                  😄 ユーモア・友達トーク風
                </span>

                {diaryTone === 'humorous' && (
                  <span
                    className="
                      w-2.5
                      h-2.5
                      rounded-full
                      bg-[#003B95]
                      shrink-0
                    "
                  />
                )}
              </div>

              <p
                className="
                  text-sm
                  text-slate-500
                  leading-relaxed
                "
              >
                「おみくじでまさかの凶！全員で大爆笑しながら厄落としのお守りを選びましたw」
              </p>
            </button>

            {/* Simple */}
            <button
              type="button"
              onClick={() => setDiaryTone('simple')}
              className={`
                p-5
                rounded-2xl
                text-left
                border-2
                transition-all
                cursor-pointer
                ${
                  diaryTone === 'simple'
                    ? 'bg-blue-50 border-[#003B95] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#003B95]'
                }
              `}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className="
                    text-sm
                    font-bold
                    text-slate-950
                  "
                >
                  📝 シンプル・ダイレクト
                </span>

                {diaryTone === 'simple' && (
                  <span
                    className="
                      w-2.5
                      h-2.5
                      rounded-full
                      bg-[#003B95]
                      shrink-0
                    "
                  />
                )}
              </div>

              <p
                className="
                  text-sm
                  text-slate-500
                  leading-relaxed
                "
              >
                「11:32 清水寺を訪問。舞台からのパノラマビューを撮影しました。」
              </p>
            </button>

            {/* Literary */}
            <button
              type="button"
              onClick={() => setDiaryTone('literary')}
              className={`
                p-5
                rounded-2xl
                text-left
                border-2
                transition-all
                cursor-pointer
                ${
                  diaryTone === 'literary'
                    ? 'bg-blue-50 border-[#003B95] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-[#003B95]'
                }
              `}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className="
                    text-sm
                    font-bold
                    text-slate-950
                  "
                >
                  🍃 紀行文・文学スタイル
                </span>

                {diaryTone === 'literary' && (
                  <span
                    className="
                      w-2.5
                      h-2.5
                      rounded-full
                      bg-[#003B95]
                      shrink-0
                    "
                  />
                )}
              </div>

              <p
                className="
                  text-sm
                  text-slate-500
                  leading-relaxed
                "
              >
                「夕暮れの祇園、石畳に夕日が落ちていく。古都の静寂を心に刻んだ。」
              </p>
            </button>
          </div>

          {/* =========================
              EXIF TOGGLE
          ========================= */}
          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              p-4
              sm:p-5
              rounded-2xl
              bg-blue-50
              border
              border-blue-100
            "
          >
            <div>
              <span
                className="
                  text-sm
                  font-bold
                  text-slate-950
                  block
                "
              >
                写真の位置情報・EXIF日時を自動解析
              </span>

              <span
                className="
                  text-xs
                  sm:text-sm
                  text-slate-500
                  mt-1
                  block
                "
              >
                アップロード時に正確な時系列順序を自動判定します
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setAutoExifAnalyze(!autoExifAnalyze)
              }
              aria-pressed={autoExifAnalyze}
              className={`
                relative
                w-14
                h-8
                rounded-full
                transition-colors
                shrink-0
                cursor-pointer
                ${
                  autoExifAnalyze
                    ? 'bg-[#003B95]'
                    : 'bg-slate-300'
                }
              `}
            >
              <div
                className={`
                  absolute
                  top-1
                  left-1
                  w-6
                  h-6
                  rounded-full
                  bg-white
                  shadow-sm
                  transition-transform
                  ${
                    autoExifAnalyze
                      ? 'translate-x-6'
                      : 'translate-x-0'
                  }
                `}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};