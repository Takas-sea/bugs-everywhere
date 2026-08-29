import React, { useEffect, useState } from 'react';
import { 
 Calendar, Users, MapPin, Image as ImageIcon, Sparkles, Share2, 
 Download, UserPlus, Heart, Bookmark, ArrowLeft,
 Clock, Camera, Smile, Utensils, Mountain, Award, Edit3, Check,
 MessageCircle, Send, Plus, Flame, Sparkle, Printer
} from 'lucide-react';
import { Trip, DiaryTab, DiaryEntry, TripHighlight, MapSpot } from '../types';
import { renameTrip } from '../lib/trips';
import { updateScenePlace } from '../lib/scenes';

interface DiaryDetailScreenProps {
 trip: Trip;
 onBack: () => void;
 onOpenInviteModal: () => void;
 onSelectPhotoLightbox: (photoUrl: string, caption?: string, spotName?: string) => void;
 onUploadMorePhotos?: () => void;
 /** 一日の流れを1枚にまとめた表示へ */
 onExportPoster?: () => void;
}

export const DiaryDetailScreen: React.FC<DiaryDetailScreenProps> = ({
 trip: initialTrip,
 onBack,
 onOpenInviteModal,
 onSelectPhotoLightbox,
 onUploadMorePhotos,
 onExportPoster,
}) => {
 const [trip, setTrip] = useState<Trip>(initialTrip);
 const [activeTab, setActiveTab] = useState<DiaryTab>('diary');
 const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
 const [selectedMapSpot, setSelectedMapSpot] = useState<MapSpot | null>(trip.spots[0] || null);
 const [copiedLink, setCopiedLink] = useState(false);

 /* 名前の編集 */
 const [isRenaming, setIsRenaming] = useState(false);
 const [titleDraft, setTitleDraft] = useState(initialTrip.title);
 const [renameError, setRenameError] = useState<string | null>(null);

 /* 親が読み直した内容をここにも反映する（生成の進みを取り込むため） */
 useEffect(() => {
   setTrip(initialTrip);
   setTitleDraft(initialTrip.title);
 }, [initialTrip]);

 /* ギャラリーは、コマではなく実際にアップロードされた写真を並べます。
    コマの画像は生成された絵なので、写真として数えると合いません。 */
 const galleryPhotos = trip.photoItems ?? [];

 /* コマの場所名の編集 */
 const [placeEditingId, setPlaceEditingId] = useState<string | null>(null);
 const [placeDraft, setPlaceDraft] = useState('');
 const [placeError, setPlaceError] = useState<string | null>(null);

 const startPlaceEdit = (entry: DiaryEntry) => {
   setPlaceEditingId(entry.id);
   setPlaceDraft(entry.location);
   setPlaceError(null);
 };

 const savePlace = async (entry: DiaryEntry) => {
   if (!entry.sceneId) { setPlaceEditingId(null); return; }
   const next = placeDraft.trim();
   if (next === entry.location) { setPlaceEditingId(null); return; }
   try {
     await updateScenePlace(entry.sceneId, next);
     setTrip((prev) => ({
       ...prev,
       entries: prev.entries.map((e) =>
         e.id === entry.id ? { ...e, location: next } : e
       ),
     }));
     setPlaceEditingId(null);
     setPlaceError(null);
   } catch (e) {
     setPlaceError(String(e));
   }
 };

 const handleRename = async () => {
   const next = titleDraft.trim();
   if (!next || next === trip.title) {
     setIsRenaming(false);
     return;
   }
   try {
     await renameTrip(trip.id, next);
     setTrip((prev) => ({ ...prev, title: next }));
     setRenameError(null);
     setIsRenaming(false);
   } catch (e) {
     setRenameError(String(e));
   }
 };

 // Editing state for diary entries
 const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
 const [editingText, setEditingText] = useState('');
 
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

 const getHighlightIcon = (type: TripHighlight['type']) => {
 switch (type) {
 case 'laugh':
 return <Smile className="w-4 h-4 text-blue-600" />;
 case 'view':
 return <Mountain className="w-4 h-4 text-blue-700" />;
 case 'food':
 return <Utensils className="w-4 h-4 text-blue-700" />;
 case 'best_shot':
 return <Award className="w-4 h-4 text-blue-700" />;
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

 /* 表示用のまとめ。数字は summaryStats、名前は trip の中身から作ります */
 const spotRange =
   trip.spots.length === 0
     ? '記録なし'
     : trip.spots.length === 1
       ? trip.spots[0].name
       : `${trip.spots[0].name}〜${trip.spots[trip.spots.length - 1].name}`;

 const timeRange = summary.travelDuration || '';

 /* 開始と終了の時刻から所要時間を作る */
 const durationLabel = (() => {
   const m = timeRange.match(/(\d{1,2}):(\d{2})\D+?(\d{1,2}):(\d{2})/);
   if (!m) return timeRange || '—';
   const diff =
     (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
   if (diff <= 0) return timeRange;
   const h = Math.floor(diff / 60);
   const mm = diff % 60;
   return h > 0 ? `約${h}時間${mm > 0 ? `${mm}分` : ''}` : `約${mm}分`;
 })();

 const memberNames = trip.members.map((m) => m.name).join('・') || '記録なし';

 return (
 <div className="pb-28 md:pb-16 max-w-5xl mx-auto px-4 sm:px-6 pt-2 md:pt-4 font-sans text-slate-900">
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
 className="px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>写真を追加</span>
 </button>
 )}

 {onExportPoster && (
   <button
     onClick={onExportPoster}
     id="export-poster-btn"
     className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
     title="一日の流れを1枚にまとめる"
   >
     <Printer className="w-3.5 h-3.5 text-blue-600" />
     <span>1枚にまとめる</span>
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
 <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-md shadow-slate-200/60 mb-8">
 {/* Cover Photo */}
 <div className="relative h-72 sm:h-96 w-full overflow-hidden bg-slate-900">
 <img
 src={trip.coverImage}
 alt={trip.title}
 className="w-full h-full object-cover"
 />
 {/* Subtle gradient vignette for readability */}
 <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
 

 {/* Cover Titles */}
 <div className="absolute bottom-6 left-6 right-6 text-white">
 {isRenaming ? (
   <div className="mb-1.5 flex flex-wrap items-center gap-2">
     <input
       autoFocus
       value={titleDraft}
       onChange={(e) => setTitleDraft(e.target.value)}
       onKeyDown={(e) => {
         if (e.key === "Enter") void handleRename();
         if (e.key === "Escape") { setTitleDraft(trip.title); setIsRenaming(false); }
       }}
       className="min-w-0 flex-1 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xl sm:text-2xl font-extrabold outline-none focus:ring-2 focus:ring-blue-400"
     />
     <button
       onClick={() => void handleRename()}
       className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
     >
       保存
     </button>
     <button
       onClick={() => { setTitleDraft(trip.title); setIsRenaming(false); setRenameError(null); }}
       className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold cursor-pointer"
     >
       やめる
     </button>
   </div>
 ) : (
   <div className="mb-1.5 flex items-center gap-2">
     <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
       {trip.title}
     </h1>
     <button
       onClick={() => setIsRenaming(true)}
       aria-label="日記の名前を変える"
       title="名前を変える"
       className="shrink-0 p-1.5 rounded-lg bg-white/15 hover:bg-white/30 transition-colors cursor-pointer"
     >
       <Edit3 className="w-4 h-4 text-white" />
     </button>
   </div>
 )}

 {renameError && (
   <p className="mb-1.5 text-[11px] text-rose-200">{renameError}</p>
 )}
 <p className="text-sm sm:text-base text-white/90 font-medium">
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
 <div className="p-4 sm:p-5 bg-gradient-to-r from-white via-white to-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5">
 <Users className="w-3.5 h-3.5 text-blue-600" />
 旅行メンバー ({trip.members.length}人):
 </span>
 <div className="flex items-center gap-2 flex-wrap">
 {trip.members.map((member) => (
 <div
 key={member.id}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-2xs text-xs text-slate-700 hover:border-blue-300 transition-colors"
 >
 <img
 src={member.avatar}
 alt={member.name}
 className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-400"
 />
 <span className="font-bold">{member.name}</span>
 {member.role && (
 <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-medium">
 {member.role}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>

 
 </div>
 </section>

 {/* 10. 詳細画面の4つのタブ (写真 / 写真日記 / メンバー / 旅マップ) */}
 <div className="sticky top-0 md:top-4 z-30 mb-8">
 <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60 flex items-center justify-center max-w-xl mx-auto">
 {/* タブ1: 写真日記 */}
 <button
 onClick={() => setActiveTab('diary')}
 id="tab-diary"
 className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
 activeTab === 'diary'
 ? 'bg-blue-700 text-white shadow-sm'
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
 ? 'bg-blue-700 text-white shadow-sm'
 : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
 }`}
 >
 <ImageIcon className="w-4 h-4" />
 <span>写真 ({galleryPhotos.length}枚)</span>
 </button>


 {/* タブ4: メンバー */}
 <button
 onClick={() => setActiveTab('members')}
 id="tab-members"
 className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
 activeTab === 'members'
 ? 'bg-blue-700 text-white shadow-sm'
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
 

 {/* 6. AI写真日記：時系列タイムライン (The Core Photo Diary Timeline) */}
 {placeError && (
 <p className="mb-4 text-[11px] text-rose-600">{placeError}</p>
 )}

 <section className="relative pl-6 sm:pl-10 space-y-8 sm:space-y-12 before:absolute before:left-3 sm:before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-blue-600 before:via-blue-500 before:to-blue-600">
 {displayedEntries.map((entry, index) => {
 const isEditing = editingEntryId === entry.id;

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
 <div className="bg-white rounded-3xl border border-slate-200 shadow-md shadow-slate-200/60 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden">
 {/* Entry Header: Time & Spot */}
 <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-transparent flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-2.5">
 <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold font-mono">
 <Clock className="w-3 h-3 text-blue-600" />
 {entry.time}
 </span>
 {placeEditingId === entry.id ? (
   <span className="flex items-center gap-1.5">
     <input
       autoFocus
       value={placeDraft}
       onChange={(ev) => setPlaceDraft(ev.target.value)}
       onKeyDown={(ev) => {
         if (ev.key === "Enter") void savePlace(entry);
         if (ev.key === "Escape") setPlaceEditingId(null);
       }}
       placeholder="場所の名前"
       className="px-2.5 py-1 rounded-lg border border-blue-300 text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
     />
     <button
       onClick={() => void savePlace(entry)}
       className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
     >
       保存
     </button>
     <button
       onClick={() => setPlaceEditingId(null)}
       className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
     >
       やめる
     </button>
   </span>
 ) : (
   <button
     onClick={() => startPlaceEdit(entry)}
     title="場所の名前を直す"
     className="group/place flex items-center gap-1.5 cursor-pointer text-left"
   >
     <h3 className="text-base sm:text-xl font-bold text-slate-800">
       {entry.location || '場所を入れる'}
     </h3>
     <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover/place:text-blue-600 transition-colors" />
   </button>
 )}
 {entry.feeling && (
 <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
 #{entry.feeling}
 </span>
 )}
 </div>

 </div>

 {/* Photo & Journal Content Area */}
 <div className="p-5 sm:p-7">
 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
 {/* 1. 実際に撮影した写真 (Photo Column) */}
 <div className="md:col-span-6">
 <div
 onClick={() => onSelectPhotoLightbox(entry.photoUrl, entry.aiDiaryText, entry.location)}
 className="relative rounded-2xl overflow-hidden shadow-sm group/photo cursor-pointer bg-slate-100 aspect-4/3 border border-slate-200"
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

 <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-blue-700/90 backdrop-blur-xs text-[10px] text-white font-bold">
 実写写真
 </div>
 </div>
 </div>

 {/* 2. AIが生成した日記文章 (AI Diary Text Column & Editing/Q&A) */}
 <div className="md:col-span-6 flex flex-col justify-between space-y-4">
 {/* Diary Text or Direct Edit Form */}
 <div>
 <div className="flex items-center justify-between mb-2">

 {/* 8. 編集ボタン */}
 {!isEditing && (
 <button
 type="button"
 onClick={() => handleStartEdit(entry)}
 className="text-xs text-slate-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
 >
 <Edit3 className="w-3.5 h-3.5" />
 <span>編集</span>
 </button>
 )}
 </div>

 {isEditing ? (
 <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
 <textarea
 rows={4}
 value={editingText}
 onChange={(e) => setEditingText(e.target.value)}
 className="w-full text-sm p-3 rounded-xl bg-white border border-sky-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
 <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
 {entry.aiDiaryText}
 </p>
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

 {/* 9. 旅行の最後に「今回の旅の思い出」セクション */}
 <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mt-12">
 <div className="text-center mb-10">
 <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
 今回の旅の思い出
 </h2>
 </div>

 {/* 4 Stats Cards Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
 {/* 1. 訪れた場所 */}
 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
 <div className="text-sm text-slate-600 font-medium mb-3">訪れた場所</div>
 <div className="text-3xl font-bold text-red-600">
 {summary.visitedPlacesCount}
 <span className="ml-2 text-sm font-normal text-slate-600">箇所</span>
 </div>
 <div className="text-xs text-slate-400 mt-3 truncate">{spotRange}</div>
 </div>

 {/* 2. 旅行時間 */}
 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
 <div className="text-sm text-slate-600 font-medium mb-3">旅行時間</div>
 <div className="text-2xl font-bold text-red-600">{durationLabel}</div>
 <div className="text-xs text-slate-400 mt-3">{timeRange}</div>
 </div>

 {/* 3. 撮影した写真 */}
 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
 <div className="text-sm text-slate-600 font-medium mb-3">撮影した写真</div>
 <div className="text-3xl font-bold text-red-600">
 {summary.totalPhotosCount}
 <span className="ml-2 text-sm font-normal text-slate-600">枚</span>
 </div>
 <div className="text-xs text-slate-400 mt-3">{summary.membersCount}人で集約</div>
 </div>

 {/* 4. 参加メンバー */}
 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
 <div className="text-sm text-slate-600 font-medium mb-3">参加メンバー</div>
 <div className="text-3xl font-bold text-red-600">
 {summary.membersCount}
 <span className="ml-2 text-sm font-normal text-slate-600">人</span>
 </div>
 <div className="text-xs text-slate-400 mt-3 truncate">{memberNames}</div>
 </div>
 </div>
 </section>
 </div>
 )}

 {/* TAB 2: 写真 (Photo Gallery Grid View) */}
 {activeTab === 'photos' && (
 <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div>
 <h2 className="text-xl font-bold text-slate-800">
 旅行写真ギャラリー ({galleryPhotos.length}枚)
 </h2>
 <p className="text-xs text-slate-500 mt-0.5">
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
 {galleryPhotos.map((entry) => (
 <div
 key={entry.id}
 onClick={() => onSelectPhotoLightbox(entry.url, entry.locationName, entry.locationName)}
 className="group cursor-pointer rounded-2xl overflow-hidden border border-slate-200 shadow-2xs hover:shadow-lg transition-all bg-white flex flex-col"
 >
 <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
 <img
 src={entry.url}
 alt={entry.locationName}
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
 <h4 className="text-xs font-bold text-slate-800 truncate">{entry.locationName || '場所の記録なし'}</h4>
 <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{entry.caption || `${entry.time} に撮影`}</p>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}


 {/* TAB 4: メンバー (Travel Members List View) */}
 {activeTab === 'members' && (
 <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div>
 <h2 className="text-xl font-bold text-slate-800">
 旅行メンバー一覧 ({trip.members.length}人)
 </h2>
 <p className="text-xs text-slate-500 mt-0.5">
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
 className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-4 hover:bg-white hover:shadow-md transition-all"
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
 <p className="text-xs text-slate-500 mt-1">
 提供写真: {trip.entries.filter((e) => e.contributor.id === member.id).length || 14}枚
 </p>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* Bottom Print / Save Action Bar */}
 <div className="mt-10 p-6 rounded-3xl bg-blue-700 text-white shadow-lg shadow-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
 <div>
 <h3 className="text-lg font-bold flex items-center gap-2">
 <Bookmark className="w-5 h-5" />
 <span>この写真日記を保存・共有</span>
 </h3>
 <p className="text-xs text-white/90 mt-0.5">
 PDF形式でのダウンロードや、友達への共有リンクを発行できます
 </p>
 </div>

 <div className="flex items-center gap-3 w-full sm:w-auto">
 <button
 onClick={() => window.print()}
 className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white text-blue-600 font-bold text-xs shadow-md hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
