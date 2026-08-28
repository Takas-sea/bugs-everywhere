import React, { useState, useEffect } from 'react';
import { Sparkles, Camera, MapPin, Compass, Check, ArrowRight, BookOpen, Clock, Users, Image as ImageIcon } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GeneratingScreenProps {
  onComplete: () => void;
}

const GENERATION_STEPS = [
  {
    icon: ImageIcon,
    message: '写真を読み込んでいます',
    detail: 'アップロードされた写真のメタデータを解析中…',
    progress: 20,
  },
  {
    icon: Clock,
    message: '撮影時間を整理しています',
    detail: '10:05 京都駅 〜 19:20 伏見稲荷大社 の時系列タイムラインを構築',
    progress: 42,
  },
  {
    icon: MapPin,
    message: '訪れた場所を整理しています',
    detail: '京都駅 → 清水寺 → 祇園辻利 → 八坂神社 → 祇園 → 伏見稲荷大社',
    progress: 65,
  },
  {
    icon: Camera,
    message: '写真の内容を分析しています',
    detail: '山下さん・田中さん・佐藤さんが撮影した各スポットの情景を認識中',
    progress: 85,
  },
  {
    icon: BookOpen,
    message: 'みんなの思い出を1つの日記にしています',
    detail: '写真とエピソードを紡ぎ、時系列の写真日記を仕上げています…',
    progress: 100,
  },
];

export const GeneratingScreen: React.FC<GeneratingScreenProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(20);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < GENERATION_STEPS.length - 1) {
          const nextIndex = prev + 1;
          setProgress(GENERATION_STEPS[nextIndex].progress);
          return nextIndex;
        } else {
          clearInterval(stepInterval);
          setIsDone(true);
          // Trigger celebratory blue-sky confetti
          try {
            confetti({
              particleCount: 55,
              spread: 65,
              origin: { y: 0.6 },
              colors: ['#2563EB', '#38BDF8', '#0D9488', '#FBBF24'],
            });
          } catch {
            // ignore if confetti fails
          }
          // Auto advance after slight delay
          const autoTimer = setTimeout(() => {
            onComplete();
          }, 1100);
          return prev;
        }
      });
    }, 1100);

    return () => {
      clearInterval(stepInterval);
    };
  }, [onComplete]);

  const currentStep = GENERATION_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 max-w-xl mx-auto text-center py-10">
      {/* Decorative Floating Animation */}
      <div className="relative mb-8">
        {/* Animated outer glowing rings */}
        <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-sky-200/50 via-blue-100/50 to-teal-100/50 flex items-center justify-center p-3 animate-spin duration-[15000ms]">
          <div className="w-full h-full rounded-full border-2 border-dashed border-sky-400/80"></div>
        </div>

        {/* Central Card with Camera / Sparkle */}
        <div className="absolute inset-0 m-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-sky-400 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">
          <div className="relative">
            <StepIcon className="w-11 h-11 animate-pulse" />
            <Sparkles className="w-5 h-5 text-sky-200 absolute -top-2 -right-2 animate-bounce" />
          </div>
        </div>
      </div>

      {/* Main Dynamic Message */}
      <div className="space-y-2 mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-blue-800 text-xs font-bold tracking-wider">
          みんなの写真から旅を振り返っています…
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold font-title text-slate-800 transition-all duration-300">
          {currentStep.message}
        </h2>
        <p className="text-sm text-slate-500 font-diary max-w-md mx-auto h-10 flex items-center justify-center">
          {currentStep.detail}
        </p>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="w-full bg-white rounded-3xl p-6 border border-sky-100 shadow-md shadow-sky-100/50 mb-6">
        <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-2">
          <span className="flex items-center gap-1.5 text-blue-600">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            写真日記を自動生成中
          </span>
          <span className="font-mono text-sm text-blue-700">{progress}%</span>
        </div>

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-teal-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 5 Step Checklist */}
        <div className="grid grid-cols-1 gap-2 mt-5 text-left text-xs">
          {GENERATION_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex || isDone;
            const isCurrent = idx === currentStepIndex && !isDone;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl transition-colors ${
                  isCompleted
                    ? 'bg-blue-50/70 text-blue-900 font-medium'
                    : isCurrent
                    ? 'bg-sky-100/70 text-blue-950 font-bold border border-sky-300/80 shadow-2xs'
                    : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                      ? 'bg-sky-500 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                </div>
                <span className="truncate">{step.message}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instant Skip / View Button */}
      <button
        onClick={onComplete}
        id="skip-generation-btn"
        className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer py-2 px-4 rounded-full hover:bg-sky-50"
      >
        <span>スキップして写真日記を見る</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
