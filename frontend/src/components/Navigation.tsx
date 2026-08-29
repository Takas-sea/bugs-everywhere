import React from 'react';
import {
  Home,
  Sparkles,
  Camera,
} from 'lucide-react';

import { ActiveScreen } from '../types';

interface NavigationProps {
  activeScreen: ActiveScreen;
  setActiveScreen: (screen: ActiveScreen) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeScreen,
  setActiveScreen,
}) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 bg-white/95 backdrop-blur-md border-r border-sky-100/80 z-40 p-5 shadow-[4px_0_24px_rgba(2,132,199,0.03)]">

        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveScreen('home')}
          className="cursor-pointer flex items-center gap-3 px-2 py-3 mb-6 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-teal-400 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <Camera className="w-5 h-5 text-white" />
          </div>

          <div>
            <h1 className="text-xl font-bold font-title tracking-tight text-slate-800 flex items-center gap-1.5">
              TABI MEMORY
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            </h1>

            <p className="text-[11px] text-sky-700/80 font-diary font-medium">
              みんなの写真から旅日記へ
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">

          {/* ホーム */}
          <button
            onClick={() => setActiveScreen('home')}
            id="nav-desktop-home"
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeScreen === 'home'
                ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                : 'text-slate-600 hover:bg-sky-50/50 hover:text-slate-900'
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                activeScreen === 'home'
                  ? 'text-blue-600'
                  : 'text-slate-400'
              }`}
            />

            <span>ホーム</span>
          </button>

        </nav>

        {/* Bottom Journal Status Info */}
        <div className="mt-auto pt-4 border-t border-sky-100">
          <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-100">
            <div className="flex items-center gap-2 text-sky-800 font-bold text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>共同アルバム対応</span>
            </div>

            <p className="text-[11px] text-sky-700 leading-relaxed font-diary">
              参加者全員の写真を時系列に統合してAI写真日記を生成します
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-sky-100 z-50 px-4 py-2 shadow-[0_-4px_20px_rgba(2,132,199,0.06)]">
        <div className="flex items-center justify-around max-w-md mx-auto">

          {/* ホーム */}
          <button
            onClick={() => setActiveScreen('home')}
            id="mobile-nav-home"
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 transition-colors cursor-pointer ${
              activeScreen === 'home'
                ? 'text-blue-600 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">ホーム</span>
          </button>

        </div>
      </nav>
    </>
  );
};