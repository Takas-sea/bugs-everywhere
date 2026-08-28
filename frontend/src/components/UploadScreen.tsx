import React, { useState, useRef } from 'react';
import { 
  Upload, Sparkles, Clock, MapPin, Trash2, UserPlus, 
  ArrowRight, ArrowLeft, Image as ImageIcon, Camera, Plus, Check, Info
} from 'lucide-react';
import { PhotoItem, Contributor, Trip } from '../types';
import { SAMPLE_MEMBERS, SAMPLE_UPLOAD_PHOTOS } from '../data/mockTrips';

interface UploadScreenProps {
  currentTrip: Trip;
  onGenerateDiary: (photos: PhotoItem[]) => void;
  onBack: () => void;
  onOpenInviteModal: () => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  currentTrip,
  onGenerateDiary,
  onBack,
  onOpenInviteModal,
}) => {
  // Photos uploaded for this trip
  const [photos, setPhotos] = useState<PhotoItem[]>(SAMPLE_UPLOAD_PHOTOS);
  const [currentUploader, setCurrentUploader] = useState<Contributor>(currentTrip.members[0] || SAMPLE_MEMBERS[0]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<PhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New photo custom mock inputs
  const [customLocation, setCustomLocation] = useState('祇園 辻利');
  const [customTime, setCustomTime] = useState('14:30');

  // Handle mock file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: PhotoItem[] = files.map((file, idx) => {
        const url = URL.createObjectURL(file as Blob);
        const randomHour = 10 + Math.floor(Math.random() * 8);
        const randomMin = 10 + Math.floor(Math.random() * 45);
        const timeStr = `${String(randomHour).padStart(2, '0')}:${String(randomMin).padStart(2, '0')}`;

        return {
          id: `custom-photo-${Date.now()}-${idx}`,
          url,
          time: timeStr,
          timestamp: Date.now() + idx * 1000,
          locationName: customLocation || `${currentTrip.destination} スポット`,
          coordinates: { lat: 35.0, lng: 135.76 },
          contributor: currentUploader,
          caption: `${currentUploader.name}が撮影した写真`,
          isSelected: true,
        };
      });

      setPhotos((prev) => [...prev, ...newItems]);
    }
  };

  const handleSimulateAddSamplePhotos = (member: Contributor) => {
    const samplePhotoPool = [
      {
        url: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80',
        location: '祇園の路地',
        time: '16:10',
        caption: '風情ある格子戸の前で撮影',
      },
      {
        url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
        location: '清水寺 仁王門',
        time: '11:15',
        caption: '門の前の青空がまぶしかった！',
      },
    ];

    const randomPick = samplePhotoPool[Math.floor(Math.random() * samplePhotoPool.length)];
    const newItem: PhotoItem = {
      id: `sim-photo-${Date.now()}`,
      url: randomPick.url,
      time: randomPick.time,
      timestamp: Date.now(),
      locationName: randomPick.location,
      coordinates: { lat: 34.995, lng: 135.78 },
      contributor: member,
      caption: randomPick.caption,
      isSelected: true,
    };

    setPhotos((prev) => [...prev, newItem]);
  };

  const handleRemovePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Sort photos chronologically
  const sortedPhotos = [...photos].sort((a, b) => a.time.localeCompare(b.time));

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

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-diary hidden sm:inline">
            写真 {photos.length} 枚アップロード済み
          </span>
        </div>
      </div>

      {/* 3. 旅行メンバー機能エリア */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>旅行メンバーと共同アルバム</span>
            </div>
            <h2 className="text-xl font-bold font-title text-slate-800">
              {currentTrip.title}
            </h2>
            <p className="text-xs text-slate-500 font-diary mt-0.5">
              参加者全員が写真をアップロードできます。AIが全員の写真を撮影時間順に整理します。
            </p>
          </div>

          {/* Members Avatars & Invite Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {currentTrip.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-700 shadow-2xs"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white"
                />
                <span className="font-bold">{member.name}</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md font-medium">
                  {photos.filter((p) => p.contributor.id === member.id).length}枚
                </span>
              </div>
            ))}

            {/* Invite Button */}
            <button
              onClick={onOpenInviteModal}
              id="upload-invite-member-btn"
              className="px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200 cursor-pointer shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>メンバーを招待</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. みんなで写真を追加 (Upload Area) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold font-title text-slate-800 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <span>写真をアップロード</span>
            </h3>
            <p className="text-xs text-slate-500 font-diary mt-0.5">
              スマートフォンやデジカメで撮影した写真を選択してください（複数枚一括可能）
            </p>
          </div>

          {/* Current Uploader Switcher (for realistic group upload simulation) */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 pl-2">撮影者:</span>
            {currentTrip.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCurrentUploader(m)}
                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentUploader.id === m.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <img src={m.avatar} alt={m.name} className="w-4 h-4 rounded-full object-cover" />
                <span>{m.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Big Drag & Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const files = Array.from(e.dataTransfer.files);
              const newItems: PhotoItem[] = files.map((file, idx) => ({
                id: `drop-photo-${Date.now()}-${idx}`,
                url: URL.createObjectURL(file as Blob),
                time: `1${Math.floor(Math.random() * 8)}:${Math.floor(Math.random() * 59).toString().padStart(2, '0')}`,
                timestamp: Date.now() + idx,
                locationName: `${currentTrip.destination} スポット`,
                coordinates: { lat: 35.0, lng: 135.75 },
                contributor: currentUploader,
                caption: `${currentUploader.name}が追加した写真`,
                isSelected: true,
              }));
              setPhotos((prev) => [...prev, ...newItems]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/20'
              : 'border-sky-200 bg-sky-50/40 hover:bg-sky-50/80 hover:border-blue-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/30">
            <Upload className="w-8 h-8 stroke-[2.2]" />
          </div>

          <h4 className="text-base font-bold text-slate-800 mb-1">
            クリックまたは写真をドラッグ＆ドロップして追加
          </h4>
          <p className="text-xs text-slate-500 font-diary">
            JPEG, PNG, HEIC形式に対応 · 位置情報・撮影日時は自動解析されます
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-bold text-blue-700 border border-blue-200 shadow-2xs">
              <img src={currentUploader.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
              <span>「{currentUploader.name}」として追加中</span>
            </span>
          </div>
        </div>

        {/* Quick Simulation helper buttons */}
        <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-diary">
            💡 他のメンバーからの写真追加をテスト:
          </span>
          <div className="flex items-center gap-2">
            {currentTrip.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSimulateAddSamplePhotos(m)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{m.name.split(' ')[0]}の写真を追加</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Uploaded Photos Grid (With Photographer, Time, Location attribution) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold font-title text-slate-800">
              アップロードされた写真 ({sortedPhotos.length}枚)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-diary">
            AIが撮影時間順に自動整列
          </span>
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
                {/* Photo Image */}
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  <img
                    src={photo.url}
                    alt={photo.locationName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Top Badges: Time & Delete */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/65 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 text-sky-300" />
                    <span>{photo.time}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleRemovePhoto(photo.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                    title="写真を削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Contributor Attribution Overlay Tag (撮影者) */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                    <img
                      src={photo.contributor.avatar}
                      alt={photo.contributor.name}
                      className="w-4 h-4 rounded-full object-cover ring-1 ring-blue-400"
                    />
                    <span className="text-[11px]">撮影: {photo.contributor.name}</span>
                  </div>
                </div>

                {/* Photo metadata footer (Location & Caption) */}
                <div className="p-3.5 bg-gradient-to-b from-white to-sky-50/30">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{photo.locationName}</span>
                  </div>
                  {photo.caption && (
                    <p className="text-[11px] text-slate-500 font-diary line-clamp-1">
                      {photo.caption}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. 写真日記を作るCTA (Big Sticky Floating Bottom Action) */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-sky-200 shadow-xl shadow-blue-500/15 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
            <span>AI JOURNAL GENERATOR</span>
          </div>
          <h4 className="text-base sm:text-lg font-bold font-title text-slate-900">
            {photos.length}枚の写真からAI写真日記を生成します
          </h4>
          <p className="text-xs text-slate-500 font-diary">
            撮影時間・場所・みんなの写真をもとに、時系列の美しい思い出日記を作成します
          </p>
        </div>

        <button
          onClick={() => onGenerateDiary(sortedPhotos)}
          disabled={photos.length === 0}
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
