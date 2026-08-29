import React, { useEffect, useState } from 'react';

import {
  ActiveScreen,
  Trip,
  PhotoItem,
  DiaryEntry,
  MapSpot,
} from './types';

import {
  ALL_PAST_TRIPS,
  MOCK_KYOTO_TRIP,
  SAMPLE_MEMBERS,
} from './data/mockTrips';

import { HomeScreen } from './components/HomeScreen';
import { LoginScreen } from './components/LoginScreen';
// import { CreateTripScreen } from './components/CreateTripScreen';
import { UploadScreen } from './components/UploadScreen';
import { GeneratingScreen } from './components/GeneratingScreen';
import { DiaryDetailScreen } from './components/DiaryDetailScreen';
import { MemoriesListScreen } from './components/MemoriesListScreen';
import { OverallMapScreen } from './components/OverallMapScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { InviteModal } from './components/InviteModal';
import { PhotoLightbox } from './components/PhotoLightbox';

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

  const [
    uploadedPhotosForTrip,
    setUploadedPhotosForTrip,
  ] = useState<PhotoItem[]>([]);

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    caption?: string;
    spotName?: string;
  } | null>(null);

  // Login state
  const savedEmail =
    localStorage.getItem('tabi-memory-email') || '';

const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] =
    useState(savedEmail);

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

  useEffect(() => {
    if (!window.history.state?.screen) {
      window.history.replaceState(
        { screen: 'home' },
        '',
        window.location.href
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const screen =
        event.state?.screen as ActiveScreen | undefined;

      setActiveScreen(screen || 'home');

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const changeScreen = (screen: ActiveScreen) => {
    setActiveScreen(screen);

    // 同じURLのまま履歴だけ追加する。
    // これによりブラウザ左上の「←」で前の画面に戻れる。
    window.history.pushState(
      { screen },
      '',
      window.location.href
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // 1. Flow:
  // Create Trip -> Upload Photos -> Generating AI Diary -> Diary Detail

  const handleStartCreateTrip = () => {
    changeScreen('create_trip');
  };

  const handleCreatedTrip = (newTrip: Trip) => {
    setCurrentTripDraft(newTrip);
    setSelectedTrip(newTrip);
    changeScreen('upload');
  };

  const handleStartGenerating = (photos: PhotoItem[]) => {
    setUploadedPhotosForTrip(photos);
    changeScreen('generating');
  };

  const handleFinishGenerating = () => {
    const tripToFinalize =
      currentTripDraft || selectedTrip;

    if (
      uploadedPhotosForTrip &&
      uploadedPhotosForTrip.length > 0
    ) {
      const sorted = [...uploadedPhotosForTrip].sort(
        (a, b) => a.time.localeCompare(b.time)
      );

      const generatedEntries: DiaryEntry[] =
        sorted.map((photo, index) => {
          const spotName =
            photo.locationName ||
            `${tripToFinalize.destination} スポット ${
              index + 1
            }`;

          const uploaderName =
            photo.contributor.name;

          const aiTextSnippets = [
            `${uploaderName}が撮影した一枚。${spotName}に到着して、みんなで旅の始まりに胸を躍らせました。`,

            `${spotName}での思い出。${uploaderName}がカメラを構えて素敵なアングルで記録。その場の楽しそうな声が聞こえてくるようです。`,

            `ひと休みに立ち寄った${spotName}。美味しいものを味わいながら、今日巡った場所の感想で盛り上がりました。`,

            `${spotName}にて。美しい景色をバックにみんなでたくさん写真を撮り合いました。`,

            `夕暮れの${spotName}。一日の終わりを締めくくる忘れられない時間になりました。`,
          ];

          const aiDiaryText =
            aiTextSnippets[
              index % aiTextSnippets.length
            ] +
            (photo.caption
              ? `（メモ: ${photo.caption}）`
              : '');

          return {
            id: `entry-gen-${Date.now()}-${index}`,
            photoId: photo.id,
            time: photo.time,
            location: spotName,
            title: `${spotName}でのひとコマ`,
            aiDiaryText,
            photoUrl: photo.url,
            contributor: photo.contributor,
            weather: '晴れ ☀️',
            feeling: 'ワクワク',
            cameraInfo: 'スマートフォン撮影',

            qaPrompt:
              `${spotName}で特に印象に残ったことは何ですか？`,

            userAnswer: undefined,
            isAnswered: false,
          };
        });

      const uniqueLocations = Array.from(
        new Set(
          sorted.map(
            (p) =>
              p.locationName ||
              tripToFinalize.destination
          )
        )
      );

      const generatedSpots: MapSpot[] =
        uniqueLocations.map((loc, idx) => {
          const matchedPhoto =
            sorted.find(
              (p) => p.locationName === loc
            ) || sorted[0];

          return {
            id: `spot-gen-${idx + 1}`,
            stepNumber: idx + 1,
            name: loc,

            time:
              matchedPhoto?.time ||
              '12:00',

            lat:
              35.003 +
              idx * 0.008 -
              0.02,

            lng:
              135.77 +
              idx * 0.006 -
              0.015,

            photoUrl:
              matchedPhoto?.url ||
              tripToFinalize.coverImage,

            diarySnippet:
              `${loc}をみんなで散策`,

            contributorName:
              matchedPhoto?.contributor.name ||
              'メンバー',
          };
        });

      const finalizedTrip: Trip = {
        ...tripToFinalize,

        coverImage:
          sorted[0]?.url ||
          tripToFinalize.coverImage,

        photosCount:
          sorted.length,

        spotsCount:
          generatedSpots.length,

        spots:
          generatedSpots,

        entries:
          generatedEntries,

        summaryStats: {
          visitedPlacesCount:
            generatedSpots.length,

          travelDuration:
            `${
              sorted[0]?.time ||
              '10:00'
            } 〜 ${
              sorted[
                sorted.length - 1
              ]?.time || '18:00'
            }`,

          totalPhotosCount:
            sorted.length,

          membersCount:
            tripToFinalize.members.length,

          topPhotoSpot:
            generatedSpots[0]?.name ||
            tripToFinalize.destination,

          topPhotoSpotCount:
            sorted.length,

          bestShotUrl:
            sorted[0]?.url ||
            tripToFinalize.coverImage,

          bestShotTitle:
            `${tripToFinalize.title}のベストショット`,

          bestShotDescription:
            '参加者みんなの写真から選ばれた、思い出の象徴的な一枚です。',

          bestShotPhotographer:
            sorted[0]?.contributor.name ||
            'メンバー',
        },
      };

      setPastTrips((prev) => [
        finalizedTrip,
        ...prev.filter(
          (t) =>
            t.id !==
            finalizedTrip.id
        ),
      ]);

      setSelectedTrip(
        finalizedTrip
      );

      setCurrentTripDraft(
        null
      );
    } else {
      setSelectedTrip(
        tripToFinalize
      );
    }

    changeScreen('diary');
  };

  const handleSelectTrip = (
    trip: Trip
  ) => {
    setSelectedTrip(trip);
    changeScreen('diary');
  };

  const handleOpenLightbox = (
    url: string,
    caption?: string,
    spotName?: string
  ) => {
    setLightboxData({
      url,
      caption,
      spotName,
    });
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-diary">

      {/* Main Content Area */}
      <main className="flex-1 w-full transition-all duration-200">

        {/* Home */}
        {activeScreen === 'home' && (
          <HomeScreen
            pastTrips={pastTrips}
            onSelectTrip={handleSelectTrip}
            onNewTripClick={handleStartCreateTrip}
            onViewAllMemories={() =>
              changeScreen('memories')
            }
            onProfileClick={() =>
              changeScreen('profile')
            }
            userName={userName}
            onLogout={handleLogout}
          />
        )}

        {/* Create Trip */}
        {/*
        {activeScreen === 'create_trip' && (
          <CreateTripScreen
            onCreateTrip={handleCreatedTrip}
            onCancel={() =>
              changeScreen('home')
            }
          />
        )}
        */}

        {/* Upload */}
        {activeScreen === 'upload' && (
          <UploadScreen
            currentTrip={
              currentTripDraft ||
              selectedTrip
            }
            onGenerateDiary={
              handleStartGenerating
            }
            onBack={() =>
              changeScreen(
                currentTripDraft
                  ? 'create_trip'
                  : 'diary'
              )
            }
            onOpenInviteModal={() =>
              setIsInviteModalOpen(true)
            }
          />
        )}

        {/* Generating */}
        {activeScreen === 'generating' && (
          <GeneratingScreen
            onComplete={
              handleFinishGenerating
            }
          />
        )}

        {/* Diary */}
        {activeScreen === 'diary' && (
          <DiaryDetailScreen
            trip={selectedTrip}
            onBack={() =>
              changeScreen('home')
            }
            onOpenInviteModal={() =>
              setIsInviteModalOpen(true)
            }
            onSelectPhotoLightbox={
              handleOpenLightbox
            }
            onUploadMorePhotos={() => {
              setCurrentTripDraft(
                selectedTrip
              );

              changeScreen('upload');
            }}
          />
        )}

        {/* Memories */}
        {activeScreen === 'memories' && (
          <MemoriesListScreen
            trips={pastTrips}
            onSelectTrip={
              handleSelectTrip
            }
            onNewTripClick={
              handleStartCreateTrip
            }
          />
        )}

        {/* Map */}
        {activeScreen === 'map' && (
          <OverallMapScreen
            trips={pastTrips}
            onSelectTrip={
              handleSelectTrip
            }
          />
        )}

        {/* Profile */}
        {activeScreen === 'profile' && (
          <ProfileScreen />
        )}

      </main>

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() =>
          setIsInviteModalOpen(false)
        }
        tripTitle={
          selectedTrip?.title ||
          '京都1日旅行'
        }
        members={
          selectedTrip?.members ||
          SAMPLE_MEMBERS
        }
      />

      {/* Photo Zoom Lightbox */}
      <PhotoLightbox
        photoUrl={
          lightboxData?.url ||
          null
        }
        caption={
          lightboxData?.caption
        }
        spotName={
          lightboxData?.spotName
        }
        onClose={() =>
          setLightboxData(null)
        }
      />

    </div>
  );
}