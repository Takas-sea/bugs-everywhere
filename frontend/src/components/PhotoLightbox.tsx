import React from 'react';
import { X, MapPin, Sparkles, Download, Heart, Camera } from 'lucide-react';

interface PhotoLightboxProps {
  photoUrl: string | null;
  caption?: string;
  spotName?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photoUrl,
  caption,
  spotName,
  onClose,
}) => {
  if (!photoUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Large Image */}
        <div className="relative max-h-[65vh] overflow-hidden bg-black flex items-center justify-center">
          <img
            src={photoUrl}
            alt={spotName || 'Travel Photo'}
            className="w-full h-full max-h-[65vh] object-contain"
          />
        </div>

        {/* Metadata & Caption */}
        <div className="p-5 bg-slate-900 text-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            {spotName && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>{spotName}</span>
              </div>
            )}
            <span className="text-[10px] text-slate-400 font-diary flex items-center gap-1">
              <Camera className="w-3 h-3 text-blue-400" />
              AI写真日記 収録写真
            </span>
          </div>

          {caption && (
            <p className="text-xs sm:text-sm text-slate-300 font-diary leading-relaxed whitespace-pre-line">
              {caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
