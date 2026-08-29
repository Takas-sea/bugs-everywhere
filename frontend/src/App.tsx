import React, { useCallback, useEffect, useState } from 'react';

import { ActiveScreen, Trip } from './types';

import {
  ALL_PAST_TRIPS,
  MOCK_KYOTO_TRIP,
  SAMPLE_MEMBERS,
} from './data/mockTrips';

import { loadTrip, loadMyTrips } from './lib/adapters';

import { HomeScreen } from './components/HomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { UploadScreen } from './components/UploadScreen';
import { GeneratingScreen } from './components/GeneratingScreen';
import { DiaryDetailScreen } from './components/DiaryDetailScreen';
import { MemoriesListScreen } from './components/MemoriesListScreen';
import { InviteModal } from './components/InviteModal';
import { PhotoLightbox } from './components/PhotoLightbox';

/** Supabase 上の本物の旅行かどうか（モックのIDと区別する） */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function App() {
  const [activeScreen, setActiveScreen] =
    useState<ActiveScreen>('home');

  const [pastTrips, setPastTrips] =
    useState<Trip[]>(ALL_PAST_TRIPS);

  const [selectedTrip, setSelectedTrip] =
    useState<Trip>(MOCK_KYOTO_TRIP);

  const [isInviteModalOpen, setIsInviteModalOpen] =
    useState(false);

  const [currentTripDraft, setCurrentTripDraft] =
    useState<Trip | null>(null);

  /**
   * Supabase 上の本物の trip_id。
   * UploadScreen が写真を上げてコマ割りまで済ませたときに渡してきます。
   */
  const [realTripId, setRealTripId] =
    useState<string | null>(null);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    caption?: string;
    spotName?: string;
  } | null>(null);

  /*
   * UploadScreen の「戻る」で
   * どの画面へ戻るかを管理
   *
   * 新規作成 → home
   * 既存の日記から写真追加 → diary
   */
  const [uploadBackScreen, setUploadBackScreen] =
    useState<'home' | 'diary'>('home');

  // =========================
  // Login
  // =========================

  const savedEmail =
    localStorage.getItem('tabi-memory-email') || '';

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [userEmail, setUserEmail] = useState(savedEmail);

  const handleLogin = (email: string) => {
    localStorage.setItem('tabi-memory-email', email);

    setUserEmail(email);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('tabi-memory-email');

    setUserEmail('');
    setIsLoggedIn(false);
    setActiveScreen('home');
  };

  const userName = userEmail
    ? userEmail.split('@')[0]
    : 'ユーザー';

  // =========================
  // Browser Back
  // =========================

  useEffect(() => {
    if (!window.history.state?.screen) {
      window.history.replaceState(
        { screen: 'home' },
        '',
        window.location.href
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const screen = event.state?.screen as
        | ActiveScreen
        | undefined;

      setActiveScreen(screen || 'home');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState
      );
    };
  }, []);

  // =========================
  // この端末で作った旅行を読み込む
  // =========================

  useEffect(() => {
    loadMyTrips()
      .then((trips) => {
        if (trips.length === 0) return;

        setPastTrips((prev) => [
          ...trips,
          ...prev.filter(
            (t) => !trips.some((x) => x.id === t.id)
          ),
        ]);
      })
      .catch((e) => {
        console.error('[loadMyTrips]', e);
      });
  }, []);

  // =========================
  // Screen Change
  // =========================

  const changeScreen = (screen: ActiveScreen) => {
    setActiveScreen(screen);

    window.history.pushState(
      { screen },
      '',
      window.location.href
    );

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================
  // 新しい旅の思い出を作る
  // home → upload
  // =========================

  const handleStartCreateTrip = () => {
    setUploadBackScreen('home');

    // 新しい旅として扱うため、以前の編集中データをリセット
    setCurrentTripDraft(null);
    setRealTripId(null);
    setLoadError(null);

    changeScreen('upload');
  };

  // =========================
  // Upload → Generating
  // =========================

  /**
   * UploadScreen で写真を上げて、scenes / panels まで作り終えた状態で
   * 呼ばれます。渡ってくるのは Supabase 上の本物の trip_id です。
   */
  const handleStartGenerating = (tripId: string) => {
    setRealTripId(tripId);
    setLoadError(null);

    changeScreen('generating');
  };

  // =========================
  // 生成完了 → 日記を組み立てる
  // =========================

  /**
   * 文章も絵も座標もすべて Supabase から来るので、
   * ここで作るものはありません。読んで並べるだけです。
   */
  const handleFinishGenerating = async () => {
    if (!realTripId) {
      changeScreen('diary');
      return;
    }

    try {
      const trip = await loadTrip(realTripId);

      setPastTrips((prev) => [
        trip,
        ...prev.filter((t) => t.id !== trip.id),
      ]);

      setSelectedTrip(trip);
      setCurrentTripDraft(null);
      changeScreen('diary');
    } catch (e) {
      console.error('[loadTrip]', e);
      setLoadError(String(e));
      changeScreen('diary');
    }
  };

  // =========================
  // Select Trip
  // =========================

  /**
   * 日記を開くたびにDBから読み直します。
   * 生成は画面を開いたあとに終わることがあるので、
   * これが無いと文章や絵ができても画面が古いままになります。
   */
  const handleSelectTrip = async (trip: Trip) => {
    setSelectedTrip(trip);
    changeScreen('diary');

    if (!UUID_RE.test(trip.id)) return;

    setRealTripId(trip.id);

    try {
      setSelectedTrip(await loadTrip(trip.id));
    } catch (e) {
      console.error('[loadTrip]', e);
      setLoadError(String(e));
    }
  };

  /** いま開いている日記を読み直す（生成の進み具合を反映するため） */
  const refreshCurrentTrip = useCallback(async () => {
    if (!selectedTrip || !UUID_RE.test(selectedTrip.id)) {
      return;
    }

    try {
      const fresh = await loadTrip(selectedTrip.id);

      setSelectedTrip(fresh);

      setPastTrips((prev) => [
        fresh,
        ...prev.filter((t) => t.id !== fresh.id),
      ]);

      setLoadError(null);
    } catch (e) {
      console.error('[loadTrip]', e);
      setLoadError(String(e));
    }
  }, [selectedTrip]);

  // =========================
  // Lightbox
  // =========================

  const handleOpenLightbox = (
    url: string,
    caption?: string,
    spotName?: string
  ) => {
    setLightboxData({ url, caption, spotName });
  };

  // =========================
  // Login Screen
  // =========================

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // =========================
  // Main App
  // =========================

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-diary">
      <main className="flex-1 w-full transition-all duration-200">
        {loadError && (
          <div className="mx-4 mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">
            日記の読み込みに失敗しました: {loadError}
          </div>
        )}

        {/* ===================== Home ===================== */}

        {activeScreen === 'home' && (
          <HomeScreen
            pastTrips={pastTrips}
            onSelectTrip={handleSelectTrip}
            onNewTripClick={handleStartCreateTrip}
            onViewAllMemories={() => changeScreen('memories')}
            userName={userName}
            onLogout={handleLogout}
          />
        )}

        {/* ===================== Upload ===================== */}

        {activeScreen === 'upload' && (
          <UploadScreen
            currentTrip={currentTripDraft || selectedTrip}
            onGenerateDiary={handleStartGenerating}
            onBack={() => changeScreen(uploadBackScreen)}
            onOpenInviteModal={() =>
              setIsInviteModalOpen(true)
            }
          />
        )}

        {/* ===================== Generating ===================== */}

        {activeScreen === 'generating' && (
          <GeneratingScreen
            tripId={realTripId}
            onComplete={handleFinishGenerating}
          />
        )}

        {/* ===================== Diary ===================== */}

        {activeScreen === 'diary' && (
          <>
            <div className="px-4 pt-4">
              <button
                onClick={refreshCurrentTrip}
                className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                最新の状態に更新
              </button>
            </div>

            <DiaryDetailScreen
              trip={selectedTrip}
              onBack={() => changeScreen('home')}
              onOpenInviteModal={() =>
                setIsInviteModalOpen(true)
              }
              onSelectPhotoLightbox={handleOpenLightbox}
              onUploadMorePhotos={() => {
                setCurrentTripDraft(selectedTrip);
                setUploadBackScreen('diary');
                changeScreen('upload');
              }}
            />
          </>
        )}

        {/* ===================== Memories ===================== */}

        {activeScreen === 'memories' && (
          <MemoriesListScreen
            trips={pastTrips}
            onSelectTrip={handleSelectTrip}
            onNewTripClick={handleStartCreateTrip}
          />
        )}

      </main>

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        tripTitle={selectedTrip?.title || '旅の記録'}
        members={selectedTrip?.members || SAMPLE_MEMBERS}
      />

      <PhotoLightbox
        photoUrl={lightboxData?.url || null}
        caption={lightboxData?.caption}
        spotName={lightboxData?.spotName}
        onClose={() => setLightboxData(null)}
      />
    </div>
  );
}
