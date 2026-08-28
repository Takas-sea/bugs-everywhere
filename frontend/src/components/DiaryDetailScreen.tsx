import React, { useState } from 'react';
import { 
  Calendar, Users, MapPin, Image as ImageIcon, Sparkles, Share2, 
  Download, UserPlus, Heart, Bookmark, ArrowLeft,
  Clock, Camera, Smile, Utensils, Mountain, Award, Edit3, Check, RefreshCw,
  MessageCircle, Send, Plus, Flame, Sparkle
} from 'lucide-react';
import { Trip, DiaryTab, DiaryEntry, TripHighlight, MapSpot } from '../types';

interface DiaryDetailScreenProps {
  trip: Trip;
  onBack: () => void;
  onOpenInviteModal: () => void;
  onSelectPhotoLightbox: (photoUrl: string, caption?: string, spotName?: string) => void;
  onUploadMorePhotos?: () => void;
}

export const DiaryDetailScreen: React.FC<DiaryDetailScreenProps> = ({
  trip: initialTrip,
  onBack,
  onOpenInviteModal,
  onSelectPhotoLightbox,
  onUploadMorePhotos,
}) => {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [activeTab, setActiveTab] = useState<DiaryTab>('diary');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [selectedMapSpot, setSelectedMapSpot] = useState<MapSpot | null>(trip.spots[0] || null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Editing state for diary entries
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // Interactive Q&A state for each entry
  const [qaAnswers, setQaAnswers] = useState<Record<string, string>>({
    'entry-1': '新幹線のホームで無事合流できて、みんな朝から元気いっぱいだった',
    'entry-3': '3人で違うパフェを頼んで少しずつ交換した',
    'entry-6': 'ライトアップされた千本鳥居が神秘的で、涼しくて歩きやすかった',
  });
  const [qaInputTexts, setQaInputTexts] = useState<Record<string, string>>({});
  const [activeQaId, setActiveQaId] = useState<string | null>(null);

  // Filter entries if member filter is selected
  const displayedEntries = trip.entries.filter((entry) => {
    if (selectedMemberFilter === 'all') return true;
    return entry.contributor.id === selectedMemberFilter;
  });

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartEdit = (entry: DiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditingText(entry.aiDiaryText);
  };

  const handleSaveEdit = (entryId: string) => {
    setTrip((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => 
        e.id === entryId ? { ...e, aiDiaryText: editingText } : e
      ),
    }));
    setEditingEntryId(null);
  };

  // AI Rewriting / Tone adjustment
  const handleAiToneChange = (entryId: string, tone: 'funny' | 'short' | 'emotional' | 'simple') => {
    const entry = trip.entries.find((e) => e.id === entryId);
    if (!entry) return;

    let newText = entry.aiDiaryText;
    if (tone === 'emotional') {
      newText = `【心に残るひととき】\n${entry.location}で過ごした時間は、写真を見返すたびに鮮やかに蘇ります。3人で交わした何気ない会話や笑顔が、何よりもかけがえのない宝物になりました。`;
    } else if (tone === 'funny') {
      newText = `【爆笑エピソード】\n${entry.location}にて！みんなテンションMAXで笑いが止まらないハプニング発生！この瞬間をカメラに収められて本当に良かった（笑）！`;
    } else if (tone === 'short') {
      newText = `${entry.time}、${entry.location}に到着。みんなで記念撮影をして楽しい時間を過ごしました。`;
    } else if (tone === 'simple') {
      newText = `${entry.location}を訪問。\n天候にも恵まれ、思い出に残る一枚を撮影することができました。`;
    }

    setTrip((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => 
        e.id === entryId ? { ...e, aiDiaryText: newText } : e
      ),
    }));
  };

  // Handle Q&A answer submission to enrich diary text factually
  const handleAnswerSubmit = (entryId: string) => {
    const answer = qaInputTexts[entryId]?.trim();
    if (!answer) return;

    setQaAnswers((prev) => ({ ...prev, [entryId]: answer }));
    
    // Automatically update the AI diary text with the user's factual input
    setTrip((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => {
        if (e.id === entryId) {
          const updatedDiary = `${e.aiDiaryText}\n（エピソード：${answer}）`;
          return {
            ...e,
            aiDiaryText: updatedDiary,
            userAnswer: answer,
            isAnswered: true,
          };
        }
        return e;
      }),
    }));

    setQaInputTexts((prev) => ({ ...prev, [entryId]: '' }));
    setActiveQaId(null);
  };

  const getHighlightIcon = (type: TripHighlight['type']) => {
    switch (type) {
      case 'laugh':
        return <Smile className="w-4 h-4 text-blue-600" />;
      case 'view':
        return <Mountain className="w-4 h-4 text-sky-600" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-teal-600" />;
      case 'best_shot':
        return <Award className="w-4 h-4 text-indigo-600" />;
    }
  };

  const summary = trip.summaryStats || {
    visitedPlacesCount: trip.spots.length || 6,
    travelDuration: '約9時間15分 (10:05〜19:20)',
    totalPhotosCount: trip.photosCount || 42,
    membersCount: trip.members.length || 3,
    topPhotoSpot: '清水寺',
    topPhotoSpotCount: 14,
    bestShotUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    bestShotTitle: '清水の舞台から見渡した京都の青空',
    bestShotDescription: '青空と緑の山並みがどこまでも広がり、3人で見上げたこの日の象徴的な一枚です。',
    bestShotPhotographer: '田中さん',
  };

  return (
    <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-2 md:pt-4">
      {/* Top Back & Quick Action Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>思い出一覧に戻る</span>
        </button>

        <div className="flex items-center gap-2">
          {onUploadMorePhotos && (
            <button
              onClick={onUploadMorePhotos}
              className="px-3.5 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-blue-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>写真を追加</span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={handleShare}
            id="share-diary-btn"
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer relative"
            title="思い出をシェア"
          >
            <Share2 className="w-4 h-4 text-blue-600" />
            {copiedLink && (
              <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap z-50 shadow-md">
                リンクをコピーしました
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 5. 旅行写真アルバムの表紙 (Travel Photo Album Cover Section) */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        {/* Cover Photo */}
        <div className="relative h-72 sm:h-96 w-full overflow-hidden bg-slate-900">
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
          {/* Subtle gradient vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
          
          {/* AI Cover Stamp Badge */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI時系列写真日記アルバム</span>
          </div>

          {/* Cover Titles */}
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <span className="inline-block px-3 py-1 rounded-lg bg-blue-600/90 backdrop-blur-xs text-[11px] font-bold tracking-widest uppercase mb-2">
              PHOTO JOURNAL
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold font-title tracking-tight text-white mb-1.5">
              {trip.title}
            </h1>
            <p className="text-sm sm:text-base text-sky-100 font-diary font-medium">
              {trip.subtitle}
            </p>

            {/* Trip Stats Badges (旅行日、人数、訪れた場所数、写真枚数) */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 pt-3 border-t border-white/20 text-xs text-white/90">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-300" />
                <span>{trip.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>メンバー {trip.members.length}人</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-300" />
                <span>訪れた場所 {trip.spots.length || trip.spotsCount}箇所</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />
                <span>写真 {trip.photosCount}枚</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span>{trip.weather}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 旅行メンバー機能エリア (Travel Members Section with Avatars & Invite) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-50/50 via-white to-blue-50/40 border-t border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              旅行メンバー ({trip.members.length}人):
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {trip.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-sky-200/80 shadow-2xs text-xs text-slate-700 hover:border-blue-300 transition-colors"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-400"
                  />
                  <span className="font-bold">{member.name}</span>
                  {member.role && (
                    <span className="text-[10px] text-blue-700 bg-sky-50 px-1.5 py-0.2 rounded font-medium">
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invite Member Button */}
          <button
            onClick={onOpenInviteModal}
            id="invite-member-btn"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200 cursor-pointer shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>メンバーを招待</span>
          </button>
        </div>
      </section>

      {/* 10. 詳細画面の4つのタブ (写真 / 写真日記 / メンバー / 旅マップ) */}
      <div className="sticky top-0 md:top-4 z-30 mb-8">
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-sky-200 shadow-md shadow-sky-100 flex items-center justify-center max-w-xl mx-auto">
          {/* タブ1: 写真日記 */}
          <button
            onClick={() => setActiveTab('diary')}
            id="tab-diary"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'diary'
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>写真日記</span>
          </button>

          {/* タブ2: 写真 */}
          <button
            onClick={() => setActiveTab('photos')}
            id="tab-photos"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>写真 ({trip.entries.length}枚)</span>
          </button>

          {/* タブ3: 旅マップ */}
          <button
            onClick={() => setActiveTab('map')}
            id="tab-map"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>旅マップ ({trip.spots.length}地点)</span>
          </button>

          {/* タブ4: メンバー */}
          <button
            onClick={() => setActiveTab('members')}
            id="tab-members"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>メンバー ({trip.members.length}人)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: 写真日記 (Timeline Photo Diary) */}
      {activeTab === 'diary' && (
        <div className="space-y-10">
          {/* Contributor Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-b border-sky-100 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">撮影者で絞り込み:</span>
              <button
                onClick={() => setSelectedMemberFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  selectedMemberFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全員 ({trip.entries.length}枚)
              </button>
              {trip.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberFilter(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    selectedMemberFilter === m.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <img src={m.avatar} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                  <span>{m.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500 font-diary">
              🕒 撮影時間順に整理されています
            </span>
          </div>

          {/* 6. AI写真日記：時系列タイムライン (The Core Photo Diary Timeline) */}
          <section className="relative pl-6 sm:pl-10 space-y-8 sm:space-y-12 before:absolute before:left-3 sm:before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-blue-600 before:via-sky-400 before:to-teal-400">
            {displayedEntries.map((entry, index) => {
              const isEditing = editingEntryId === entry.id;
              const isQaOpen = activeQaId === entry.id;
              const hasQaAnswer = !!entry.userAnswer || !!qaAnswers[entry.id];

              return (
                <div
                  key={entry.id}
                  id={`diary-entry-${entry.id}`}
                  className="relative group"
                >
                  {/* Timeline node icon */}
                  <div className="absolute -left-6 sm:-left-10 top-6 w-6 sm:w-10 h-6 sm:h-10 rounded-full bg-white border-3 border-blue-600 shadow-md flex items-center justify-center text-[10px] sm:text-xs font-bold text-blue-700 group-hover:scale-110 group-hover:bg-blue-50 transition-all">
                    {index + 1}
                  </div>

                  {/* Main Photo Diary Entry Card */}
                  <div className="bg-white rounded-3xl border border-sky-100 shadow-md shadow-sky-100/50 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden">
                    {/* Entry Header: Time & Spot */}
                    <div className="p-5 sm:p-6 pb-4 border-b border-sky-100/80 bg-gradient-to-r from-sky-50/40 via-white to-transparent flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                          <Clock className="w-3 h-3 text-blue-600" />
                          {entry.time}
                        </span>
                        <h3 className="text-base sm:text-xl font-bold font-title text-slate-800">
                          {entry.location}
                        </h3>
                        {entry.feeling && (
                          <span className="text-xs px-2.5 py-0.5 rounded-md bg-sky-50 text-blue-700 font-diary font-medium">
                            #{entry.feeling}
                          </span>
                        )}
                      </div>

                      {/* 撮影者 (📷 山下さんが撮影) */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-sky-50/80 px-3 py-1 rounded-full border border-sky-100">
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <img
                            src={entry.contributor.avatar}
                            alt={entry.contributor.name}
                            className="w-4 h-4 rounded-full object-cover ring-1 ring-blue-400"
                          />
                          <span>{entry.contributor.name} が撮影</span>
                        </div>
                      </div>
                    </div>

                    {/* Photo & Journal Content Area */}
                    <div className="p-5 sm:p-7">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        {/* 1. 実際に撮影した写真 (Photo Column) */}
                        <div className="md:col-span-6">
                          <div
                            onClick={() => onSelectPhotoLightbox(entry.photoUrl, entry.aiDiaryText, entry.location)}
                            className="relative rounded-2xl overflow-hidden shadow-sm group/photo cursor-pointer bg-slate-100 aspect-4/3 border border-sky-100"
                          >
                            <img
                              src={entry.photoUrl}
                              alt={entry.location}
                              className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover/photo:opacity-100 px-3 py-1.5 rounded-full bg-white/95 text-xs font-bold text-slate-800 shadow-sm transition-opacity flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-blue-600" />
                                写真を拡大表示
                              </span>
                            </div>

                            {entry.cameraInfo && (
                              <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white/90 font-mono">
                                {entry.cameraInfo}
                              </div>
                            )}

                            <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-blue-600/85 backdrop-blur-xs text-[10px] text-white font-bold">
                              実写写真
                            </div>
                          </div>
                        </div>

                        {/* 2. AIが生成した日記文章 (AI Diary Text Column & Editing/Q&A) */}
                        <div className="md:col-span-6 flex flex-col justify-between space-y-4">
                          {/* Diary Text or Direct Edit Form */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI写真日記</span>
                              </span>

                              {/* 8. 編集ボタン */}
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(entry)}
                                  className="text-xs text-slate-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>編集</span>
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-3 bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200">
                                <textarea
                                  rows={4}
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full text-sm p-3 rounded-xl bg-white border border-sky-300 text-slate-800 font-diary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntryId(null)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(entry.id)}
                                    className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>保存する</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative pl-4 border-l-3 border-blue-400 py-1">
                                <p className="text-sm sm:text-base text-slate-700 font-diary leading-relaxed whitespace-pre-line">
                                  {entry.aiDiaryText}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* 8. AI文章のトーン変更ボタン (エモい・面白い・短く・シンプル) */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-sky-500" />
                                <span>AIで文章の雰囲気を変更:</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleAiToneChange(entry.id, 'emotional')}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-medium transition-colors cursor-pointer border border-sky-100"
                              >
                                ✨ エモい文章に
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAiToneChange(entry.id, 'funny')}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium transition-colors cursor-pointer border border-blue-100"
                              >
                                😄 もっと面白く
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAiToneChange(entry.id, 'short')}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-medium transition-colors cursor-pointer border border-teal-100"
                              >
                                📝 短くする
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAiToneChange(entry.id, 'simple')}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                              >
                                🍃 シンプルに
                              </button>
                            </div>
                          </div>

                          {/* 7. AIが勝手に事実を作らない設計 (インタラクティブQ&A) */}
                          <div className="mt-3 pt-3 border-t border-sky-100/80 bg-sky-50/60 p-3 rounded-2xl border border-sky-200/70">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                                <span>AIからの質問（事実確認）:</span>
                              </div>
                              {hasQaAnswer && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                                  ✓ 回答反映済み
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-700 font-diary mb-2">
                              {entry.qaPrompt || `「${entry.location}」で特に印象に残った出来事や会話はありましたか？`}
                            </p>

                            {/* Show previous answer or answer input */}
                            {hasQaAnswer && !isQaOpen ? (
                              <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-sky-100">
                                <span className="text-slate-600 font-diary truncate">
                                  回答: 「{entry.userAnswer || qaAnswers[entry.id]}」
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveQaId(entry.id)}
                                  className="text-blue-600 text-[11px] font-bold hover:underline shrink-0 ml-2 cursor-pointer"
                                >
                                  変更する
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={qaInputTexts[entry.id] || ''}
                                  onChange={(e) => setQaInputTexts((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAnswerSubmit(entry.id);
                                    }
                                  }}
                                  placeholder="例: 3人で違うパフェを頼んで少しずつ交換した"
                                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-sky-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-diary"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAnswerSubmit(entry.id)}
                                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>反映</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* 9. 旅行の最後に「今回の旅の思い出」セクション (Trip Highlights & Summary Section) */}
          <section className="bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60 rounded-3xl p-6 sm:p-8 border border-sky-200 shadow-md shadow-sky-100/50 mt-12">
            <div className="text-center max-w-xl mx-auto mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>MEMORIES SUMMARY</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-title text-slate-800">
                今回の旅の思い出
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-diary mt-1">
                3人で過ごした京都の1日を統計とベストショットで総括
              </p>
            </div>

            {/* 5 Stats Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
              {/* 1. 訪れた場所 */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between">
                <div className="text-xs text-slate-500 font-medium mb-1">訪れた場所</div>
                <div className="text-2xl font-extrabold text-blue-600 font-title">
                  {summary.visitedPlacesCount} <span className="text-xs font-normal text-slate-600">箇所</span>
                </div>
                <div className="text-[10px] text-slate-400 font-diary mt-1 truncate">京都駅〜伏見稲荷</div>
              </div>

              {/* 2. 旅行時間 */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between">
                <div className="text-xs text-slate-500 font-medium mb-1">旅行時間</div>
                <div className="text-xl font-extrabold text-sky-600 font-title">
                  約9時間15分
                </div>
                <div className="text-[10px] text-slate-400 font-diary mt-1">10:05 〜 19:20</div>
              </div>

              {/* 3. 撮影した写真枚数 */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between">
                <div className="text-xs text-slate-500 font-medium mb-1">撮影した写真</div>
                <div className="text-2xl font-extrabold text-teal-600 font-title">
                  {summary.totalPhotosCount} <span className="text-xs font-normal text-slate-600">枚</span>
                </div>
                <div className="text-[10px] text-slate-400 font-diary mt-1">3人で集約</div>
              </div>

              {/* 4. 参加メンバー */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between">
                <div className="text-xs text-slate-500 font-medium mb-1">参加メンバー</div>
                <div className="text-2xl font-extrabold text-indigo-600 font-title">
                  {summary.membersCount} <span className="text-xs font-normal text-slate-600">人</span>
                </div>
                <div className="text-[10px] text-slate-400 font-diary mt-1 truncate">山下・田中・佐藤</div>
              </div>

              {/* 5. 一番写真を撮った場所 */}
              <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="text-xs text-slate-500 font-medium mb-1">最も撮影した場所</div>
                <div className="text-lg font-extrabold text-rose-600 font-title truncate">
                  {summary.topPhotoSpot}
                </div>
                <div className="text-[10px] text-slate-400 font-diary mt-1">{summary.topPhotoSpotCount}枚撮影</div>
              </div>
            </div>

            {/* 今回のベストショット (Representative Photo Display) */}
            <div className="bg-white rounded-3xl p-6 border border-sky-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold font-title text-slate-800">
                    今回のベストショット
                  </h3>
                </div>
                <span className="text-xs text-blue-700 bg-sky-50 px-3 py-1 rounded-full font-bold border border-sky-200">
                  📷 撮影: {summary.bestShotPhotographer}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div 
                  onClick={() => onSelectPhotoLightbox(summary.bestShotUrl, summary.bestShotDescription, summary.bestShotTitle)}
                  className="md:col-span-7 relative rounded-2xl overflow-hidden aspect-16/10 shadow-md group cursor-pointer bg-slate-900"
                >
                  <img
                    src={summary.bestShotUrl}
                    alt={summary.bestShotTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 text-white">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white mr-2">BEST SHOT</span>
                    <span className="text-sm font-bold">{summary.bestShotTitle}</span>
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col justify-center">
                  <h4 className="text-base font-bold font-title text-slate-800 mb-2">
                    {summary.bestShotTitle}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-diary leading-relaxed mb-4">
                    {summary.bestShotDescription}
                  </p>
                  
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
                    <p className="text-xs text-blue-900 font-diary leading-relaxed">
                      「3人で過ごした思い出が、この写真日記にずっと残りますように。」
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: 写真 (Photo Gallery Grid View) */}
      {activeTab === 'photos' && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold font-title text-slate-800">
                旅行写真ギャラリー ({trip.entries.length}枚)
              </h2>
              <p className="text-xs text-slate-500 font-diary mt-0.5">
                メンバー全員が撮影した写真を時系列で表示しています
              </p>
            </div>

            {onUploadMorePhotos && (
              <button
                onClick={onUploadMorePhotos}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>写真を追加する</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {trip.entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelectPhotoLightbox(entry.photoUrl, entry.aiDiaryText, entry.location)}
                className="group cursor-pointer rounded-2xl overflow-hidden border border-sky-100 shadow-2xs hover:shadow-lg transition-all bg-white flex flex-col"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  <img
                    src={entry.photoUrl}
                    alt={entry.location}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono">
                    {entry.time}
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-800 shadow-2xs">
                    <img src={entry.contributor.avatar} alt={entry.contributor.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                    <span>撮影: {entry.contributor.name}</span>
                  </div>
                </div>
                <div className="p-3.5">
                  <h4 className="text-xs font-bold text-slate-800 truncate">{entry.location}</h4>
                  <p className="text-[11px] text-slate-500 font-diary line-clamp-1 mt-0.5">{entry.aiDiaryText}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: 旅マップ (Interactive Map Route View) */}
      {activeTab === 'map' && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>観光ルート追跡マップ</span>
              </div>
              <h2 className="text-xl font-bold font-title text-slate-800">
                京都観光ルート＆ピンマップ
              </h2>
              <p className="text-xs text-slate-500 font-diary mt-0.5">
                番号付きピンを押すと、その場所で撮影した写真とAI日記の文章が連動表示されます
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>移動ルート順序: ①〜⑥</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Kyoto Map Visual Canvas */}
            <div className="lg:col-span-7 bg-gradient-to-br from-sky-50 via-blue-50/40 to-teal-50/40 rounded-3xl p-6 border border-sky-200/80 relative min-h-[420px] flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Decorative Kyoto Street Grid lines */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
              
              {/* Map Title Tag */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-sky-200 shadow-2xs text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>京都・東山エリア ルートMAP</span>
                </div>
                <span className="text-[11px] text-blue-800 bg-blue-100 px-2.5 py-1 rounded-lg font-bold">
                  総移動距離: 約 8.4 km
                </span>
              </div>

              {/* Styled Interactive Pin Nodes Canvas with connected line */}
              <div className="relative z-10 my-8 py-4">
                {/* SVG Route Line connecting pins */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '260px' }}>
                  <path
                    d="M 50 180 Q 140 230 200 130 T 360 80 T 480 140 T 560 210"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3"
                    strokeDasharray="6,6"
                    className="opacity-75"
                  />
                </svg>

                {/* Spot Pins */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 relative">
                  {trip.spots.map((spot) => {
                    const isSelected = selectedMapSpot?.id === spot.id;
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setSelectedMapSpot(spot)}
                        id={`map-pin-btn-${spot.stepNumber}`}
                        className={`text-left p-3 rounded-2xl transition-all duration-200 cursor-pointer relative group ${
                          isSelected
                            ? 'bg-white shadow-lg border-2 border-blue-600 scale-105 z-20'
                            : 'bg-white/90 hover:bg-white border border-sky-200/80 shadow-2xs hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-sky-600 text-white group-hover:bg-blue-500'
                            }`}
                          >
                            {spot.stepNumber}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">{spot.time}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 truncate">{spot.name}</h4>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Map Footer Helper */}
              <div className="relative z-10 flex items-center justify-between text-xs text-blue-900 bg-white/85 backdrop-blur-xs p-3 rounded-2xl border border-sky-100">
                <span className="font-diary">ピンをタップして各スポットの写真と日記をチェック</span>
                <span className="text-[11px] font-bold text-blue-600">全{trip.spots.length}スポット走破</span>
              </div>
            </div>

            {/* Selected Pin Details Card (連動表示UI) */}
            <div className="lg:col-span-5 flex flex-col">
              {selectedMapSpot ? (
                <div className="bg-sky-50/50 rounded-3xl p-6 border border-sky-200/80 flex-1 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-2xs">
                        <span>スポット 0{selectedMapSpot.stepNumber}</span>
                        <span>•</span>
                        <span className="font-mono">{selectedMapSpot.time}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-diary">
                        {selectedMapSpot.contributorName}が記録
                      </span>
                    </div>

                    <h3 className="text-xl font-bold font-title text-slate-800 mb-3">
                      {selectedMapSpot.name}
                    </h3>

                    {/* Spot Photo */}
                    <div 
                      onClick={() => onSelectPhotoLightbox(selectedMapSpot.photoUrl, selectedMapSpot.diarySnippet, selectedMapSpot.name)}
                      className="relative rounded-2xl overflow-hidden aspect-16/10 mb-4 shadow-sm group cursor-pointer bg-slate-100"
                    >
                      <img
                        src={selectedMapSpot.photoUrl}
                        alt={selectedMapSpot.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                      <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-bold text-slate-800 shadow-2xs flex items-center gap-1">
                        <Camera className="w-3 h-3 text-blue-600" />
                        <span>写真を見る</span>
                      </div>
                    </div>

                    {/* Diary Snippet */}
                    <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>写真日記のエピソード</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 font-diary leading-relaxed">
                        "{selectedMapSpot.diarySnippet}"
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-sky-200/60 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setActiveTab('diary')}
                      className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>タイムラインで全文を読む</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-3xl p-8 text-center text-slate-400 border border-slate-100 flex-1 flex flex-col items-center justify-center">
                  <MapPin className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs">マップ上のピンを選択してください</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: メンバー (Travel Members List View) */}
      {activeTab === 'members' && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold font-title text-slate-800">
                旅行メンバー一覧 ({trip.members.length}人)
              </h2>
              <p className="text-xs text-slate-500 font-diary mt-0.5">
                共同アルバムに参加しているメンバーです。全員が写真を追加・閲覧できます。
              </p>
            </div>

            <button
              onClick={onOpenInviteModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>新しいメンバーを招待</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {trip.members.map((member) => (
              <div
                key={member.id}
                className="p-5 rounded-2xl bg-sky-50/40 border border-sky-100 flex items-center gap-4 hover:bg-white hover:shadow-md transition-all"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-400"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{member.name}</h4>
                  <span className="inline-block text-[11px] text-blue-700 bg-sky-100 px-2 py-0.5 rounded-md font-medium mt-1">
                    {member.role || 'メンバー'}
                  </span>
                  <p className="text-xs text-slate-500 font-diary mt-1">
                    提供写真: {trip.entries.filter((e) => e.contributor.id === member.id).length || 14}枚
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom Print / Save Action Bar */}
      <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 text-white shadow-lg shadow-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold font-title flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            <span>この写真日記を保存・共有</span>
          </h3>
          <p className="text-xs text-white/90 font-diary mt-0.5">
            PDF形式でのダウンロードや、友達への共有リンクを発行できます
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white text-blue-600 font-bold text-xs shadow-md hover:bg-sky-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDFで保存 / 印刷</span>
          </button>
          <button
            onClick={handleShare}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-700/60 hover:bg-blue-700 text-white font-bold text-xs backdrop-blur-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-white/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'コピー完了！' : '共有リンク'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
