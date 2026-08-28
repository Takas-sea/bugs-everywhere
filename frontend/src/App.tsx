import React, { useState } from 'react';
import { ActiveScreen, Trip, PhotoItem, Contributor, DiaryEntry, MapSpot } from './types';
import { ALL_PAST_TRIPS, MOCK_KYOTO_TRIP, SAMPLE_MEMBERS } from './data/mockTrips';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { CreateTripScreen } from './components/CreateTripScreen';
import { UploadScreen } from './components/UploadScreen';
import { GeneratingScreen } from './components/GeneratingScreen';
import { DiaryDetailScreen } from './components/DiaryDetailScreen';
import { MemoriesListScreen } from './components/MemoriesListScreen';
import { OverallMapScreen } from './components/OverallMapScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { InviteModal } from './components/InviteModal';
import { PhotoLightbox } from './components/PhotoLightbox';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [pastTrips, setPastTrips] = useState<Trip[]>(ALL_PAST_TRIPS);
  const [selectedTrip, setSelectedTrip] = useState<Trip>(MOCK_KYOTO_TRIP);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [currentTripDraft, setCurrentTripDraft] = useState<Trip | null>(null);
  const [uploadedPhotosForTrip, setUploadedPhotosForTrip] = useState<PhotoItem[]>([]);

  const [lightboxData, setLightboxData] = useState<{
    url: string;
    caption?: string;
    spotName?: string;
  } | null>(null);

  // 1. Flow: Create Trip -> Upload Photos -> Generating AI Diary -> Diary Detail
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

  const handleStartGenerating = (photos: PhotoItem[]) => {
    setUploadedPhotosForTrip(photos);
    setActiveScreen('generating');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinishGenerating = () => {
    const tripToFinalize = currentTripDraft || selectedTrip;
    
    // If we have custom uploaded photos, generate realistic timeline entries and spots
    if (uploadedPhotosForTrip && uploadedPhotosForTrip.length > 0) {
      // Sort photos by time
      const sorted = [...uploadedPhotosForTrip].sort((a, b) => a.time.localeCompare(b.time));
      
      // Group photos into diary entries by spot/location or in chunks
      const generatedEntries: DiaryEntry[] = sorted.map((photo, index) => {
        const spotName = photo.locationName || `${tripToFinalize.destination} スポット ${index + 1}`;
        const uploaderName = photo.contributor.name;
        
        const aiTextSnippets = [
          `${uploaderName}が撮影した一枚。${spotName}に到着して、みんなで旅の始まりに胸を躍らせました。`,
          `${spotName}での思い出。${uploaderName}がカメラを構えて素敵なアングルで記録。その場の楽しそうな声が聞こえてくるようです。`,
          `ひと休みに立ち寄った${spotName}。美味しいものを味わいながら、今日巡った場所の感想で盛り上がりました。`,
          `${spotName}にて。美しい景色をバックにみんなでたくさん写真を撮り合いました。`,
          `夕暮れの${spotName}。一日の終わりを締めくくる忘れられない時間になりました。`,
        ];
        const aiDiaryText = aiTextSnippets[index % aiTextSnippets.length] + (photo.caption ? `（メモ: ${photo.caption}）` : '');

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
          qaPrompt: `${spotName}で特に印象に残ったことは何ですか？`,
          userAnswer: undefined,
          isAnswered: false,
        };
      });

      const uniqueLocations = Array.from(new Set(sorted.map((p) => p.locationName || tripToFinalize.destination)));
      const generatedSpots: MapSpot[] = uniqueLocations.map((loc, idx) => {
        const matchedPhoto = sorted.find((p) => p.locationName === loc) || sorted[0];
        return {
          id: `spot-gen-${idx + 1}`,
          stepNumber: idx + 1,
          name: loc,
          time: matchedPhoto?.time || '12:00',
          lat: 35.003 + (idx * 0.008) - 0.02,
          lng: 135.77 + (idx * 0.006) - 0.015,
          photoUrl: matchedPhoto?.url || tripToFinalize.coverImage,
          diarySnippet: `${loc}をみんなで散策`,
          contributorName: matchedPhoto?.contributor.name || 'メンバー',
        };
      });

      const finalizedTrip: Trip = {
        ...tripToFinalize,
        coverImage: sorted[0]?.url || tripToFinalize.coverImage,
        photosCount: sorted.length,
        spotsCount: generatedSpots.length,
        spots: generatedSpots,
        entries: generatedEntries,
        summaryStats: {
          visitedPlacesCount: generatedSpots.length,
          travelDuration: `${sorted[0]?.time || '10:00'} 〜 ${sorted[sorted.length - 1]?.time || '18:00'}`,
          totalPhotosCount: sorted.length,
          membersCount: tripToFinalize.members.length,
          topPhotoSpot: generatedSpots[0]?.name || tripToFinalize.destination,
          topPhotoSpotCount: sorted.length,
          bestShotUrl: sorted[0]?.url || tripToFinalize.coverImage,
          bestShotTitle: `${tripToFinalize.title}のベストショット`,
          bestShotDescription: '参加者みんなの写真から選ばれた、思い出の象徴的な一枚です。',
          bestShotPhotographer: sorted[0]?.contributor.name || 'メンバー',
        },
      };

      setPastTrips((prev) => [finalizedTrip, ...prev.filter((t) => t.id !== finalizedTrip.id)]);
      setSelectedTrip(finalizedTrip);
      setCurrentTripDraft(null);
    } else {
      setSelectedTrip(tripToFinalize);
    }

    setActiveScreen('diary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setActiveScreen('diary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenLightbox = (url: string, caption?: string, spotName?: string) => {
    setLightboxData({ url, caption, spotName });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-diary">
      {/* Navigation (Left sidebar on desktop, bottom bar on mobile) */}
      <Navigation
        activeScreen={activeScreen}
        setActiveScreen={(screen) => {
          setActiveScreen(screen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNewTripClick={handleStartCreateTrip}
      />

      {/* Main Content Area (Offset by 64px on desktop for left sidebar) */}
      <main className="flex-1 md:pl-64 transition-all duration-200">
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
          <GeneratingScreen onComplete={handleFinishGenerating} />
        )}

        {activeScreen === 'diary' && (
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
        )}

        {activeScreen === 'memories' && (
          <MemoriesListScreen
            trips={pastTrips}
            onSelectTrip={handleSelectTrip}
            onNewTripClick={handleStartCreateTrip}
          />
        )}

        {activeScreen === 'map' && (
          <OverallMapScreen
            trips={pastTrips}
            onSelectTrip={handleSelectTrip}
          />
        )}

        {activeScreen === 'profile' && <ProfileScreen />}
      </main>

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        tripTitle={selectedTrip?.title || '京都1日旅行'}
        members={selectedTrip?.members || SAMPLE_MEMBERS}
      />

      {/* Photo Zoom Lightbox */}
      <PhotoLightbox
        photoUrl={lightboxData?.url || null}
        caption={lightboxData?.caption}
        spotName={lightboxData?.spotName}
        onClose={() => setLightboxData(null)}
      />
    </div>
  );
}
