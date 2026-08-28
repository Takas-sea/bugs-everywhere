import React, { useState } from 'react';
import { X, Copy, Check, QrCode, Users, Sparkles, Send, Share2 } from 'lucide-react';
import { Contributor } from '../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripTitle: string;
  members: Contributor[];
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  tripTitle,
  members,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'qr'>('link');
  const inviteCode = 'TABI-KYOTO-2026';
  const inviteUrl = `https://tabi-memory.app/join/${inviteCode}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-sky-100 relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Icon */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-sky-100">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold font-title text-slate-800">
            旅行メンバーを招待
          </h3>
          <p className="text-xs text-slate-500 font-diary mt-1">
            「{tripTitle}」の共同写真アルバムに友達を招待します
          </p>
        </div>

        {/* Switch tab for Link vs QR */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'link' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            招待リンク
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'qr' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            QRコード
          </button>
        </div>

        {/* Current Members Preview */}
        <div className="mb-5">
          <label className="text-xs font-bold text-slate-700 block mb-2">
            参加中のメンバー ({members.length}人)
          </label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50/50 border border-sky-100">
                <div className="flex items-center gap-2.5">
                  <img src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-blue-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{m.name}</span>
                    <span className="text-[10px] text-blue-700 font-diary">{m.role || 'メンバー'}</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  参加中
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab 1: Invite Link */}
        {activeTab === 'link' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                招待URL（LINEやメッセージで送信）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  id="copy-invite-link-btn"
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 font-diary leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-blue-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>全員の写真を集めて1つの写真日記に</span>
              </div>
              招待された友達がアップロードした写真も自動で時系列に統合され、メンバー全員の思い出が1冊の写真日記にまとまります。
            </div>
          </div>
        ) : (
          /* Tab 2: QR Code view */
          <div className="text-center py-2 space-y-3">
            <div className="w-44 h-44 mx-auto p-3 bg-white rounded-2xl border-2 border-dashed border-sky-300 flex flex-col items-center justify-center shadow-inner">
              {/* Styled mock QR grid */}
              <div className="w-full h-full bg-slate-900 rounded-lg p-2 flex flex-col justify-between items-center text-white">
                <div className="grid grid-cols-5 gap-1.5 w-full h-full p-2 bg-white rounded">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`rounded-xs ${i % 2 === 0 || i % 7 === 0 || i === 0 || i === 4 || i === 20 || i === 24 ? 'bg-slate-900' : 'bg-transparent'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-diary">
              近くにいる友達のスマホカメラでスキャンしてもらえます
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
        >
          閉じる
        </button>
      </div>
    </div>
  );
};
