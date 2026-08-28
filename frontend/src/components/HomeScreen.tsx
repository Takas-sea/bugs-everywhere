import React from 'react';
import { Sparkles, Plus, Calendar, Image as ImageIcon, MapPin, Users, ArrowRight, BookOpen, ChevronRight, Camera } from 'lucide-react';
import { Trip } from '../types';

interface HomeScreenProps {
  pastTrips: Trip[];
  onSelectTrip: (trip: Trip) => void;
  onNewTripClick: () => void;
  onViewAllMemories: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  pastTrips,
  onSelectTrip,
  onNewTripClick,
  onViewAllMemories,
}) => {
  const featuredTrip = pastTrips[0]; // Kyoto trip

  return (
    <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Top Header & Catchphrase Banner */}
      <div className="text-center md:text-left mb-8 md:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-bold mb-3 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span>AIがみんなの写真から「写真日記」を自動生成</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-title tracking-tight text-slate-900">
              TABI MEMORY
            </h1>
            <p className="text-base sm:text-lg text-slate-600 font-diary mt-1.5 tracking-wide">
              写真から、あの日の旅をもう一度。
            </p>
          </div>
          
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>撮影時間順
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>メンバー全員の写真集約
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>事実に基づくAI日記
            </span>
          </div>
        </div>
      </div>

      {/* Main Hero CTA Section (Blue Sky Theme) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-sky-600 to-sky-400 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/20 mb-10 group">
        {/* Decorative background clouds / light blur */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-12 w-56 h-56 rounded-full bg-sky-200/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider backdrop-blur-xs mb-3 border border-white/25">
              NEW MEMORY
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-title leading-snug mb-2.5">
              旅行の写真をみんなでアップロード
            </h2>
            <p className="text-white/95 text-sm sm:text-base font-diary leading-relaxed">
              友達や家族の写真を1つに集約。撮影時間や位置情報をAIが分析し、<br className="hidden sm:inline" />
              実際の写真を主役にした時系列の「旅行写真日記」を自動生成します。
            </p>

            {/* 3 Step Indicator */}
            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/25 text-xs text-white">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center font-bold text-[10px]">1</span>
                <span>旅行を作成・招待</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center font-bold text-[10px]">2</span>
                <span>みんなで写真追加</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center font-bold text-[10px]">3</span>
                <span>AI写真日記が完成</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col items-center">
            <button
              onClick={onNewTripClick}
              id="home-create-memory-btn"
              className="w-full md:w-auto px-8 py-4 rounded-2xl bg-white text-blue-600 font-bold text-base sm:text-lg shadow-lg hover:shadow-2xl hover:bg-sky-50 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Plus className="w-4 h-4 stroke-[3]" />
              </div>
              <span>新しい旅の思い出を作る</span>
            </button>
            <p className="text-[11px] text-white/90 mt-2 font-diary">
              山下さん・田中さん・佐藤さんとの共同アルバム
            </p>
          </div>
        </div>
      </div>

      {/* Featured / Recent Travel Diary Highlight */}
      {featuredTrip && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-bold font-title text-slate-800">
                最新の写真日記ピックアップ
              </h2>
            </div>
            <button
              onClick={() => onSelectTrip(featuredTrip)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              写真日記を開く
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div 
            onClick={() => onSelectTrip(featuredTrip)}
            className="group cursor-pointer rounded-3xl bg-white border border-sky-100 shadow-md shadow-sky-100/60 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
              {/* Photo Area */}
              <div className="md:col-span-7 relative h-64 md:h-84 overflow-hidden bg-slate-900">
                <img 
                  src={featuredTrip.coverImage} 
                  alt={featuredTrip.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  AI時系列写真日記
                </div>
                <div className="absolute bottom-3 left-3 md:hidden text-white">
                  <h3 className="text-xl font-bold font-title">{featuredTrip.title}</h3>
                  <p className="text-xs text-white/90 font-diary">{featuredTrip.date}</p>
                </div>
              </div>

              {/* Information & Excerpt */}
              <div className="md:col-span-5 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-b from-white to-sky-50/30">
                <div>
                  <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>{featuredTrip.date}</span>
                    <span>•</span>
                    <span className="text-blue-600 font-bold">{featuredTrip.destination}</span>
                  </div>

                  <h3 className="hidden md:block text-2xl font-bold font-title text-slate-800 group-hover:text-blue-600 transition-colors">
                    {featuredTrip.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-diary mt-1 line-clamp-2">
                    {featuredTrip.subtitle}
                  </p>

                  {/* AI Diary Excerpt Quote */}
                  <div className="mt-4 p-3.5 rounded-2xl bg-sky-50/80 border border-sky-100 relative">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 mb-1">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>10:05 京都駅（山下さん撮影）</span>
                    </div>
                    <p className="text-xs text-slate-700 font-diary leading-relaxed line-clamp-3">
                      {featuredTrip.entries[0]?.aiDiaryText || '京都駅に到着！今日はいよいよ3人で京都旅行。駅に着いた瞬間からみんなテンションが上がっていました。'}
                    </p>
                  </div>

                  {/* Spot Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {featuredTrip.spots.slice(0, 4).map((spot, idx) => (
                      <span key={spot.id} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                        <span className="text-[9px] w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{idx + 1}</span>
                        {spot.name}
                      </span>
                    ))}
                    {featuredTrip.spots.length > 4 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
                        +{featuredTrip.spots.length - 4}箇所
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  {/* Members */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-2 overflow-hidden">
                      {featuredTrip.members.map((m) => (
                        <img 
                          key={m.id} 
                          src={m.avatar} 
                          alt={m.name} 
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" 
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-600 font-diary">{featuredTrip.members.length}人の思い出</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span>写真日記を読む</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Past Travel Memories Cards Grid */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold font-title text-slate-800 flex items-center gap-2">
              <span>保存された旅行の思い出</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-blue-700 border border-sky-100">
                {pastTrips.length}件
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-diary mt-0.5">
              いつでもあの日の旅を時系列写真で振り返ることができます
            </p>
          </div>

          <button
            onClick={onViewAllMemories}
            className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pastTrips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              id={`trip-card-${trip.id}`}
              className="group cursor-pointer bg-white rounded-3xl border border-sky-100/80 shadow-md shadow-sky-100/50 hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col"
            >
              {/* Photo representation */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img
                  src={trip.coverImage}
                  alt={trip.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Photo count badge */}
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  <span>写真 {trip.photosCount}枚</span>
                </div>

                {/* Destination badge */}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span>{trip.destination ? trip.destination.split('（')[0] : '旅先'}</span>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{trip.date}</span>
                  </div>
                  <h3 className="text-base font-bold font-title text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {trip.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-diary mt-1 line-clamp-1">
                    {trip.subtitle}
                  </p>
                </div>

                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between">
                  {/* Members */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {trip.members.map((m) => (
                        <img 
                          key={m.id} 
                          src={m.avatar} 
                          alt={m.name} 
                          className="inline-block h-5 w-5 rounded-full ring-2 ring-white object-cover" 
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-500 font-diary">{trip.members.length}人</span>
                  </div>

                  <span className="text-xs font-bold text-blue-600 flex items-center gap-0.5">
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
  );
};
