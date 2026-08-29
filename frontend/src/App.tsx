import React, { useState, useEffect, useCallback } from 'react';
import { ActiveScreen, Trip } from './types.ts';
import { ALL_PAST_TRIPS, MOCK_KYOTO_TRIP, SAMPLE_MEMBERS } from './data/mockTrips';
import { loadTrip, loadMyTrips } from './lib/adapters.ts';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { CreateTripScreen } from './components/CreateTripScreen';
import { UploadScreen } from './components/UploadScreen.tsx';
import { GeneratingScreen } from './components/GeneratingScreen.tsx';
import { DiaryDetailScreen } from './components/DiaryDetailScreen';
import { MemoriesListScreen } from './components/MemoriesListScreen';
import { InviteModal } from './components/InviteModal';
import { PhotoLightbox } from './components/PhotoLightbox';

/** Supabase 上の本物の旅行かどうか（モックのIDと区別する） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [pastTrips, setPastTrips] = useState<Trip[]>(ALL_PAST_TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip>(MOCK_KYOTO_TRIP);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [currentTripDraft, setCurrentTripDraft] = useState<Trip | null>(null);

  /** Supabase 上の本物の trip_id。UploadScreen から受け取ります */
  const [realTripId, setRealTripId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    caption?: string;
    spotName?: string;
  } | null>(null);

  // Flow: Create Trip -> Upload Photos -> Generating -> Diary
  const handleStartCreateTrip = () => {
    setActiveScreen('create_trip');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreatedTrip = (newTrip: Trip) => {
    setCurrentTripDraft(newTrip);
    setSelectedTrip(newTrip);
    setActiveScreen('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** UploadScreen で写真を上げてコマ割りまで済んだ状態で呼ばれます */
  const handleStartGenerating = (tripId: string) => {
    setRealTripId(tripId);
    setLoadError(null);
    setActiveScreen('generating');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 生成が終わったら、DBから実データを読んで日記を組み立てます。
   * 文章も絵も座標もすべて Supabase から来るので、ここで作るものはありません。
   */
  const handleFinishGenerating = async () => {
    if (!realTripId) {
      setActiveScreen('diary');
      return;
    }
    try {
      const trip = await loadTrip(realTripId);
      setPastTrips((prev) => [trip, ...prev.filter((t) => t.id !== trip.id)]);
      setSelectedTrip(trip);
      setCurrentTripDraft(null);
      setActiveScreen('diary');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setLoadError(String(e));
    }
  };

  /**
   * 日記を開くたびにDBから読み直します。
   * 生成は開いたあとに終わることがあるので、これが無いと
   * 文章や絵ができても画面が古いままになります。
   */
  const handleSelectTrip = async (trip: Trip) => {
    setSelectedTrip(trip);
    setActiveScreen('diary');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!UUID_RE.test(trip.id)) return;
    try {
      setSelectedTrip(await loadTrip(trip.id));
    } catch (e) {
      setLoadError(String(e));
    }
  };

  /** いま開いている日記を読み直す（生成の進み具合を反映するため） */
  const refreshCurrentTrip = useCallback(async () => {
    if (!selectedTrip || !UUID_RE.test(selectedTrip.id)) return;
    try {
      const fresh = await loadTrip(selectedTrip.id);
      setSelectedTrip(fresh);
      setPastTrips((prev) => [fresh, ...prev.filter((t) => t.id !== fresh.id)]);
    } catch (e) {
      setLoadError(String(e));
    }
  }, [selectedTrip]);

  // この端末で作った旅行を起動時に読み込む
  useEffect(() => {
    loadMyTrips()
      .then((trips) => {
        if (trips.length === 0) return;
        setPastTrips((prev) => [
          ...trips,
          ...prev.filter((t) => !trips.some((x) => x.id === t.id)),
        ]);
      })
      .catch(() => undefined);
  }, []);

  const handleOpenLightbox = (url: string, caption?: string, spotName?: string) => {
    setLightboxData({ url, caption, spotName });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-diary">
      <Navigation
        activeScreen={activeScreen}
        setActiveScreen={(screen: ActiveScreen) => {
          setActiveScreen(screen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNewTripClick={handleStartCreateTrip}
      />

      <main className="flex-1 md:pl-64 transition-all duration-200">
        {loadError && (
          <div className="mx-4 mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700">
            日記の読み込みに失敗しました: {loadError}
          </div>
        )}

        {activeScreen === 'home' && (
          <HomeScreen
            pastTrips={pastTrips}
            onSelectTrip={handleSelectTrip}
            onNewTripClick={handleStartCreateTrip}
            onViewAllMemories={() => setActiveScreen('memories')}
          />
        )}

        {activeScreen === 'create_trip' && (
          <CreateTripScreen
            onCreateTrip={handleCreatedTrip}
            onCancel={() => setActiveScreen('home')}
          />
        )}

        {activeScreen === 'upload' && (
          <UploadScreen
            currentTrip={currentTripDraft || selectedTrip}
            onGenerateDiary={handleStartGenerating}
            onBack={() => setActiveScreen(currentTripDraft ? 'create_trip' : 'diary')}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
          />
        )}

        {activeScreen === 'generating' && (
          <GeneratingScreen tripId={realTripId} onComplete={handleFinishGenerating} />
        )}

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
            onBack={() => setActiveScreen('home')}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onSelectPhotoLightbox={handleOpenLightbox}
            onUploadMorePhotos={() => {
              setCurrentTripDraft(selectedTrip);
              setActiveScreen('upload');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            />
          </>
        )}

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
