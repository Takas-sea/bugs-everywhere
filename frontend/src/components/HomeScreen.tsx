import React from 'react';
import {
  Plus,
  Calendar,
  Image as ImageIcon,
  MapPin,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Camera,
  User,
} from 'lucide-react';

import { Trip } from '../types';

interface HomeScreenProps {
  pastTrips: Trip[];
  onSelectTrip: (trip: Trip) => void;
  onNewTripClick: () => void;
  onViewAllMemories: () => void;
  onProfileClick: () => void;

  userName: string;
  onLogout: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  pastTrips,
  onSelectTrip,
  onNewTripClick,
  onViewAllMemories,
  onProfileClick,
  userName,
  onLogout,
}) => {
  const featuredTrip = pastTrips[0];

  const handleProfileClick = () => {
    onProfileClick();
  };

  const initial = userName.length > 0 ? userName.charAt(0) : '旅';


  return (
    <div
      className="w-full min-h-screen text-slate-950"
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        className="
          w-full
          max-w-5xl
          mx-auto
          px-4
          sm:px-6
          pt-4
          md:pt-6
          pb-28
          md:pb-16
        "
      >
        {/* =========================
            HEADER
        ========================= */}
        <div
          className="
            w-full
            flex
            items-center
            justify-between
            gap-4
            mb-8
            md:mb-10
          "
        >
          <h1
            className="
              text-[27px]
              sm:text-3xl
              md:text-4xl
              font-extrabold
              tracking-[-0.045em]
              text-slate-950
              whitespace-nowrap
            "
          >
            TABI MEMORY
          </h1>

          {/* Login / Profile */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <button
              onClick={handleProfileClick}
              id="home-profile-btn"
              aria-label="プロフィールを開く"
              title="プロフィール" 
              className="
                w-12
                h-12
                sm:w-14
                sm:h-14
                rounded-full
                bg-teal-500
                border-2
                border-teal-500
                shadow-md
                flex
                items-center
                justify-center
                hover:bg-teal-600
                hover:border-teal-600
                hover:scale-105
                active:scale-95
                transition-all
                duration-200
                cursor-pointer
              "
            >
              <span
                className="
                  text-white
                  text-xl
                  sm:text-2xl
                  font-bold
                "
              >
                {initial}
              </span>
            </button>

            <span
              className="
                text-[11px]
                sm:text-xs
                font-bold
                text-slate-950
                whitespace-nowrap
              "
            >
              {userName}
            </span>
          </div>
        </div>

        {/* =========================
            HERO
        ========================= */}
        <div
          className="
            relative
            w-full
            overflow-hidden
            rounded-3xl
            bg-[#003B95]
            p-6
            sm:p-8
            shadow-xl
            shadow-blue-950/20
            mb-10
          "
        >
          <div
            className="
              relative
              z-10
              flex
              flex-col
              md:flex-row
              items-center
              justify-between
              gap-6
            "
          >
            {/* Left */}
            <div
              className="
                w-full
                md:flex-1
                text-center
                md:text-left
              "
            >
              <h2
                className="
                  text-2xl
                  sm:text-3xl
                  font-bold
                  text-white
                  leading-snug
                  mb-3
                "
              >
                旅行の写真をみんなでアップロード
              </h2>

              <p
                className="
                  text-white
                  text-sm
                  sm:text-base
                  leading-relaxed
                "
              >
                友達や家族の写真を1つに集約。
                撮影時間や位置情報をAIが分析し、
                <br className="hidden sm:inline" />
                「旅行日記」を自動生成します。
              </p>
            </div>

            {/* Right Button */}
            <div
              className="
                w-full
                md:w-auto
                flex
                flex-col
                items-center
                shrink-0
              "
            >
              <button
                onClick={onNewTripClick}
                id="home-create-memory-btn"
                className="
                  w-full
                  md:w-auto
                  px-7
                  sm:px-8
                  py-4
                  rounded-2xl
                  bg-white
                  text-[#003B95]
                  font-bold
                  text-base
                  sm:text-lg
                  shadow-lg
                  hover:shadow-xl
                  hover:bg-blue-50
                  hover:scale-[1.02]
                  active:scale-[0.99]
                  transition-all
                  duration-200
                  flex
                  items-center
                  justify-center
                  gap-3
                  cursor-pointer
                "
              >
                <div
                  className="
                    w-7
                    h-7
                    rounded-full
                    bg-blue-100
                    text-[#003B95]
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>

                <span className="text-[#003B95]">
                  新しい旅の思い出を作る
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================
            FEATURED TRIP
        ========================= */}
        {featuredTrip && (
          <section className="w-full mb-10">
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                mb-4
              "
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen
                  className="
                    w-5
                    h-5
                    text-slate-950
                    shrink-0
                  "
                />

                <h2
                  className="
                    text-lg
                    sm:text-xl
                    font-bold
                    text-slate-950
                  "
                >
                  最新の写真日記ピックアップ
                </h2>
              </div>

              <button
                onClick={() => onSelectTrip(featuredTrip)}
                className="
                  hidden
                  sm:flex
                  text-xs
                  font-bold
                  text-[#003B95]
                  hover:text-[#002F75]
                  items-center
                  gap-1
                  shrink-0
                  cursor-pointer
                "
              >
                写真日記を開く

                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Featured Card */}
            <div
              onClick={() => onSelectTrip(featuredTrip)}
              className="
                group
                w-full
                cursor-pointer
                rounded-3xl
                bg-white
                border
                border-slate-200
                shadow-md
                hover:shadow-xl
                hover:border-[#003B95]
                transition-all
                duration-300
                overflow-hidden
              "
            >
              <div className="grid grid-cols-1 md:grid-cols-12">
                {/* Photo */}
                <div
                  className="
                    md:col-span-7
                    relative
                    h-64
                    md:h-[340px]
                    overflow-hidden
                    bg-slate-900
                  "
                >
                  <img
                    src={featuredTrip.coverImage}
                    alt={featuredTrip.title}
                    className="
                      w-full
                      h-full
                      object-cover
                      group-hover:scale-105
                      transition-transform
                      duration-500
                    "
                  />

                  <div
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-t
                      from-black/60
                      via-transparent
                      to-transparent
                      md:hidden
                    "
                  />

                  {/* AI Label */}
                  <div
                    className="
                      absolute
                      top-3
                      left-3
                      bg-[#003B95]
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-bold
                      text-white
                      flex
                      items-center
                      gap-1.5
                      shadow-sm
                    "
                  >
                    <span
                      className="
                        w-2
                        h-2
                        rounded-full
                        bg-white
                      "
                    />

                    AI時系列写真日記
                  </div>

                  {/* Mobile title */}
                  <div
                    className="
                      absolute
                      bottom-3
                      left-3
                      md:hidden
                      text-white
                      bg-[#003B95]
                      px-3
                      py-2
                      rounded-xl
                    "
                  >
                    <h3 className="text-xl font-bold text-white">
                      {featuredTrip.title}
                    </h3>

                    <p className="text-xs text-white">
                      {featuredTrip.date}
                    </p>
                  </div>
                </div>

                {/* Information */}
                <div
                  className="
                    md:col-span-5
                    p-6
                    md:p-8
                    flex
                    flex-col
                    justify-between
                    bg-white
                  "
                >
                  <div>
                    <div
                      className="
                        hidden
                        md:flex
                        items-center
                        gap-2
                        text-xs
                        text-slate-950
                        mb-2
                      "
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#003B95]" />

                      <span>{featuredTrip.date}</span>

                      <span>•</span>

                      <span className="text-slate-950 font-bold">
                        {featuredTrip.destination}
                      </span>
                    </div>

                    <h3
                      className="
                        hidden
                        md:block
                        text-2xl
                        font-bold
                        text-slate-950
                      "
                    >
                      {featuredTrip.title}
                    </h3>

                    <p
                      className="
                        text-xs
                        text-slate-950
                        mt-1
                        line-clamp-2
                      "
                    >
                      {featuredTrip.subtitle}
                    </p>

                    {/* AI Diary */}
                    <div
                      className="
                        mt-4
                        p-3.5
                        rounded-2xl
                        bg-[#003B95]
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-1.5
                          text-[11px]
                          font-bold
                          text-white
                          mb-1
                        "
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />

                        <span>
                          10:05 京都駅（山下さん撮影）
                        </span>
                      </div>

                      <p
                        className="
                          text-xs
                          text-white
                          leading-relaxed
                          line-clamp-3
                        "
                      >
                        {featuredTrip.entries[0]?.aiDiaryText ||
                          '京都駅に到着！今日はいよいよ3人で京都旅行。駅に着いた瞬間からみんなテンションが上がっていました。'}
                      </p>
                    </div>

                    {/* Spots */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {featuredTrip.spots
                        .slice(0, 4)
                        .map((spot, idx) => (
                          <span
                            key={spot.id}
                            className="
                              text-[11px]
                              px-2.5
                              py-1
                              rounded-lg
                              bg-[#003B95]
                              text-white
                              font-medium
                              flex
                              items-center
                              gap-1
                            "
                          >
                            <span
                              className="
                                text-[9px]
                                w-3.5
                                h-3.5
                                rounded-full
                                bg-white
                                text-[#003B95]
                                flex
                                items-center
                                justify-center
                                font-bold
                              "
                            >
                              {idx + 1}
                            </span>

                            {spot.name}
                          </span>
                        ))}

                      {featuredTrip.spots.length > 4 && (
                        <span
                          className="
                            text-[11px]
                            px-2
                            py-1
                            rounded-lg
                            bg-[#003B95]
                            text-white
                          "
                        >
                          +{featuredTrip.spots.length - 4}箇所
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Members / Read */}
                  <div
                    className="
                      pt-4
                      mt-4
                      border-t
                      border-slate-200
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-2">
                        {featuredTrip.members.map((m) => (
                          <img
                            key={m.id}
                            src={m.avatar}
                            alt={m.name}
                            className="
                              h-6
                              w-6
                              rounded-full
                              ring-2
                              ring-white
                              object-cover
                            "
                          />
                        ))}
                      </div>

                      <span className="text-xs text-slate-950">
                        {featuredTrip.members.length}人
                      </span>
                    </div>

                    <div
                      className="
                        flex
                        items-center
                        gap-1
                        text-xs
                        font-bold
                        text-[#003B95]
                      "
                    >
                      写真日記を読む

                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================
            PAST TRIPS
        ========================= */}
        <section className="w-full mb-10">
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              mb-5
            "
          >
            <div>
              <h2
                className="
                  text-lg
                  sm:text-xl
                  font-bold
                  text-slate-950
                  flex
                  items-center
                  gap-2
                "
              >
                <span>保存された旅行の思い出</span>

                <span
                  className="
                    text-xs
                    font-bold
                    px-2.5
                    py-0.5
                    rounded-full
                    bg-[#003B95]
                    text-white
                  "
                >
                  {pastTrips.length}件
                </span>
              </h2>

              <p
                className="
                  text-xs
                  text-slate-950
                  mt-0.5
                  hidden
                  sm:block
                "
              >
                いつでもあの日の旅を時系列写真で振り返ることができます
              </p>
            </div>

            <button
              onClick={onViewAllMemories}
              className="
                text-xs
                font-bold
                text-[#003B95]
                hover:text-[#002F75]
                flex
                items-center
                gap-1
                cursor-pointer
                shrink-0
              "
            >
              すべて見る

              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cards */}
          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-3
              gap-6
            "
          >
            {pastTrips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => onSelectTrip(trip)}
                id={`trip-card-${trip.id}`}
                className="
                  group
                  cursor-pointer
                  bg-white
                  rounded-3xl
                  border
                  border-slate-200
                  shadow-md
                  hover:shadow-xl
                  hover:border-[#003B95]
                  hover:-translate-y-1
                  transition-all
                  duration-200
                  overflow-hidden
                  flex
                  flex-col
                "
              >
                {/* Image */}
                <div
                  className="
                    relative
                    h-48
                    w-full
                    overflow-hidden
                    bg-slate-100
                  "
                >
                  <img
                    src={trip.coverImage}
                    alt={trip.title}
                    className="
                      w-full
                      h-full
                      object-cover
                      group-hover:scale-105
                      transition-transform
                      duration-300
                    "
                    loading="lazy"
                  />

                  <div
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-t
                      from-black/60
                      via-transparent
                      to-transparent
                    "
                  />

                  {/* Photo count */}
                  <div
                    className="
                      absolute
                      bottom-3
                      right-3
                      bg-[#003B95]
                      text-white
                      text-[11px]
                      font-medium
                      px-2.5
                      py-1
                      rounded-full
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <ImageIcon className="w-3 h-3" />

                    写真 {trip.photosCount}枚
                  </div>

                  {/* Destination */}
                  <div
                    className="
                      absolute
                      top-3
                      left-3
                      bg-[#003B95]
                      text-white
                      text-[11px]
                      font-bold
                      px-2.5
                      py-1
                      rounded-full
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <MapPin className="w-3 h-3 text-white" />

                    {trip.destination
                      ? trip.destination.split('（')[0]
                      : '旅先'}
                  </div>
                </div>

                {/* Content */}
                <div
                  className="
                    p-5
                    flex-1
                    flex
                    flex-col
                    justify-between
                  "
                >
                  <div>
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                        text-xs
                        text-slate-950
                        mb-1.5
                      "
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#003B95]" />

                      {trip.date}
                    </div>

                    <h3
                      className="
                        text-base
                        font-bold
                        text-slate-950
                        line-clamp-1
                      "
                    >
                      {trip.title}
                    </h3>

                    <p
                      className="
                        text-xs
                        text-slate-950
                        mt-1
                        line-clamp-1
                      "
                    >
                      {trip.subtitle}
                    </p>
                  </div>

                  <div
                    className="
                      pt-3.5
                      mt-3.5
                      border-t
                      border-slate-200
                      flex
                      items-center
                      justify-between
                    "
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {trip.members.map((m) => (
                          <img
                            key={m.id}
                            src={m.avatar}
                            alt={m.name}
                            className="
                              h-5
                              w-5
                              rounded-full
                              ring-2
                              ring-white
                              object-cover
                            "
                          />
                        ))}
                      </div>

                      <span className="text-[11px] text-slate-950">
                        {trip.members.length}人
                      </span>
                    </div>

                    <span
                      className="
                        text-xs
                        font-bold
                        text-[#003B95]
                        flex
                        items-center
                      "
                    >
                      写真日記を見る

                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};