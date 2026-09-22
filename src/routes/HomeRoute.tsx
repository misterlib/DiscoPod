/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";

import { api } from "../convexApi";
import type { Id } from "../../convex/_generated/dataModel";
import type { GlobeShowNode, SnippetResult, DiscoveryPodcastItem, SimilarRecommendation } from "../features/types";
import { MOCK_SHOWS, MOCK_SNIPPETS } from "../features/mockData";
import { DiscoballScene } from "../features/landing/DiscoballScene";
import { DiscoverySearchCard } from "../features/landing/DiscoverySearchCard";
import { TinderDiscoveryDeck } from "../features/discovery/TinderDiscoveryDeck";
import { ShowDetailModal, type ShowDetailData } from "../features/shows/ShowDetailModal";
import { HostAdminPanel } from "../features/landing/HostAdminPanel";
import { AboutPanel } from "../features/landing/AboutPanel";
import { LegalModal, type LegalModalTab } from "../features/legal/LegalModal";
import logoLightSvg from "../assets/logo-light.svg";
import { MapShowModal } from "../features/shows/MapShowModal";
import { DiscoReelPlayer, type DiscoReelClip } from "../features/player/DiscoReelPlayer";
import { SemanticDiscoveryBar } from "../features/search/SemanticDiscoveryBar";
import { Sparkles, X, Heart } from "lucide-react";
import { useLikedShows } from "../features/discovery/likedShowsStorage";
import { SavedPodcastsPanel } from "../features/discovery/SavedPodcastsPanel";

const GlobeCanvas = lazy(async () =>
  import("../features/globe/GlobeCanvas").then((module) => ({
    default: module.GlobeCanvas,
  })),
);
const SnippetSearchPanel = lazy(async () =>
  import("../features/search/SnippetSearchPanel").then((module) => ({
    default: module.SnippetSearchPanel,
  })),
);
const ShowDetailDrawer = lazy(async () =>
  import("../features/shows/ShowDetailDrawer").then((module) => ({
    default: module.ShowDetailDrawer,
  })),
);
const WaveformPlayer = lazy(async () =>
  import("../features/player/WaveformPlayer").then((module) => ({
    default: module.WaveformPlayer,
  })),
);

type ViewState = "landing" | "admin" | "about" | "saved" | "search" | "results" | "discovery_deck";

export function HomeRoute() {
  if (!import.meta.env.VITE_CONVEX_URL) {
    return <HomeRouteOffline />;
  }
  return <HomeRouteLive />;
}

// ----------------------------------------------------------------------------
// Live Route with Convex Connection
// ----------------------------------------------------------------------------
function HomeRouteLive() {
  const [viewState, setViewState] = useState<ViewState>("landing");
  const [claimCode, setClaimCode] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [modalShowId, setModalShowId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("claimCode") || params.get("code");
    if (code) {
      setClaimCode(code);
      setViewState("admin");
    }
    const showParam = params.get("show") || params.get("showId");
    if (showParam) {
      setSelectedShowId(showParam);
      setModalShowId(showParam);
    } else {
      const match = window.location.pathname.match(/\/(?:reel|show)\/([^/]+)/);
      if (match && match[1]) {
        setSelectedShowId(match[1]);
        setModalShowId(match[1]);
      }
    }
  }, []);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [feedQuery, setFeedQuery] = useState<string>("");
  const [semanticQuery, setSemanticQuery] = useState<string>("");
  const [semanticResults, setSemanticResults] = useState<SnippetResult[]>([]);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [activeReelClip, setActiveReelClip] = useState<DiscoReelClip | null>(null);
  const [isSemanticOpen, setIsSemanticOpen] = useState(false);

  const globeShows: GlobeShowNode[] =
    useQuery(api.shows.listGlobeShows, {
      limit: 1000,
    }) ?? [];

  const showDetail = useQuery(
    api.shows.getShowDetail,
    selectedShowId ? { showId: selectedShowId as Id<"shows"> } : "skip",
  ) as ShowDetailData | null | undefined;

  const modalShow = useMemo(
    () => globeShows.find((show) => show.showId === modalShowId) ?? null,
    [globeShows, modalShowId],
  );
  const modalShowDetail = useQuery(
    api.shows.getShowDetail,
    modalShowId ? { showId: modalShowId as Id<"shows"> } : "skip",
  ) as ShowDetailData | null | undefined;

  const { results, status, loadMore } = usePaginatedQuery(
    api.search.searchSnippetsFeed,
    {
      query: feedQuery,
      showId: selectedShowId ?? undefined,
    },
    { initialNumItems: 12 },
  );

  const [seedPodcast, setSeedPodcast] = useState<DiscoveryPodcastItem | null>(null);
  const [discoveryRecommendations, setDiscoveryRecommendations] = useState<SimilarRecommendation[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Legal Modal & Takedown Dialog state
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalModalTab>("terms");
  const [legalPrefilledShow, setLegalPrefilledShow] = useState<{
    showId?: string;
    title: string;
    rssUrl?: string;
  } | null>(null);

  const runSemanticSearch = useAction(api.searchActions.searchSnippetsSemantic);
  const incrementSnippetPlay = useMutation(api.snippets.incrementSnippetPlay);
  const searchDiscoveryPodcasts = useAction(api.podcastDiscoveryActions.searchDiscoveryPodcasts);
  const getSimilarPodcasts = useAction(api.podcastDiscoveryActions.getSimilarPodcastsForDiscovery);
  const fastIngestPodcast = useAction(api.podcastDiscoveryActions.fastIngestPodcast);

  const feedSnippets: SnippetResult[] = results.map((snippet) => ({
    snippetId: snippet.snippetId,
    showId: snippet.showId,
    episodeId: snippet.episodeId,
    showTitle: snippet.showTitle,
    episodeTitle: snippet.episodeTitle,
    hookText: snippet.hookText,
    transcriptExcerpt: snippet.transcriptExcerpt,
    startTime: snippet.startTime,
    endTime: snippet.endTime,
    audioUrl: snippet.audioUrl,
    coverArtUrl: snippet.coverArtUrl,
    similarityScore: 0,
    ampScore: snippet.ampScore ?? 0,
  }));

  const snippetPool = semanticResults.length > 0 ? semanticResults : feedSnippets;
  const semanticMode = semanticResults.length > 0;
  const selectedShow = useMemo(
    () => globeShows.find((show) => show.showId === selectedShowId) ?? null,
    [globeShows, selectedShowId],
  );
  const selectedSnippet = useMemo(
    () => snippetPool.find((snippet) => snippet.snippetId === activeSnippetId) ?? null,
    [snippetPool, activeSnippetId],
  );

  async function handleSemanticSearch(queryOverride?: string, targetShowId?: string | null) {
    setSemanticError(null);
    setSemanticLoading(true);
    try {
      const queryToRun = queryOverride ?? semanticQuery;
      const response = await runSemanticSearch({
        query: queryToRun,
        limit: 12,
        showId: targetShowId ?? selectedShowId ?? undefined,
      });
      setSemanticResults(response.results);
      setSemanticQuery(queryToRun);
    } catch (error) {
      if (error instanceof Error) {
        setSemanticError(error.message);
      } else {
        setSemanticError("Semantic search failed.");
      }
    } finally {
      setSemanticLoading(false);
    }
  }

  async function handleSearchPodcasts(searchQuery: string): Promise<{
    ingested: DiscoveryPodcastItem[];
    external: DiscoveryPodcastItem[];
  }> {
    try {
      const resp = (await searchDiscoveryPodcasts({ query: searchQuery, limit: 10 })) as {
        ingested: Array<{
          showId: Id<"shows">;
          title: string;
          hostName: string;
          coverArtUrl: string;
          isAmped?: boolean;
          ampScore?: number;
          description: string;
          isIngested: true;
        }>;
        external: Array<{
          appleId: string;
          title: string;
          hostName: string;
          coverArtUrl: string;
          genre: string;
          feedUrl: string;
          description: string;
          isIngested: false;
        }>;
      };
      return {
        ingested: resp.ingested.map((item) => ({
          id: String(item.showId),
          title: item.title,
          hostName: item.hostName,
          coverArtUrl: item.coverArtUrl,
          isIngested: true,
          showId: String(item.showId),
          description: item.description,
        })),
        external: resp.external.map((item) => ({
          id: item.appleId,
          title: item.title,
          hostName: item.hostName,
          coverArtUrl: item.coverArtUrl,
          isIngested: false,
          feedUrl: item.feedUrl,
          genre: item.genre,
          description: item.description,
        })),
      };
    } catch (err) {
      console.error("Live discovery search failed:", err);
      return { ingested: [], external: [] };
    }
  }

  async function handleFastIngest(podcast: DiscoveryPodcastItem): Promise<DiscoveryPodcastItem> {
    try {
      const resp = (await fastIngestPodcast({
        title: podcast.title,
        hostName: podcast.hostName,
        coverArtUrl: podcast.coverArtUrl,
        feedUrl: podcast.feedUrl,
        genre: podcast.genre,
        appleId: podcast.id,
        description: podcast.description,
      })) as {
        showId: Id<"shows">;
        title: string;
        hostName: string;
        coverArtUrl: string;
        description: string;
        isIngested: boolean;
      };

      return {
        ...podcast,
        id: String(resp.showId),
        showId: String(resp.showId),
        title: resp.title,
        hostName: resp.hostName,
        coverArtUrl: resp.coverArtUrl,
        description: resp.description,
        isIngested: true,
      };
    } catch (err) {
      console.warn("Live fast ingestion failed:", err);
      return podcast;
    }
  }

  async function handleLaunchDiscovery(selectedPodcast: DiscoveryPodcastItem) {
    let podcast = selectedPodcast;
    if (!podcast.isIngested && podcast.feedUrl) {
      podcast = await handleFastIngest(podcast);
    }
    setSeedPodcast(podcast);
    setViewState("discovery_deck");
    setDiscoveryLoading(true);
    try {
      const recs = (await getSimilarPodcasts({
        seedTitle: podcast.title,
        seedShowId: podcast.showId ? (podcast.showId as Id<"shows">) : undefined,
      })) as SimilarRecommendation[];
      setDiscoveryRecommendations(recs);
    } catch (err) {
      console.error("Discovery recommendations failed:", err);
      setStatusMessage(
        err instanceof Error ? err.message : "Failed to load similar podcasts for that show.",
      );
    } finally {
      setDiscoveryLoading(false);
    }
  }

  if (viewState === "results") {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 sm:p-6 animate-fade-in">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <img src={logoLightSvg} alt="DISCOPOD" className="h-8 sm:h-9 w-auto drop-shadow" />
            <p className="text-xs sm:text-sm text-disco-cream/70 border-l border-white/20 pl-3">
              Podcast discovery on an interactive globe
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewState("landing")}
            className="rounded-full bg-disco-navy px-5 py-2 font-['Lato'] text-sm font-bold text-disco-cream border border-disco-cream/20 shadow hover:scale-105 active:scale-95 transition"
          >
            &larr; Back to DiscoPod
          </button>
        </header>

        {statusMessage ? (
          <div className="rounded-xl border border-disco-caramel/40 bg-disco-navy/60 p-3 text-xs text-disco-cream">
            {statusMessage}
          </div>
        ) : null}

        <Suspense fallback={<PanelFallback label="Loading globe..." />}>
          <GlobeCanvas
            nodes={globeShows}
            selectedShowId={selectedShowId}
            onSelectShow={(showId) => {
              setSelectedShowId(showId);
              setModalShowId(showId);
            }}
          />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-3">
          <Suspense fallback={<PanelFallback label="Loading search panel..." />}>
            <SnippetSearchPanel
              feedQuery={feedQuery}
              semanticQuery={semanticQuery}
              onFeedQueryChange={setFeedQuery}
              onSemanticQueryChange={setSemanticQuery}
              onRunSemanticSearch={handleSemanticSearch}
              onClearSemantic={() => setSemanticResults([])}
              semanticMode={semanticMode}
              semanticLoading={semanticLoading}
              semanticError={semanticError}
              snippets={snippetPool}
              canLoadMore={status === "CanLoadMore"}
              onLoadMore={() => loadMore(12)}
              onPickSnippet={(snippet) => {
                setSelectedShowId(snippet.showId);
                setActiveSnippetId(snippet.snippetId);
                void incrementSnippetPlay({ snippetId: snippet.snippetId as Id<"snippets"> });
              }}
            />
          </Suspense>
          <Suspense fallback={<PanelFallback label="Loading show detail..." />}>
            <ShowDetailDrawer show={selectedShow} detail={showDetail ?? null} />
          </Suspense>
          <Suspense fallback={<PanelFallback label="Loading player..." />}>
            <WaveformPlayer snippet={selectedSnippet} />
          </Suspense>
        </div>

        <ShowDetailModal
          isOpen={Boolean(modalShowId)}
          onClose={() => setModalShowId(null)}
          show={modalShow}
          detail={modalShowDetail ?? null}
          onPlaySnippet={(snippet) => {
            setSelectedShowId(snippet.showId);
            setActiveSnippetId(snippet.snippetId);
            void incrementSnippetPlay({ snippetId: snippet.snippetId as Id<"snippets"> });
          }}
          onRequestTakedown={(showInfo) => {
            setLegalPrefilledShow(showInfo);
            setLegalModalTab("takedown");
            setLegalModalOpen(true);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <LandingScreen
        viewState={viewState}
        setViewState={setViewState}
        claimCode={claimCode}
        isOffline={false}
        shows={globeShows}
        selectedShowId={selectedShowId}
        onSelectShow={(showId) => {
          setSelectedShowId(showId);
          setModalShowId(showId);
        }}
        seedPodcast={seedPodcast}
        discoveryRecommendations={discoveryRecommendations}
        discoveryLoading={discoveryLoading}
        onSearchPodcasts={handleSearchPodcasts}
        onLaunchDiscovery={(podcast) => {
          void handleLaunchDiscovery(podcast);
        }}
        onExploreRecommendationOnGlobe={(showId) => {
          setSelectedShowId(showId);
          setModalShowId(showId);
          setViewState("landing");
        }}
        onResetSearch={() => setViewState("search")}
        onOpenLegal={(tab, show) => {
          setLegalPrefilledShow(show || null);
          setLegalModalTab(tab);
          setLegalModalOpen(true);
        }}
      />
      <MapShowModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onShowMapped={(showId) => {
          setSelectedShowId(showId);
          setModalShowId(showId);
        }}
      />
      {activeReelClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <DiscoReelPlayer
            clip={activeReelClip}
            onClose={() => setActiveReelClip(null)}
          />
        </div>
      )}
      {isSemanticOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl p-6 rounded-3xl bg-gray-950/95 border border-indigo-500/30 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Semantic Listener Discovery (1536-dim Vector Search)</span>
              </div>
              <button
                onClick={() => setIsSemanticOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SemanticDiscoveryBar
              onPlayClip={(clip) => {
                setActiveReelClip(clip);
                setIsSemanticOpen(false);
              }}
              onSelectShow={(showId) => {
                setSelectedShowId(showId);
                setModalShowId(showId);
                setIsSemanticOpen(false);
              }}
            />
          </div>
        </div>
      )}
      <ShowDetailModal
        isOpen={Boolean(modalShowId)}
        onClose={() => setModalShowId(null)}
        show={modalShow}
        detail={modalShowDetail ?? null}
        onPlaySnippet={(snippet) => {
          setSelectedShowId(snippet.showId);
          setActiveSnippetId(snippet.snippetId);
          void incrementSnippetPlay({ snippetId: snippet.snippetId as Id<"snippets"> });
        }}
        onRequestTakedown={(showInfo) => {
          setLegalPrefilledShow(showInfo);
          setLegalModalTab("takedown");
          setLegalModalOpen(true);
        }}
      />
      <LegalModal
        isOpen={legalModalOpen}
        initialTab={legalModalTab}
        prefilledShow={legalPrefilledShow}
        onClose={() => {
          setLegalModalOpen(false);
          setLegalPrefilledShow(null);
        }}
      />
    </>
  );
}

const OFFLINE_EXTERNAL_PODCASTS: DiscoveryPodcastItem[] = [
  {
    id: "ext_morbid",
    title: "Morbid: A True Crime Podcast",
    hostName: "Alaina Urquhart & Ash Kelley",
    coverArtUrl:
      "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=400&fit=crop",
    isIngested: false,
    genre: "True Crime",
  },
  {
    id: "ext_huberman",
    title: "Huberman Lab",
    hostName: "Dr. Andrew Huberman",
    coverArtUrl:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=400&fit=crop",
    isIngested: false,
    genre: "Science & Health",
  },
  {
    id: "ext_acquired",
    title: "Acquired",
    hostName: "Ben Gilbert & David Rosenthal",
    coverArtUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=400&fit=crop",
    isIngested: false,
    genre: "Business & Tech",
  },
  {
    id: "ext_serial",
    title: "Serial",
    hostName: "Sarah Koenig",
    coverArtUrl:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&h=400&fit=crop",
    isIngested: false,
    genre: "Investigative Journalism",
  },
  {
    id: "ext_mfm",
    title: "My Favorite Murder",
    hostName: "Karen Kilgariff & Georgia Hardstark",
    coverArtUrl:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=400&fit=crop",
    isIngested: false,
    genre: "Comedy & True Crime",
  },
];

// ----------------------------------------------------------------------------
// Offline Route (Pure Design & State Animation Mode)
// ----------------------------------------------------------------------------
function HomeRouteOffline() {
  const [viewState, setViewState] = useState<ViewState>("landing");
  const [claimCode, setClaimCode] = useState<string>("");
  const [selectedShowId, setSelectedShowId] = useState<string | null>("show_1");
  const [modalShowId, setModalShowId] = useState<string | null>(null);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>("snippet_1");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("claimCode") || params.get("code");
    if (code) {
      setClaimCode(code);
      setViewState("admin");
    }
    const showParam = params.get("show") || params.get("showId");
    if (showParam) {
      setSelectedShowId(showParam);
      setModalShowId(showParam);
    } else {
      const match = window.location.pathname.match(/\/(?:reel|show)\/([^/]+)/);
      if (match && match[1]) {
        setSelectedShowId(match[1]);
        setModalShowId(match[1]);
      }
    }
  }, []);

  const [seedPodcast, setSeedPodcast] = useState<DiscoveryPodcastItem | null>(null);
  const [discoveryRecommendations, setDiscoveryRecommendations] = useState<SimilarRecommendation[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const selectedShow = useMemo(
    () => MOCK_SHOWS.find((show) => show.showId === selectedShowId) ?? null,
    [selectedShowId],
  );
  const selectedSnippet = useMemo(
    () => MOCK_SNIPPETS.find((snippet) => snippet.snippetId === activeSnippetId) ?? null,
    [activeSnippetId],
  );

  const modalShow = useMemo(
    () => MOCK_SHOWS.find((show) => show.showId === modalShowId) ?? null,
    [modalShowId],
  );

  const modalShowDetail = useMemo((): ShowDetailData | null => {
    if (!modalShow) return null;
    const relatedSnippets = MOCK_SNIPPETS.filter((s) => s.showId === modalShow.showId);
    return {
      showId: modalShow.showId,
      title: modalShow.title,
      description: modalShow.description || "Ingested into DiscoPod's 3D globe.",
      coverArtUrl: modalShow.coverArtUrl,
      hostName: modalShow.hostName || "Featured Host",
      isClaimed: modalShow.isClaimed,
      isAmped: modalShow.isAmped ?? false,
      ampScore: modalShow.ampScore ?? 0,
      topSnippets: relatedSnippets.map((s) => ({
        snippetId: s.snippetId,
        episodeId: s.episodeId,
        hookText: s.hookText,
        transcriptExcerpt: s.transcriptExcerpt,
        startTime: s.startTime,
        endTime: s.endTime,
        playCount: 48,
        upvotes: 48,
      })),
      latestEpisodes: [
        {
          episodeId: "ep_1",
          title: "Episode 1: The Initial Spark",
          pubDate: Date.now() - 86400000 * 3,
          durationSeconds: 1920,
          summary: modalShow.description || "",
          audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
        },
      ],
    };
  }, [modalShow]);

  function handleSearchPodcastsOffline(searchQuery: string): Promise<{
    ingested: DiscoveryPodcastItem[];
    external: DiscoveryPodcastItem[];
  }> {
    const q = searchQuery.toLowerCase().trim();
    const ingested = MOCK_SHOWS
      .filter((s) => s.title.toLowerCase().includes(q) || (s.hostName || "").toLowerCase().includes(q))
      .slice(0, 4)
      .map((s) => ({
        id: s.showId,
        title: s.title,
        hostName: s.hostName || "Featured Host",
        coverArtUrl: s.coverArtUrl,
        isIngested: true,
        showId: s.showId,
        description: s.description,
      }));

    const external = OFFLINE_EXTERNAL_PODCASTS
      .filter((p) => p.title.toLowerCase().includes(q) || p.hostName.toLowerCase().includes(q))
      .slice(0, 6);

    return Promise.resolve({ ingested, external });
  }

  function handleFastIngestOffline(
    podcast: DiscoveryPodcastItem,
  ): Promise<DiscoveryPodcastItem> {
    return Promise.resolve({
      ...podcast,
      id: `offline_${podcast.title.toLowerCase().replace(/\s+/g, "_")}`,
      showId: `offline_${podcast.title.toLowerCase().replace(/\s+/g, "_")}`,
      isIngested: true,
      description: podcast.description || `${podcast.title} hosted by ${podcast.hostName}.`,
    });
  }

  async function handleLaunchDiscoveryOffline(selectedPodcast: DiscoveryPodcastItem) {
    const podcast = !selectedPodcast.isIngested
      ? await handleFastIngestOffline(selectedPodcast)
      : selectedPodcast;
    setSeedPodcast(podcast);
    setViewState("discovery_deck");
    setDiscoveryLoading(true);

    setTimeout(() => {
      const candidates = MOCK_SHOWS.filter((s) => s.showId !== selectedPodcast.showId).slice(0, 4);
      const recs: SimilarRecommendation[] = candidates.map((show, idx) => {
        const snippets = MOCK_SNIPPETS.filter((snip) => snip.showId === show.showId);
        const fallbackClip = MOCK_SNIPPETS[0]!;
        const clip = snippets[0] ?? fallbackClip;
        return {
          showId: show.showId,
          title: show.title,
          hostName: show.hostName || "Featured Host",
          coverArtUrl: show.coverArtUrl,
          genre: "Audio Discovery",
          matchScore: 97 - idx * 3,
          whyYouWillLikeIt: `Because you enjoy ${selectedPodcast.title}, this show brings matching energy with ${show.description}`,
          clips: [
            {
              snippetId: clip.snippetId,
              episodeTitle: clip.episodeTitle,
              audioUrl: clip.audioUrl,
              startTime: clip.startTime,
              endTime: clip.endTime,
              duration: Math.max(15, clip.endTime - clip.startTime),
              hookText: clip.hookText,
              transcriptExcerpt: clip.transcriptExcerpt,
              whyYouWillLikeIt: `Matches the curiosity and tone of ${selectedPodcast.title}.`,
            },
          ],
        };
      });
      setDiscoveryRecommendations(recs);
      setDiscoveryLoading(false);
    }, 400);
  }

  if (viewState === "results") {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 sm:p-6 animate-fade-in">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="font-['Passion_One'] text-3xl sm:text-4xl font-black uppercase text-disco-cream">
              DISCOPOD
            </h1>
            <p className="text-xs sm:text-sm text-disco-cream/70">
              Demo Discovery Results (Offline Mode)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewState("landing")}
            className="rounded-full bg-disco-navy px-5 py-2 font-['Lato'] text-sm font-bold text-disco-cream border border-disco-cream/20 shadow hover:scale-105 active:scale-95 transition"
          >
            &larr; Back to DiscoPod
          </button>
        </header>

        <Suspense fallback={<PanelFallback label="Loading globe..." />}>
          <GlobeCanvas
            nodes={MOCK_SHOWS}
            selectedShowId={selectedShowId}
            onSelectShow={(showId) => {
              setSelectedShowId(showId);
              setModalShowId(showId);
            }}
          />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-3">
          <Suspense fallback={<PanelFallback label="Loading search panel..." />}>
            <SnippetSearchPanel
              feedQuery=""
              semanticQuery=""
              onFeedQueryChange={() => {}}
              onSemanticQueryChange={() => {}}
              onRunSemanticSearch={() => Promise.resolve()}
              onClearSemantic={() => {}}
              semanticMode={false}
              semanticLoading={false}
              semanticError={null}
              snippets={MOCK_SNIPPETS}
              canLoadMore={false}
              onLoadMore={() => {}}
              onPickSnippet={(snippet) => {
                setSelectedShowId(snippet.showId);
                setActiveSnippetId(snippet.snippetId);
              }}
            />
          </Suspense>
          <Suspense fallback={<PanelFallback label="Loading show detail..." />}>
            <ShowDetailDrawer show={selectedShow} detail={null} />
          </Suspense>
          <Suspense fallback={<PanelFallback label="Loading player..." />}>
            <WaveformPlayer snippet={selectedSnippet} />
          </Suspense>
        </div>

        <ShowDetailModal
          isOpen={Boolean(modalShowId)}
          onClose={() => setModalShowId(null)}
          show={modalShow}
          detail={modalShowDetail}
          onPlaySnippet={(snippet) => {
            setSelectedShowId(snippet.showId);
            setActiveSnippetId(snippet.snippetId);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <LandingScreen
        viewState={viewState}
        setViewState={setViewState}
        claimCode={claimCode}
        isOffline={true}
        shows={MOCK_SHOWS}
        selectedShowId={selectedShowId}
        onSelectShow={(showId) => {
          setSelectedShowId(showId);
          setModalShowId(showId);
        }}
        seedPodcast={seedPodcast}
        discoveryRecommendations={discoveryRecommendations}
        discoveryLoading={discoveryLoading}
        onSearchPodcasts={handleSearchPodcastsOffline}
        onLaunchDiscovery={(podcast) => {
          void handleLaunchDiscoveryOffline(podcast);
        }}
        onFastIngest={handleFastIngestOffline}
        onExploreRecommendationOnGlobe={(showId) => {
          setSelectedShowId(showId);
          setModalShowId(showId);
          setViewState("landing");
        }}
        onResetSearch={() => setViewState("search")}
      />
      <ShowDetailModal
        isOpen={Boolean(modalShowId)}
        onClose={() => setModalShowId(null)}
        show={modalShow}
        detail={modalShowDetail}
        onPlaySnippet={(snippet) => {
          setSelectedShowId(snippet.showId);
          setActiveSnippetId(snippet.snippetId);
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Shared Landing Screen matching Figma Designs
// ----------------------------------------------------------------------------
function LandingScreen({
  viewState,
  setViewState,
  claimCode,
  isOffline = false,
  shows,
  selectedShowId,
  onSelectShow,
  seedPodcast,
  discoveryRecommendations,
  discoveryLoading,
  onSearchPodcasts,
  onLaunchDiscovery,
  onFastIngest,
  onExploreRecommendationOnGlobe,
  onResetSearch,
  onOpenLegal,
}: {
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  claimCode?: string;
  isOffline?: boolean;
  shows: GlobeShowNode[];
  selectedShowId: string | null;
  onSelectShow: (showId: string) => void;
  seedPodcast: DiscoveryPodcastItem | null;
  discoveryRecommendations: SimilarRecommendation[];
  discoveryLoading: boolean;
  onSearchPodcasts: (
    query: string,
  ) => Promise<{ ingested: DiscoveryPodcastItem[]; external: DiscoveryPodcastItem[] }>;
  onLaunchDiscovery: (podcast: DiscoveryPodcastItem) => void;
  onFastIngest?: (podcast: DiscoveryPodcastItem) => Promise<DiscoveryPodcastItem>;
  onExploreRecommendationOnGlobe: (showId: string) => void;
  onResetSearch: () => void;
  onOpenLegal?: (
    tab: LegalModalTab,
    show?: { showId?: string; title: string; rssUrl?: string } | null,
  ) => void;
}) {
  const isExpandedView = viewState === "admin" || viewState === "about" || viewState === "saved";
  const isInteractive = viewState === "landing";
  const { count: likedCount } = useLikedShows();

  // Fallback legal modal state if onOpenLegal is not passed
  const [localLegalOpen, setLocalLegalOpen] = useState(false);
  const [localLegalTab, setLocalLegalTab] = useState<LegalModalTab>("terms");
  const [localPrefilledShow, setLocalPrefilledShow] = useState<{
    showId?: string;
    title: string;
    rssUrl?: string;
  } | null>(null);

  const handleOpenLegal = (
    tab: LegalModalTab,
    show?: { showId?: string; title: string; rssUrl?: string } | null,
  ) => {
    setLocalPrefilledShow(show || null);
    setLocalLegalTab(tab);
    setLocalLegalOpen(true);
  };

  // ESC key to return to landing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && viewState !== "landing") {
        setViewState("landing");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewState, setViewState]);

  return (
    <div
      className={`relative flex h-screen h-[100dvh] max-h-[100dvh] w-full flex-col justify-between ${
        viewState === "discovery_deck" ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden"
      } bg-disco-dark select-none`}
    >
      {/* 3D Wireframe & Cover Art Discoball Scene - 3x as tall, positioned 150px lower */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 top-[150px] sm:top-[155px] md:top-[160px] z-0 flex items-center justify-center ${
          isInteractive ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <DiscoballScene
          shows={shows}
          selectedShowId={selectedShowId}
          onSelectShow={onSelectShow}
          interactive={isInteractive}
          className="h-[1140px] w-[1140px] sm:h-[1440px] sm:w-[1440px] md:h-[1620px] md:w-[1620px]"
        />
      </div>

      {/* Top Header: Logo with responsive padding */}
      <header
        className={`pointer-events-none relative z-30 pt-3 sm:pt-[30px] px-3 sm:px-[30px] w-full shrink-0 transition-all duration-300 ${
          viewState === "discovery_deck" ? "hidden" : ""
        }`}
      >
        <div className="relative w-full flex flex-col items-center justify-center">
          {/* Center: DISCOPOD Logo - smoothly shrinks from full width; sized to extend into card border */}
          <img
            src={logoLightSvg}
            alt="DISCOPOD"
            className={`aspect-[834/119] object-contain drop-shadow-2xl select-none transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isExpandedView
                ? "w-[340px] sm:w-[480px] md:w-[580px] lg:w-[640px] max-w-[85vw]"
                : "w-full"
            }`}
          />

          {/* Section title (ADMIN / ABOUT / SAVED) - centered directly below the DISCOPOD logo */}
          {isExpandedView ? (
            <div className="mt-1 sm:mt-1.5 z-10 animate-drop-top flex items-center justify-center">
              <span
                className={`font-['Lato'] text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-[0.25em] pl-[0.25em] ${
                  viewState === "admin"
                    ? "text-disco-rose"
                    : viewState === "saved"
                      ? "text-rose-400"
                      : "text-disco-caramel"
                }`}
              >
                {viewState === "admin" ? "ADMIN" : viewState === "saved" ? "SAVED" : "ABOUT"}
              </span>
            </div>
          ) : null}

          {/* Subtitle on mobile: PODCAST DISCOVERY under logo */}
          {!isExpandedView ? (
            <div className="sm:hidden mt-2 flex items-center justify-center gap-2">
              <span className="font-['Lato'] font-extrabold uppercase text-disco-cream/70 text-[10px] tracking-[0.35em] pl-[0.35em] select-none text-center">
                PODCAST DISCOVERY
              </span>
              <button
                type="button"
                onClick={() => setViewState("saved")}
                title={likedCount > 0 ? `${likedCount} liked podcasts` : "Liked podcasts"}
                aria-label="View Liked Podcasts"
                className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-rose-500/20 text-disco-cream px-2 py-0.5 text-[10px] font-bold border border-white/10 active:scale-95 transition cursor-pointer"
              >
                <Heart
                  className={`h-3 w-3 ${
                    likedCount > 0 ? "fill-rose-500 text-rose-500" : "text-disco-cream/70"
                  }`}
                />
                {likedCount > 0 ? (
                  <span className="font-mono text-[9px] font-extrabold">{likedCount}</span>
                ) : null}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Center Interactive CTA / Search Panel / Grown Card Views */}
      <main
        className={`relative z-20 flex flex-1 min-h-0 px-2 sm:px-[30px] ${
          viewState === "discovery_deck"
            ? "items-start sm:items-center justify-center py-2 sm:py-6 pointer-events-auto"
            : isExpandedView
              ? "items-stretch pb-3 sm:pb-[30px] -mt-[9px] sm:-mt-[11px] md:-mt-[13px] pointer-events-none"
              : "items-center justify-center py-2 sm:py-4 pointer-events-none"
        }`}
      >
        {/* State: Landing Idle CTA */}
        {viewState === "landing" ? (
          <div className="pointer-events-auto relative z-20 animate-spring-in px-4 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setViewState("search")}
              className="rounded-full bg-disco-navy px-8 sm:px-12 py-3.5 sm:py-4.5 font-['Lato'] text-base sm:text-xl font-extrabold text-disco-cream shadow-2xl border border-disco-cream/20 hover:border-disco-cream/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-sm"
            >
              Find my next favorite podcast
            </button>
          </div>
        ) : null}

        {/* State: Discovery Search Panel (Figma node 124-91) */}
        {viewState === "search" ? (
          <div
            className="pointer-events-auto w-full flex items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setViewState("landing");
              }
            }}
          >
            <DiscoverySearchCard
              isOpen={true}
              onClose={() => setViewState("landing")}
              onLaunchDiscovery={onLaunchDiscovery}
              onSearchPodcasts={onSearchPodcasts}
              onFastIngest={onFastIngest}
            />
          </div>
        ) : null}

        {/* State: Tinder-esque Discovery Deck */}
        {viewState === "discovery_deck" && seedPodcast ? (
          <div className="pointer-events-auto w-full flex items-start sm:items-center justify-center pb-28 sm:pb-8 my-auto">
            {discoveryLoading ? (
              <div className="rounded-3xl bg-disco-navy p-8 shadow-2xl border border-white/10 text-center space-y-3 animate-spring-in max-w-sm">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-disco-rose border-t-transparent" />
                <p className="text-sm font-bold text-disco-cream">
                  Finding podcasts similar to &ldquo;{seedPodcast.title}&rdquo;...
                </p>
                <p className="text-xs text-disco-cream/60">
                  Curating listener hooks, vibe match, and playable clips...
                </p>
              </div>
            ) : (
              <TinderDiscoveryDeck
                seedTitle={seedPodcast.title}
                seedCoverArtUrl={seedPodcast.coverArtUrl}
                recommendations={discoveryRecommendations}
                onClose={() => setViewState("landing")}
                onExploreOnGlobe={onExploreRecommendationOnGlobe}
                onResetSearch={onResetSearch}
              />
            )}
          </div>
        ) : null}

        {/* State: Admin View (Grows from bottom-left Admin button) */}
        {viewState === "admin" ? (
          <div className="pointer-events-auto relative w-full flex-1 flex flex-col animate-grow-left">
            {/* Close Button on the corner of the view */}
            <button
              type="button"
              onClick={() => setViewState("landing")}
              aria-label="Close panel"
              className="animate-pop-in pointer-events-auto absolute -top-3.5 -right-3.5 sm:-top-4.5 sm:-right-4.5 md:-top-5 md:-right-5 z-40 flex h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-2xl border-2 border-disco-cream/20 hover:scale-110 active:scale-95 transition-transform cursor-pointer before:absolute before:-inset-3 before:content-['']"
            >
              <svg
                className="pointer-events-none h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Thick Bordered Admin View with balanced outer/inner radius */}
            <div className="w-full flex-1 min-h-[440px] sm:min-h-[500px] rounded-[20px] sm:rounded-[22px] md:rounded-[24px] bg-disco-rose p-[18px] sm:p-[22px] md:p-[26px] shadow-2xl flex flex-col">
              <div className="w-full h-full flex-1 rounded-[10px] sm:rounded-[11px] md:rounded-[12px] bg-disco-cream p-4 sm:p-6 md:p-8 flex flex-col">
                <HostAdminPanel
                  initialCode={claimCode}
                  isOffline={isOffline}
                  onLocateShowOnGlobe={(showId) => {
                    onSelectShow(showId);
                    setViewState("landing");
                  }}
                  onClose={() => setViewState("landing")}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* State: About View (Grows from bottom-right About button) */}
        {viewState === "about" ? (
          <div className="pointer-events-auto relative w-full flex-1 flex flex-col animate-grow-right">
            {/* Close Button on the corner of the view */}
            <button
              type="button"
              onClick={() => setViewState("landing")}
              aria-label="Close panel"
              className="animate-pop-in pointer-events-auto absolute -top-3.5 -right-3.5 sm:-top-4.5 sm:-right-4.5 md:-top-5 md:-right-5 z-40 flex h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-2xl border-2 border-disco-cream/20 hover:scale-110 active:scale-95 transition-transform cursor-pointer before:absolute before:-inset-3 before:content-['']"
            >
              <svg
                className="pointer-events-none h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Thick Bordered About View with balanced outer/inner radius */}
            <div className="w-full flex-1 min-h-[440px] sm:min-h-[500px] rounded-[20px] sm:rounded-[22px] md:rounded-[24px] bg-disco-caramel p-[18px] sm:p-[22px] md:p-[26px] shadow-2xl flex flex-col">
              <div className="w-full h-full flex-1 rounded-[10px] sm:rounded-[11px] md:rounded-[12px] bg-disco-cream p-4 sm:p-6 md:p-8 flex flex-col">
                <AboutPanel
                  onOpenLegal={(tab) =>
                    onOpenLegal ? onOpenLegal(tab) : handleOpenLegal(tab)
                  }
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* State: Saved / Liked Podcasts View */}
        {viewState === "saved" ? (
          <div className="pointer-events-auto relative w-full flex-1 flex flex-col animate-grow-center">
            {/* Close Button on the corner of the view */}
            <button
              type="button"
              onClick={() => setViewState("landing")}
              aria-label="Close panel"
              className="animate-pop-in pointer-events-auto absolute -top-3.5 -right-3.5 sm:-top-4.5 sm:-right-4.5 md:-top-5 md:-right-5 z-40 flex h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-2xl border-2 border-disco-cream/20 hover:scale-110 active:scale-95 transition-transform cursor-pointer before:absolute before:-inset-3 before:content-['']"
            >
              <svg
                className="pointer-events-none h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Thick Bordered Saved View with balanced outer/inner radius */}
            <div className="w-full flex-1 min-h-[440px] sm:min-h-[500px] rounded-[20px] sm:rounded-[22px] md:rounded-[24px] bg-rose-500 p-[18px] sm:p-[22px] md:p-[26px] shadow-2xl flex flex-col">
              <div className="w-full h-full flex-1 rounded-[10px] sm:rounded-[11px] md:rounded-[12px] bg-disco-cream p-4 sm:p-6 md:p-8 flex flex-col">
                <SavedPodcastsPanel
                  onLocateShowOnGlobe={(showId) => {
                    onSelectShow(showId);
                    setViewState("landing");
                  }}
                  onClose={() => setViewState("landing")}
                  onStartDiscovery={() => setViewState("search")}
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Bottom Bar: Pinned inside 100dvh viewport with safe area padding */}
      <footer
        className={`relative z-20 pb-3 sm:pb-[30px] px-3 sm:px-[30px] pb-[max(0.75rem,env(safe-area-inset-bottom))] w-full flex justify-center shrink-0 transition-all duration-300 ${
          viewState === "discovery_deck"
            ? "hidden"
            : isExpandedView
              ? "opacity-0 pointer-events-none translate-y-6"
              : "opacity-100 translate-y-0"
        }`}
      >
        <div className="w-full max-w-md sm:max-w-none flex items-center justify-between gap-2 sm:gap-3 rounded-full bg-disco-navy/40 p-1.5 sm:p-2.5 border border-white/5 backdrop-blur-md shadow-xl">
          {/* Admin Button */}
          <button
            type="button"
            onClick={() => setViewState("admin")}
            className="rounded-full bg-disco-rose px-4 sm:px-14 py-2 sm:py-3 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider text-disco-dark shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center select-none"
          >
            Admin
          </button>

          {/* Center Title: PODCAST DISCOVERY & Heart Icon */}
          <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-3 overflow-hidden px-1 sm:px-2">
            <span className="hidden sm:inline font-['Lato'] font-extrabold uppercase text-disco-cream/80 text-xs sm:text-sm tracking-[0.6em] pl-[0.6em] select-none text-center whitespace-nowrap">
              PODCAST DISCOVERY
            </span>
            <button
              type="button"
              onClick={() => setViewState(viewState === "saved" ? "landing" : "saved")}
              title={likedCount > 0 ? `${likedCount} liked podcasts` : "Liked podcasts"}
              aria-label="View Liked Podcasts"
              className={`group flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                viewState === "saved"
                  ? "bg-rose-500 text-white shadow-lg scale-105"
                  : "bg-white/10 hover:bg-rose-500/20 text-disco-cream hover:text-rose-400 border border-white/10 hover:border-rose-400/40"
              }`}
            >
              <Heart
                className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${
                  likedCount > 0 || viewState === "saved"
                    ? "fill-rose-500 text-rose-500"
                    : "text-disco-cream/70 group-hover:text-rose-400"
                }`}
              />
              {likedCount > 0 ? (
                <span className="font-mono text-[11px] font-extrabold">
                  {likedCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* About Button */}
          <button
            type="button"
            onClick={() => setViewState("about")}
            className="rounded-full bg-disco-caramel px-4 sm:px-14 py-2 sm:py-3 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider text-disco-dark shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            About
          </button>
        </div>
      </footer>

      {/* Legal & Zero-Question Takedown Modal */}
      <LegalModal
        isOpen={localLegalOpen}
        initialTab={localLegalTab}
        prefilledShow={localPrefilledShow}
        onClose={() => {
          setLocalLegalOpen(false);
          setLocalPrefilledShow(null);
        }}
      />
    </div>
  );
}

function PanelFallback({ label }: { label: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-disco-dark/70 p-4 text-sm text-disco-cream/70">
      {label}
    </section>
  );
}
