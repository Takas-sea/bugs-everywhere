import React, { useState } from 'react';
import { Sparkles, Calendar, MapPin, Users, Plus, ArrowRight, ArrowLeft, Check, Compass, Image as ImageIcon } from 'lucide-react';
import { Trip, Contributor } from '../types';
import { SAMPLE_MEMBERS } from '../data/mockTrips';

interface CreateTripScreenProps {
  onCreateTrip: (newTrip: Trip) => void;
  onCancel: () => void;
}

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80', // 京都
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', // 沖縄海
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80', // 金沢・日本庭園
  'https://images.unsplash.com/photo-1590559899731-a3f30bc9d963?auto=format&fit=crop&w=1200&q=80', // 大阪
  'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80', // 清水寺
];

export const CreateTripScreen: React.FC<CreateTripScreenProps> = ({
  onCreateTrip,
  onCancel,
}) => {
  const [title, setTitle] = useState('京都旅行 2026');
  const [date, setDate] = useState('2026-08-28');
  const [destination, setDestination] = useState('京都（東山・祇園・伏見）');
  const [selectedMembers, setSelectedMembers] = useState<Contributor[]>(SAMPLE_MEMBERS);
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedCover, setSelectedCover] = useState(PRESET_COVERS[0]);

  const handleToggleMember = (member: Contributor) => {
    if (selectedMembers.some((m) => m.id === member.id)) {
      if (selectedMembers.length <= 1) return; // keep at least 1
      setSelectedMembers((prev) => prev.filter((m) => m.id !== member.id));
    } else {
      setSelectedMembers((prev) => [...prev, member]);
    }
  };

  const handleAddNewMember = () => {
    if (!newMemberName.trim()) return;
    const newM: Contributor = {
      id: `user_custom_${Date.now()}`,
      name: newMemberName.trim(),
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80`,
      role: 'メンバー',
      photoCount: 0,
    };
    setSelectedMembers((prev) => [...prev, newM]);
    setNewMemberName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const formattedDate = date
      ? `${date.split('-')[0]}年${Number(date.split('-')[1])}月${Number(date.split('-')[2])}日`
      : '2026年8月28日';

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      title: title.trim(),
      subtitle: `${selectedMembers.map((m) => m.name.split(' ')[0]).join('・')}のみんなで集めた写真アルバム`,
      date: formattedDate,
      destination: destination.trim() || '旅行先',
      coverImage: selectedCover,
      members: selectedMembers,
      spotsCount: 0,
      photosCount: 0,
      weather: '快晴 ☀️ 28℃',
      spots: [],
      entries: [],
      tags: [destination.split('（')[0].trim() || '旅行', `${selectedMembers.length}人旅`, '写真日記'],
      isSample: false,
    };

    onCreateTrip(newTrip);
  };

  return (
    <div className="pb-28 md:pb-16 max-w-3xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
      {/* Header Back Button */}
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>キャンセルして戻る</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 relative overflow-hidden">
        {/* Decorative subtle blue aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-sky-100/60 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold mb-3">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>新しい旅行アルバムを作成</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-title text-slate-800 mb-2">
            新しい旅の思い出を作る
          </h1>
          <p className="text-sm text-slate-500 font-diary leading-relaxed mb-6 max-w-lg">
            旅行の基本情報を入力して、一緒に旅行するメンバーを招待しましょう。<br />
            作成後にみんなの写真をアップロードして1つの写真日記を生成します。
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. 旅行タイトル */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                旅行タイトル <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 京都旅行 2026、北海道ドライブ旅"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-diary"
              />
            </div>

            {/* 2. 旅行の日付 & 旅行先 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>旅行の日付</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  <span>旅行先・エリア</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="例: 京都（東山・祇園）、沖縄本島"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-diary"
                />
              </div>
            </div>

            {/* 3. 一緒に旅行するメンバー */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>一緒に旅行するメンバー ({selectedMembers.length}人選択中)</span>
                </label>
                <span className="text-[11px] text-slate-400 font-diary">
                  グループ全員が写真を追加できます
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {SAMPLE_MEMBERS.map((member) => {
                  const isSelected = selectedMembers.some((m) => m.id === member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleMember(member)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/20 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60 hover:opacity-90'
                      }`}
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold block truncate">{member.name}</span>
                        <span className="text-[10px] text-slate-400 font-diary">{member.role || 'メンバー'}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Add custom member input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewMember();
                    }
                  }}
                  placeholder="メンバーの名前を追加 (例: 高橋さん)"
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewMember}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>
            </div>

            {/* 4. カバー写真の選択 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>アルバムのカバー写真イメージ</span>
              </label>
              <div className="grid grid-cols-5 gap-2.5">
                {PRESET_COVERS.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedCover(url)}
                    className={`relative aspect-4/3 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedCover === url
                        ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105 z-10'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Cover ${i}`} className="w-full h-full object-cover" />
                    {selectedCover === url && (
                      <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                戻る
              </button>
              <button
                type="submit"
                id="submit-create-trip-btn"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 text-white font-bold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>旅行を作成して写真を追加へ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
