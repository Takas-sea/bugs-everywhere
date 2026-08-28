import React, { useState } from 'react';
import { Search, Calendar, MapPin, Image as ImageIcon, Plus, Users, ChevronRight, Sparkles, Filter } from 'lucide-react';
import { Trip } from '../types';

interface MemoriesListScreenProps {
  trips: Trip[];
  onSelectTrip: (trip: Trip) => void;
  onNewTripClick: () => void;
}

export const MemoriesListScreen: React.FC<MemoriesListScreenProps> = ({
  trips,
  onSelectTrip,
  onNewTripClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Extract all tags
  const allTags = Array.from(new Set(trips.flatMap((t) => t.tags || [])));

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.date.includes(searchQuery);
    const matchesTag = selectedTag === 'all' || trip.tags?.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-blue-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>写真日記アーカイブ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-title text-slate-800">
            旅の写真日記一覧
          </h1>
          <p className="text-sm text-slate-600 font-diary mt-1">
            これまでにAIと作った大切な旅行写真日記 ({trips.length}冊)
          </p>
        </div>

        <button
          onClick={onNewTripClick}
          id="memories-new-trip-btn"
          className="self-start sm:self-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:scale-102 active:scale-98 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>新しい思い出を作る</span>
        </button>
      </div>

      {/* Search and Tags Filter */}
      <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-xs mb-8 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="旅行タイトル、日付、場所で検索 (例: 京都, 2026, パフェ)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all font-diary"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                selectedTag === 'all'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              すべて
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trips Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTrips.map((trip) => (
          <div
            key={trip.id}
            onClick={() => onSelectTrip(trip)}
            id={`memories-card-${trip.id}`}
            className="group cursor-pointer bg-white rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden flex flex-col"
          >
            {/* Top Cover Banner */}
            <div className="relative h-52 sm:h-56 w-full overflow-hidden bg-slate-100">
              <img
                src={trip.coverImage}
                alt={trip.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-800 flex items-center gap-1 shadow-2xs">
                <Calendar className="w-3 h-3 text-blue-600" />
                <span>{trip.date}</span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h3 className="text-xl font-bold font-title drop-shadow-xs group-hover:text-sky-200 transition-colors">
                  {trip.title}
                </h3>
                <p className="text-xs text-white/90 font-diary line-clamp-1 mt-0.5">
                  {trip.subtitle}
                </p>
              </div>
            </div>

            {/* Bottom Meta & Spots Info */}
            <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-white to-sky-50/20">
              {/* Tags & Spot pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {trip.tags?.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-blue-800 font-medium">
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>写真 {trip.photosCount}枚</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>{trip.spotsCount || trip.spots.length}スポット</span>
                  </span>
                </div>

                <div className="flex items-center gap-1 font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                  <span>写真日記を開く</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
