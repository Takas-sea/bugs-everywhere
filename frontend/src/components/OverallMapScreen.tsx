import React, { useState } from 'react';
import { MapPin, Navigation, Sparkles, ChevronRight, Calendar, Compass, Camera } from 'lucide-react';
import { Trip } from '../types';

interface OverallMapScreenProps {
  trips: Trip[];
  onSelectTrip: (trip: Trip) => void;
}

export const OverallMapScreen: React.FC<OverallMapScreenProps> = ({
  trips,
  onSelectTrip,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const mapPins = [
    {
      id: 'pin-kyoto',
      title: '京都 1日写真旅行',
      date: '2026.08',
      region: 'kansai',
      x: '52%',
      y: '58%',
      color: 'bg-blue-600',
      spots: ['京都駅', '清水寺', '祇園辻利', '八坂神社', '伏見稲荷'],
      trip: trips.find((t) => t.id === 'kyoto-2026-08') || trips[0],
    },
    {
      id: 'pin-osaka',
      title: '大阪 食い倒れ旅',
      date: '2026.07',
      region: 'kansai',
      x: '48%',
      y: '63%',
      color: 'bg-sky-500',
      spots: ['新大阪駅', '道頓堀', '心斎橋'],
      trip: trips.find((t) => t.id === 'osaka-2026-07') || trips[1] || trips[0],
    },
    {
      id: 'pin-okinawa',
      title: '沖縄 エメラルドビーチ旅',
      date: '2025.09',
      region: 'okinawa',
      x: '25%',
      y: '85%',
      color: 'bg-teal-500',
      spots: ['那覇空港', '古宇利大橋', '美ら海水族館'],
      trip: trips.find((t) => t.id === 'okinawa-2025-09') || trips[0],
    },
    {
      id: 'pin-kanazawa',
      title: '金沢 アート＆古街旅',
      date: '2025.05',
      region: 'chubu',
      x: '56%',
      y: '42%',
      color: 'bg-indigo-500',
      spots: ['金沢駅', '兼六園', '21世紀美術館'],
      trip: trips.find((t) => t.id === 'kanazawa-2025-05') || trips[0],
    },
  ];

  const filteredPins = mapPins.filter(
    (pin) => selectedRegion === 'all' || pin.region === selectedRegion
  );

  return (
    <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-blue-700 text-xs font-bold mb-2">
          <MapPin className="w-3.5 h-3.5" />
          <span>旅マップ・全体ビュー</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-title text-slate-800">
          旅の足跡マップ
        </h1>
        <p className="text-sm text-slate-600 font-diary mt-1">
          訪れた地域と撮影スポットがひと目でわかるインタラクティブマップ
        </p>
      </div>

      {/* Region Filter Bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedRegion('all')}
          className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
            selectedRegion === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50'
          }`}
        >
          全国 ({mapPins.length}地域)
        </button>
        <button
          onClick={() => setSelectedRegion('kansai')}
          className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
            selectedRegion === 'kansai'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50'
          }`}
        >
          関西 (2件)
        </button>
        <button
          onClick={() => setSelectedRegion('chubu')}
          className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
            selectedRegion === 'chubu'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50'
          }`}
        >
          中部・北陸 (1件)
        </button>
        <button
          onClick={() => setSelectedRegion('okinawa')}
          className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
            selectedRegion === 'okinawa'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-sky-100 hover:bg-sky-50'
          }`}
        >
          沖縄 (1件)
        </button>
      </div>

      {/* Main Map Visual Canvas */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        <div className="relative h-[380px] sm:h-[460px] rounded-2xl bg-gradient-to-b from-sky-50 via-blue-50/40 to-white overflow-hidden border border-sky-200/70">
          {/* Subtle Map Grid Pattern */}
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

          {/* Compass Rose */}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-xs p-2.5 rounded-2xl border border-sky-100 shadow-2xs flex items-center gap-1 text-xs font-bold text-slate-700">
            <Compass className="w-4 h-4 text-blue-600 animate-spin duration-[20000ms]" />
            <span>JAPAN MAP</span>
          </div>

          {/* Map Pins overlay */}
          {filteredPins.map((pin) => (
            <div
              key={pin.id}
              style={{ left: pin.x, top: pin.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10"
              onClick={() => pin.trip && onSelectTrip(pin.trip)}
            >
              {/* Pulsing ring */}
              <span className="absolute -inset-2 rounded-full bg-blue-400/40 animate-ping duration-1000" />
              
              {/* Pin Icon button */}
              <div className={`relative px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all group-hover:scale-110 ${pin.color}`}>
                <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="whitespace-nowrap">{pin.title}</span>
              </div>

              {/* Hover Tooltip Card */}
              <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-white p-3 rounded-xl border border-sky-200 shadow-xl text-left z-30">
                <span className="text-[10px] text-slate-400 font-mono block">{pin.date}</span>
                <h4 className="text-xs font-bold text-slate-800 leading-snug">{pin.title}</h4>
                <p className="text-[10px] text-blue-600 font-diary mt-1 truncate">
                  {pin.spots.join(' → ')}
                </p>
              </div>
            </div>
          ))}

          {/* Bottom helper notice */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-sky-100 text-xs text-slate-600 font-diary flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              ピンをタップすると、その旅行の写真日記にジャンプします
            </span>
            <span className="text-[11px] font-bold text-blue-600 hidden sm:inline">
              全国制覇率: 4都道府県
            </span>
          </div>
        </div>
      </div>

      {/* Trips list by region */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold font-title text-slate-800">
          登録済みの旅行写真アルバム ({trips.length}件)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              className="p-4 rounded-2xl bg-white border border-sky-100 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex items-center gap-4 group"
            >
              <img
                src={trip.coverImage}
                alt={trip.title}
                className="w-18 h-18 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>{trip.date}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                  {trip.title}
                </h4>
                <p className="text-xs text-slate-500 font-diary truncate mt-0.5">
                  {trip.destination} · 写真 {trip.photosCount}枚
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
