export type GlobeShowNode = {
  showId: string;
  title: string;
  coverArtUrl: string;
  isAmped?: boolean;
  ampScore?: number;
  coordinates: { x: number; y: number; z: number };
  isClaimed?: boolean;
  hostName?: string;
  slug?: string;
  description?: string;
};

export type SnippetResult = {
  snippetId: string;
  showId: string;
  episodeId: string;
  showTitle: string;
  episodeTitle: string;
  hookText: string;
  transcriptExcerpt: string;
  startTime: number;
  endTime: number;
  audioUrl: string;
  coverArtUrl: string;
  similarityScore: number;
  ampScore?: number;
};

export type DiscoveryPodcastItem = {
  id: string;
  title: string;
  hostName: string;
  coverArtUrl: string;
  isIngested: boolean;
  feedUrl?: string;
  genre?: string;
  description?: string;
  showId?: string;
};

export type RecommendationClip = {
  snippetId: string;
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
};

export type SimilarRecommendation = {
  showId: string;
  title: string;
  hostName: string;
  coverArtUrl: string;
  genre: string;
  matchScore: number;
  whyYouWillLikeIt: string;
  websiteUrl?: string;
  spotifyUrl?: string;
  appleUrl?: string;
  youtubeUrl?: string;
  clips: RecommendationClip[];
};

