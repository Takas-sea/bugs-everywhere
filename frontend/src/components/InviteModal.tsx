import React, { useState } from 'react';
import { X, Copy, Check, Users, Sparkles, Send, Share2 } from 'lucide-react';
import { Contributor } from '../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripTitle: string;
  members: Contributor[];
  /** 共有する日記のID。無いときはURLを出しません */
  tripId?: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  tripTitle,
  members,
  tripId,
}) => {
  const [copied, setCopied] = useState(false);
  /**
   * この日記を開くURL。共有された人が開くと、その日記が直接開きます。
   * まだ旅行が作られていない（写真を1枚も上げていない）ときは空です。
   */
  const inviteUrl = tripId
    ? `${window.location.origin}${window.location.pathname}?trip=${tripId}`
    : '';

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!inviteUrl) return;
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

        {/* 招待リンク */}
        <>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                招待URL（LINEやメッセージで送信）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl || '写真を1枚アップロードすると、共有URLが作られます'}
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  disabled={!inviteUrl}
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
        </>

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
