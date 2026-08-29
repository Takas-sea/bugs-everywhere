export interface Contributor {
  id: string;
  name: string;
  avatar: string;
  role?: string;
  photoCount?: number;
  isOwner?: boolean;
}

export interface PhotoItem {
  id: string;
  url: string;
  time: string; // e.g. "10:05"
  timestamp: number;
  locationName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  contributor: Contributor;
  caption?: string;
  category?: 'transport' | 'sightseeing' | 'food' | 'culture' | 'scenery' | 'night';
  isSelected?: boolean;
}

export interface DiaryEntry {
  id: string;
  photoId: string;
  /** どのコマ（scenes の行）かを表すID。場所名の編集に使います */
  sceneId?: string;
  time: string;
  title: string;
  location: string;
  weather?: string;
  aiDiaryText: string;
  feeling?: string;
  photoUrl: string;
  contributor: Contributor;
  cameraInfo?: string;
  // Interactive Q&A for factual grounding
  qaPrompt?: string;
  userAnswer?: string;
  isAnswered?: boolean;
}

export interface TripHighlight {
  id: string;
  type: 'laugh' | 'view' | 'food' | 'best_shot';
  label: string; // "一番笑った瞬間", "一番きれいだった景色", "一番おいしかったもの", "今日のベストショット"
  title: string;
  description: string;
  photoUrl: string;
  badgeBg: string;
  badgeTextColor: string;
  badgeBorder: string;
}

export interface MapSpot {
  id: string;
  stepNumber: number;
  name: string;
  lat: number;
  lng: number;
  time: string;
  photoUrl: string;
  diarySnippet: string;
  contributorName: string;
}

export interface TripSummaryStats {
  visitedPlacesCount: number;
  travelDuration: string;
  totalPhotosCount: number;
  membersCount: number;
  topPhotoSpot: string;
  topPhotoSpotCount: number;
  bestShotUrl: string;
  bestShotTitle: string;
  bestShotDescription: string;
  bestShotPhotographer: string;
}

export interface Trip {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  destination: string;
  coverImage: string;
  members: Contributor[];
  spotsCount: number;
  photosCount: number;
  weather: string;
  spots: MapSpot[];
  entries: DiaryEntry[];
  highlights?: TripHighlight[];
  tags: string[];
  isSample?: boolean;
  summaryStats?: TripSummaryStats;
  /** 実際にアップロードされた写真そのもの（コマではなく1枚ずつ） */
  photoItems?: PhotoItem[];
}

export type ActiveScreen =
  | 'home' | 'create_trip' | 'upload' | 'generating'
  | 'diary' | 'memories' | 'map' | 'profile';

export type DiaryTab = 'photos' | 'diary' | 'members' | 'map';
