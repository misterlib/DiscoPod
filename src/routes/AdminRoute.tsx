/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useConvex, useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  useSignInWithPassword,
  useSignUpWithPassword,
} from "@convex-dev/auth/providers/password/react";

import {
  Lock,
  LogOut,
  ShieldAlert,
  KeyRound,
  Crown,
  Shield,
  ShieldCheck,
  Clock,
  Users,
  UserCheck,
  UserX,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Mail,
  Send,
  Check,
  Trash2,
  AlertTriangle,
  Radio,
  Plug,
  Sprout,
  Pencil,
  X,
  ExternalLink,
  TrendingUp,
  Headphones,
  MousePointerClick,
  UserRound,
  Search,
  ChevronDown,
} from "lucide-react";

import { api } from "../convexApi";
import type { Id } from "../../convex/_generated/dataModel";
import logoLightSvg from "../assets/logo-light.svg";

type ActiveTab = "shows" | "integrations" | "team" | "seed";

interface CurrentUser {
  _id: Id<"users">;
  username: string;
  role: "superadmin" | "admin" | "pending";
  approvedAt?: number;
  approvedBy?: Id<"users">;
}

interface AdminUserItem {
  _id: Id<"users">;
  _creationTime: number;
  username: string;
  role: "superadmin" | "admin" | "pending";
  approvedAt?: number;
  approvedBy?: Id<"users">;
}


interface DeepDiveShow {
  showId: string;
  title: string;
  slug: string;
  description: string;
  rssUrl: string;
  websiteUrl: string;
  coverArtUrl: string;
  hostName: string;
  hostEmail: string;
  isClaimed: boolean;
  claimedByUserId?: string;
  isAmped?: boolean;
  ampScore?: number;
  coordinates: { x: number; y: number; z: number };
}

interface DeepDiveEpisode {
  episodeId: string;
  title: string;
  audioUrl: string;
  pubDate: number;
  durationSeconds: number;
  summary: string;
}

interface DeepDiveSnippet {
  snippetId: string;
  episodeId: string;
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  isValidDuration: boolean;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
  energyLevel?: string;
  curatorScore?: number;
  topic?: string;
  alternativeMomentsConsidered?: string;
  vectorDimensions: number;
  vectorPreview: number[];
  vectorNorm: number;
  playCount: number;
  upvotes: number;
}

interface DeepDiveClaim {
  claimId: string;
  inboxThreadId: string;
  claimStatus: "pending" | "verified" | "rejected";
  token: string;
}

interface DiscoveredHost {
  name: string;
  handle?: string;
  role?: string;
  bio?: string;
}

interface DiscoveredSocials {
  youtube?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
  newsletter?: string;
  spotify?: string;
  apple?: string;
}

interface DiscoveredClip {
  title: string;
  url?: string;
  platform: string;
  timestamp?: string;
  description?: string;
}

interface FirecrawlReport {
  summary: string;
  searchesRun: string[];
  sourcesScraped: string[];
  discoveredClips: Array<{
    title: string;
    url: string;
    platform: string;
    timestamp?: string;
  }>;
  listenerSentiment: string;
  researchMarkdown: string;
  researchedAt: number;
  latencyMs: number;
}

interface DeepDiveData {
  show: DeepDiveShow;
  firecrawlSignals: {
    reviews: string;
    socialLinks: string[];
    officialWebsite: string;
    source: "stored" | "derived";
  };
  episodes: DeepDiveEpisode[];
  snippets: DeepDiveSnippet[];
  claims: DeepDiveClaim[];
  hosts?: DiscoveredHost[];
  socialProfiles?: DiscoveredSocials;
  platformLinks?: {
    spotify?: string;
    apple?: string;
    youtube?: string;
  };
  highlightClips?: DiscoveredClip[];
  firecrawlReport?: FirecrawlReport;
  openAiCurationReport?: {
    summary: string;
    fallInLovePromise: string;
    curationMarkdown: string;
    clipsEvaluated: number;
    clipsSelected: number;
    curatedClips: Array<{
      episodeTitle: string;
      startTime: number;
      endTime: number;
      duration: number;
      hookText: string;
      transcriptExcerpt: string;
      whyYouWillLikeIt: string;
      audioUrl?: string;
      energyLevel?: string;
      curatorScore?: number;
      topic?: string;
      alternativeMomentsConsidered?: string;
    }>;
    curatedAt: number;
    latencyMs: number;
  };
}

interface AdminShowSummary {
  showId: string;
  title: string;
  slug: string;
  rssUrl?: string;
  hostName?: string;
  hostEmail?: string;
  isAmped?: boolean;
  ampScore?: number;
  isClaimed: boolean;
  coordinates: { x: number; y: number; z: number };
  episodeCount: number;
  snippetCount: number;
  inboxThreadId?: string;
  claimToken?: string;
  claimStatus?: string;
}

interface AdminClaimSummary {
  claimId: string;
  showId: string;
  showTitle: string;
  inboxThreadId: string;
  claimStatus: "pending" | "verified" | "rejected";
  token: string;
}

interface AdminStats {
  counts: {
    shows: number;
    episodes: number;
    snippets: number;
    territoryClaims: number;
  };
  shows: AdminShowSummary[];
  claims: AdminClaimSummary[];
}

interface EnvHealth {
  openaiConfigured: boolean;
  firecrawlConfigured: boolean;
  agentmailConfigured: boolean;
  webhookSecretConfigured: boolean;
}

interface PodcastCandidate {
  appleId: string;
  title: string;
  hostName: string;
  coverArtUrl: string;
  genre: string;
  feedUrl: string;
  releaseDate: string;
  isRecent: boolean;
  rank: number;
  description: string;
}

interface EnrichedClip {
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
}

interface SeededShowDetail {
  showId: string;
  title: string;
  hostName: string;
  websiteUrl: string;
  hostEmail: string;
  firecrawlSignals: {
    reviews: string;
    socialLinks: string[];
    officialWebsite: string;
  };
  clips: EnrichedClip[];
}

const GENRES = [
  { id: "all", name: "🔥 All Categories (Overall Top 50)" },
  { id: "technology", name: "Technology" },
  { id: "business", name: "Business" },
  { id: "comedy", name: "Comedy" },
  { id: "true-crime", name: "True Crime" },
  { id: "news", name: "News" },
  { id: "science", name: "Science" },
  { id: "society", name: "Society & Culture" },
  { id: "sports", name: "Sports" },
  { id: "health", name: "Health & Fitness" },
  { id: "history", name: "History" },
  { id: "arts", name: "Arts" },
  { id: "tv-film", name: "TV & Film" },
  { id: "music", name: "Music" },
  { id: "education", name: "Education" },
  { id: "fiction", name: "Fiction" },
  { id: "design", name: "Design" },
];

const GENRE_MAP: Record<string, { id: string; name: string }> = {
  all: { id: "all", name: "All Categories" },
  technology: { id: "1318", name: "Technology" },
  business: { id: "1321", name: "Business" },
  science: { id: "1315", name: "Science" },
  "true-crime": { id: "1488", name: "True Crime" },
  comedy: { id: "1303", name: "Comedy" },
  design: { id: "1402", name: "Design" },
  music: { id: "1310", name: "Music" },
  news: { id: "1489", name: "News" },
  society: { id: "1324", name: "Society & Culture" },
  sports: { id: "1314", name: "Sports" },
  health: { id: "1512", name: "Health & Fitness" },
  history: { id: "1487", name: "History" },
  arts: { id: "1301", name: "Arts" },
  "tv-film": { id: "1309", name: "TV & Film" },
  education: { id: "1304", name: "Education" },
  fiction: { id: "1483", name: "Fiction" },
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

async function fetchApplePodcastsClient({
  genre,
  query,
  selection,
  recentOnly,
  limit = 50,
}: {
  genre: string;
  query?: string;
  selection: "top" | "random";
  recentOnly: boolean;
  limit?: number;
}): Promise<PodcastCandidate[]> {
  const now = Date.now();
  const genreInfo = GENRE_MAP[genre.toLowerCase()] ?? { id: "1318", name: "Technology" };

  let rawResults: PodcastCandidate[] = [];

  if (query?.trim() || selection === "random") {
    const term = query?.trim() || genreInfo.name;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=podcast&limit=100`,
    );
    if (!res.ok) throw new Error(`iTunes search error: ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        collectionId?: number;
        collectionName?: string;
        artistName?: string;
        artworkUrl600?: string;
        artworkUrl100?: string;
        primaryGenreName?: string;
        feedUrl?: string;
        releaseDate?: string;
      }>;
    };
    rawResults = (data.results || [])
      .filter((item) => item.collectionName && item.feedUrl)
      .map((item) => ({
        appleId: String(item.collectionId || ""),
        title: item.collectionName || "Unknown Show",
        hostName: item.artistName || "Unknown Host",
        coverArtUrl: item.artworkUrl600 || item.artworkUrl100 || "",
        genre: item.primaryGenreName || genreInfo.name,
        feedUrl: item.feedUrl || "",
        releaseDate: item.releaseDate || new Date().toISOString(),
        isRecent: false,
        rank: 0,
        description: "",
      }));
    if (selection === "random") {
      rawResults.sort(() => Math.random() - 0.5);
    }
  } else {
    const chartUrl =
      genreInfo.id === "all"
        ? `https://itunes.apple.com/us/rss/toppodcasts/limit=100/json`
        : `https://itunes.apple.com/us/rss/toppodcasts/limit=100/genre=${genreInfo.id}/json`;

    const chartRes = await fetch(chartUrl);
    if (!chartRes.ok) throw new Error(`Apple top charts error: ${chartRes.status}`);
    const data = (await chartRes.json()) as {
      feed?: {
        entry?: Array<{
          id?: { attributes?: { "im:id"?: string } };
          "im:name"?: { label?: string };
          "im:artist"?: { label?: string };
          summary?: { label?: string };
          "im:image"?: Array<{ label?: string }>;
          category?: { attributes?: { label?: string } };
        }>;
      };
    };
    const entries = data.feed?.entry || [];
    const topIds = entries
      .map((e) => e.id?.attributes?.["im:id"])
      .filter((id): id is string => Boolean(id))
      .slice(0, 75);

    if (topIds.length > 0) {
      const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${topIds.join(",")}`);
      if (lookupRes.ok) {
        const lookupData = (await lookupRes.json()) as {
          results?: Array<{
            collectionId?: number;
            collectionName?: string;
            artistName?: string;
            artworkUrl600?: string;
            artworkUrl100?: string;
            primaryGenreName?: string;
            feedUrl?: string;
            releaseDate?: string;
          }>;
        };
        const lookupMap = new Map(
          (lookupData.results || []).map((item) => [String(item.collectionId), item]),
        );
        rawResults = entries
          .map((entry) => {
            const appleId = entry.id?.attributes?.["im:id"] || "";
            const item = lookupMap.get(appleId);
            return {
              appleId,
              title: item?.collectionName || entry["im:name"]?.label || "",
              hostName: item?.artistName || entry["im:artist"]?.label || "",
              coverArtUrl:
                item?.artworkUrl600 ||
                entry["im:image"]?.[entry["im:image"].length - 1]?.label ||
                "",
              genre:
                item?.primaryGenreName ||
                entry.category?.attributes?.label ||
                genreInfo.name,
              feedUrl: item?.feedUrl || "",
              releaseDate: item?.releaseDate || new Date().toISOString(),
              isRecent: false,
              rank: 0,
              description: entry.summary?.label || "",
            };
          })
          .filter((item) => item.title && item.feedUrl);
      }
    }
  }

  return rawResults
    .map((item, idx) => {
      const releaseTime = Date.parse(item.releaseDate);
      const isRecent = !isNaN(releaseTime) && now - releaseTime <= FOUR_WEEKS_MS;
      return {
        ...item,
        isRecent,
        rank: idx + 1,
      };
    })
    .filter((item) => (recentOnly ? item.isRecent : true))
    .slice(0, limit);
}

export function AdminRoute() {
  const isConvexConfigured = Boolean(import.meta.env.VITE_CONVEX_URL);
  if (!isConvexConfigured) {
    return <AdminRouteOffline />;
  }
  return <AdminRouteLive />;
}

function AdminRouteOffline() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("discopod_owner_authenticated") === "true";
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setAuthError("Please enter the owner passcode.");
      return;
    }
    if (password.trim() === "discopod-admin" || password.trim() === "admin") {
      sessionStorage.setItem("discopod_owner_authenticated", "true");
      setIsAuthenticated(true);
    } else {
      setAuthError("Incorrect passcode. (Dev default: discopod-admin)");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("discopod_owner_authenticated");
    setIsAuthenticated(false);
    setPassword("");
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 font-['Lato'] flex items-center justify-center selection:bg-disco-rose selection:text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-disco-navy/40 backdrop-blur-xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
          <Link to="/" className="mb-6 transition hover:opacity-80">
            <img src={logoLightSvg} alt="DISCOPOD" className="h-9 w-auto drop-shadow" />
          </Link>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            Offline Demo Gate
          </div>

          <h2 className="mb-2 text-xl sm:text-2xl font-black uppercase tracking-tight text-disco-cream">
            Offline Admin Access
          </h2>

          <p className="mb-6 text-xs sm:text-sm text-disco-cream/70 leading-relaxed max-w-xs">
            Running in offline demo mode. Enter default developer passcode to preview the admin interface.
          </p>

          {authError && (
            <div className="w-full mb-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-bold text-rose-300 text-left flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter passcode (discopod-admin)"
              autoFocus
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-mono text-disco-cream placeholder:font-sans placeholder:text-white/30 focus:border-disco-rose focus:outline-none"
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-disco-rose hover:bg-disco-rose/90 text-disco-dark py-3 px-6 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              <span>Unlock Offline Dashboard</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 w-full flex items-center justify-between text-[11px] text-disco-cream/50">
            <span>Passcode: <code className="font-mono text-disco-cream/70">discopod-admin</code></span>
            <Link to="/" className="text-disco-rose hover:underline font-bold">
              &larr; Return to App
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 font-['Lato'] antialiased selection:bg-disco-rose selection:text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="transition hover:opacity-85">
              <img src={logoLightSvg} alt="DISCOPOD" className="h-8 sm:h-10 w-auto drop-shadow" />
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 shadow-sm">
              Offline Demo Mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Lock / Sign Out</span>
            </button>

            <Link
              to="/"
              className="rounded-full bg-disco-navy px-5 py-2 text-xs font-bold text-disco-cream border border-disco-cream/20 shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              &larr; Back to App
            </Link>
          </div>
        </header>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 text-center space-y-3">
          <h2 className="text-lg font-bold text-amber-200">No Convex URL Detected</h2>
          <p className="text-sm text-disco-cream/70 max-w-lg mx-auto">
            Please configure <code className="text-disco-rose">VITE_CONVEX_URL</code> in your{" "}
            <code className="text-disco-rose">.env.local</code> to connect this admin portal to a
            live Convex backend.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminRouteLive() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser) as CurrentUser | null | undefined;

  if (isAuthLoading || (isAuthenticated && currentUser === undefined)) {
    return (
      <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 flex items-center justify-center font-['Lato']">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-disco-rose border-t-transparent" />
          <p className="text-xs font-black uppercase tracking-wider text-disco-cream/70">
            Authenticating Admin Session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <AdminAuthScreen />;
  }

  if (currentUser.role === "pending") {
    return (
      <AdminPendingApprovalScreen
        currentUser={currentUser}
        onSignOut={() => void signOut()}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 font-['Lato'] antialiased selection:bg-disco-rose selection:text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="transition hover:opacity-85">
              <img src={logoLightSvg} alt="DISCOPOD" className="h-8 sm:h-10 w-auto drop-shadow" />
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <span className="rounded-full bg-disco-rose px-3.5 py-1 text-xs font-black uppercase tracking-wider text-disco-dark shadow-sm">
              Owner Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-disco-navy/50 px-3.5 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-disco-cream/80">Convex Live</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-xs">
              <span className="text-disco-cream/90 font-bold">@{currentUser.username}</span>
              {currentUser.role === "superadmin" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                  <Crown className="h-3 w-3 text-amber-400" /> Super Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> Admin
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>

            <Link
              to="/"
              className="rounded-full bg-disco-navy px-5 py-2 text-xs font-bold text-disco-cream border border-disco-cream/20 shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              &larr; Back to App
            </Link>
          </div>
        </header>

        <AdminDashboardLive currentUser={currentUser} />
      </div>
    </div>
  );
}

function AdminAuthScreen() {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const { signIn, pending: signInPending } = useSignInWithPassword(
    api.auth.signInWithPassword as Parameters<typeof useSignInWithPassword>[0],
  );
  const { signUp, pending: signUpPending } = useSignUpWithPassword(
    api.auth.signUpWithPassword as Parameters<typeof useSignUpWithPassword>[0],
  );

  const isPending = signInPending || signUpPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setAuthError("Please enter a username.");
      return;
    }
    if (!password) {
      setAuthError("Please enter a password.");
      return;
    }

    if (authMode === "signup") {
      if (password !== confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
      if (password.length < 10) {
        setAuthError("Password is too short. Minimum 10 characters required by Convex Auth.");
        return;
      }

      const res = await signUp({ username: trimmedUsername, password });
      if (res.status === "error") {
        if ("userError" in res) {
          switch (res.userError.error) {
            case "USERNAME_TAKEN":
              setAuthError("This username is already taken. Please choose another or sign in.");
              break;
            case "PASSWORD_TOO_SHORT": {
              const minLen =
                "minimumLength" in res.userError && typeof res.userError.minimumLength === "number"
                  ? res.userError.minimumLength
                  : 10;
              setAuthError(`Password is too short. Minimum ${minLen} characters required.`);
              break;
            }
            case "PASSWORD_TOO_COMMON":
              setAuthError("Password is too common or easily guessable. Please choose a stronger password.");
              break;
            case "USERNAME_TOO_SHORT":
              setAuthError("Username is too short.");
              break;
            case "USERNAME_HAS_INVALID_CHARACTERS":
              setAuthError("Username contains invalid characters.");
              break;
            case "USERNAME_HAS_SURROUNDING_WHITESPACE":
              setAuthError("Username cannot begin or end with spaces.");
              break;
            default:
              setAuthError(`Sign up error: ${res.userError.error}`);
              break;
          }
        } else {
          setAuthError("An unexpected error occurred during registration.");
        }
      }
    } else {
      const res = await signIn({ username: trimmedUsername, password });
      if (res.status === "error") {
        if ("userError" in res) {
          switch (res.userError.error) {
            case "USER_NOT_FOUND":
              setAuthError("No account found with this username. Please register first.");
              break;
            case "INVALID_CREDENTIALS":
              setAuthError("Incorrect password. Please verify credentials.");
              break;
            case "RATE_LIMITED":
              setAuthError("Account temporarily rate limited. Please retry in a moment.");
              break;
            default:
              setAuthError(`Sign in error: ${res.userError.error}`);
              break;
          }
        } else {
          setAuthError("An unexpected error occurred during sign in.");
        }
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 font-['Lato'] flex items-center justify-center selection:bg-disco-rose selection:text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-disco-navy/50 backdrop-blur-xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        <Link to="/" className="mb-5 transition hover:opacity-80">
          <img src={logoLightSvg} alt="DISCOPOD" className="h-9 w-auto drop-shadow" />
        </Link>

        {/* Hackathon Convex Auth v2 Badge */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#C47D54]/25 via-[#324158]/50 to-[#324158]/30 border border-[#C47D54]/40 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-disco-cream shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-[#C47D54]" />
          <span>Convex Auth v2 (Alpha)</span>
        </div>

        <h2 className="mb-2 text-xl sm:text-2xl font-black uppercase tracking-tight text-disco-cream">
          {authMode === "signin" ? "Admin Portal Login" : "Register Admin Account"}
        </h2>

        <p className="mb-5 text-xs text-disco-cream/70 leading-relaxed max-w-sm">
          {authMode === "signin"
            ? "Sign in with your Convex Auth v2 credentials to access DiscoPod's live management controls."
            : "First registered user automatically becomes Super Admin. Subsequent registrations require Super Admin approval."}
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mb-5 grid w-full grid-cols-2 rounded-xl bg-black/40 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setAuthMode("signin");
              setAuthError(null);
            }}
            className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              authMode === "signin"
                ? "bg-disco-rose text-disco-dark shadow"
                : "text-disco-cream/60 hover:text-disco-cream"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setAuthError(null);
            }}
            className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              authMode === "signup"
                ? "bg-disco-rose text-disco-dark shadow"
                : "text-disco-cream/60 hover:text-disco-cream"
            }`}
          >
            Create Account
          </button>
        </div>

        {authError && (
          <div className="w-full mb-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs font-bold text-rose-300 text-left flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-3.5 text-left">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-disco-cream/70 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or curator"
              autoFocus
              required
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-disco-cream placeholder:text-white/30 focus:border-disco-rose focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-disco-cream/70 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 10 characters"
              required
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-disco-cream placeholder:text-white/30 focus:border-disco-rose focus:outline-none font-mono"
            />
            {authMode === "signup" && (
              <p className="mt-1 text-[10px] text-disco-cream/50">
                Convex Auth enforces the NIST standard of at least 10 characters.
              </p>
            )}
          </div>

          {authMode === "signup" && (
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-disco-cream/70 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-disco-cream placeholder:text-white/30 focus:border-disco-rose focus:outline-none font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 rounded-xl bg-disco-rose hover:bg-disco-rose/90 disabled:opacity-50 text-disco-dark py-3 px-6 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            <KeyRound className="h-4 w-4" />
            <span>
              {isPending
                ? "Processing..."
                : authMode === "signin"
                ? "Sign In to Admin"
                : "Register Account"}
            </span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 w-full flex items-center justify-between text-[11px] text-disco-cream/50">
          <span className="text-left leading-tight">
            Role hierarchy: <span className="text-disco-cream/70">#1 Super Admin, #2+ Pending</span>
          </span>
          <Link to="/" className="text-disco-rose hover:underline font-bold">
            &larr; Return to App
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminPendingApprovalScreen({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-disco-dark text-disco-cream p-4 sm:p-8 font-['Lato'] flex items-center justify-center selection:bg-disco-rose selection:text-white">
      <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-disco-navy/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        <Link to="/" className="mb-5 transition hover:opacity-80">
          <img src={logoLightSvg} alt="DISCOPOD" className="h-9 w-auto drop-shadow" />
        </Link>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300">
          <Clock className="h-4 w-4 animate-spin text-amber-400" />
          <span>Pending Super Admin Approval</span>
        </div>

        <h2 className="mb-2 text-xl sm:text-2xl font-black uppercase tracking-tight text-disco-cream">
          Access On Hold
        </h2>

        <p className="mb-4 text-sm text-disco-cream/80 leading-relaxed">
          Welcome, <span className="font-bold text-amber-300">@{currentUser.username}</span>!
        </p>

        <p className="mb-6 text-xs text-disco-cream/60 leading-relaxed max-w-sm">
          Your account was registered via Convex Auth v2. DiscoPod’s security policy requires that all new admin accounts be reviewed and approved by the Super Admin before accessing dashboard controls.
        </p>

        <div className="w-full mb-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-disco-cream/50">Account ID</span>
            <span className="font-mono text-[11px] text-disco-cream/80 truncate max-w-[180px]">{currentUser._id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-disco-cream/50">Assigned Role</span>
            <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
              Pending Admin
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-disco-cream/50">Status Sync</span>
            <span className="text-emerald-400 text-[11px] flex items-center gap-1.5 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Reactive Listener
            </span>
          </div>
        </div>

        <p className="mb-6 text-[11px] text-disco-cream/50 italic">
          💡 This screen updates automatically the moment the Super Admin activates your account.
        </p>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-200 py-3 px-6 text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>

          <Link
            to="/"
            className="block w-full text-center text-xs font-bold text-disco-rose hover:underline"
          >
            &larr; Return to DiscoPod Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminTeamApprovalsPanel({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const users = useQuery(api.users.listUsers) as AdminUserItem[] | undefined;
  const updateUserRole = useMutation(api.users.updateUserRole);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  async function handleRoleChange(targetUserId: Id<"users">, newRole: "admin" | "pending") {
    setUpdatingUserId(targetUserId);
    setActionFeedback(null);
    try {
      await updateUserRole({ targetUserId, newRole });
      setActionFeedback({
        type: "success",
        message: `Successfully ${newRole === "admin" ? "approved" : "revoked"} user privileges.`,
      });
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update user role.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  }

  const pendingUsers = users?.filter((u) => u.role === "pending") ?? [];
  const activeAdmins = users?.filter((u) => u.role === "admin" || u.role === "superadmin") ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Intro card */}
      <div className="rounded-3xl border border-[#C47D54]/30 bg-gradient-to-r from-[#C47D54]/15 via-[#324158]/50 to-black/40 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#C47D54]/20 p-3 border border-[#C47D54]/30">
              <Users className="h-6 w-6 text-[#C47D54]" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-disco-cream flex items-center gap-2">
                <span>Admin Team &amp; Approvals</span>
                <span className="rounded-full bg-gradient-to-r from-[#C47D54] to-[#324158] text-white text-[10px] font-black px-2.5 py-0.5 uppercase tracking-wider border border-[#C47D54]/40 shadow-sm">
                  Convex Auth v2
                </span>
              </h3>
              <p className="text-xs text-disco-cream/70">
                Super Admin governance console: approve pending administrators and manage access control in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs text-disco-cream/80">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            <span>Logged in as Super Admin: <b className="text-disco-cream">@{currentUser.username}</b></span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10">
          <div className="rounded-2xl border border-white/5 bg-black/20 p-3.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-disco-cream/50">Total Registered</span>
            <div className="mt-1 text-2xl font-black text-disco-cream">{users?.length ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-3.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400/70">Approved Admins</span>
            <div className="mt-1 text-2xl font-black text-emerald-400">{activeAdmins.length}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-3.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400/70">Pending Approvals</span>
            <div className="mt-1 text-2xl font-black text-amber-400">{pendingUsers.length}</div>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`rounded-2xl border p-4 text-xs font-bold flex items-center gap-2.5 ${
            actionFeedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-rose-500/40 bg-rose-950/30 text-rose-300"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Pending Approvals Table */}
      <div className="rounded-3xl border border-amber-500/30 bg-disco-navy/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" />
            <h4 className="text-base font-black uppercase tracking-tight text-amber-300">
              Pending Admin Approvals ({pendingUsers.length})
            </h4>
          </div>
          <span className="text-xs text-disco-cream/50">
            Awaiting Super Admin activation
          </span>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-black/20 p-8 text-center text-xs text-disco-cream/50">
            No pending admin requests at this time. All registered users have been approved.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-disco-cream/50">
                <tr>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Registered</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-disco-cream text-sm">@{u.username}</div>
                      <div className="font-mono text-[10px] text-disco-cream/40">{u._id}</div>
                    </td>
                    <td className="py-3 px-3 text-disco-cream/70">
                      {new Date(u._creationTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                        Pending
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        disabled={updatingUserId === u._id}
                        onClick={() => void handleRoleChange(u._id, "admin")}
                        className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-disco-dark font-black text-xs px-3.5 py-1.5 shadow transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{updatingUserId === u._id ? "Approving..." : "Approve as Admin"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Team Table */}
      <div className="rounded-3xl border border-white/10 bg-disco-navy/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h4 className="text-base font-black uppercase tracking-tight text-disco-cream">
              Active Admin Team ({activeAdmins.length})
            </h4>
          </div>
          <span className="text-xs text-disco-cream/50">
            Users with authorized access to DiscoPod Admin
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-disco-cream/50">
              <tr>
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Approved Date</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeAdmins.map((u) => (
                <tr key={u._id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-3">
                    <div className="font-bold text-disco-cream text-sm flex items-center gap-1.5">
                      <span>@{u.username}</span>
                      {u._id === currentUser._id && (
                        <span className="rounded-full bg-disco-rose/20 text-disco-rose text-[9px] font-black px-2 py-0.5 uppercase">You</span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-disco-cream/40">{u._id}</div>
                  </td>
                  <td className="py-3 px-3">
                    {u.role === "superadmin" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                        <Crown className="h-3 w-3 text-amber-400" /> Super Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                        <Shield className="h-3 w-3 text-emerald-400" /> Admin
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-disco-cream/70">
                    {u.approvedAt ? new Date(u.approvedAt).toLocaleString() : "Initial System Setup"}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {u.role === "superadmin" ? (
                      <span className="text-[11px] text-disco-cream/40 italic">Protected</span>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingUserId === u._id}
                        onClick={() => void handleRoleChange(u._id, "pending")}
                        className="rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-bold text-xs px-3 py-1.5 transition cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>{updatingUserId === u._id ? "Updating..." : "Revoke Admin"}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminSegmentedControl({
  activeTab,
  onChangeTab,
  pendingCount,
}: {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  pendingCount: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });
  const [isInitialMount, setIsInitialMount] = useState(true);

  const updateIndicator = useCallback(() => {
    const el = buttonRefs.current[activeTab];
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: true,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    const container = containerRef.current;
    if (!container) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateIndicator();
      });
      ro.observe(container);
    }
    window.addEventListener("resize", updateIndicator);

    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 50);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateIndicator);
      clearTimeout(timer);
    };
  }, [updateIndicator]);

  const tabs: Array<{
    id: ActiveTab;
    label: string;
    icon?: React.ReactNode;
    badge?: number;
  }> = [
    { id: "shows", label: "Shows", icon: <Radio className="h-3.5 w-3.5" /> },
    { id: "integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
    { id: "team", label: "Team", icon: <Users className="h-3.5 w-3.5" />, badge: pendingCount },
    { id: "seed", label: "Seed", icon: <Sprout className="h-3.5 w-3.5" /> },
  ];

  const handleTabClick = (tabId: ActiveTab) => {
    onChangeTab(tabId);
    const el = buttonRefs.current[tabId];
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: true,
      });
    }
  };

  return (
    <div className="flex items-center justify-start border-b border-white/10 pb-4">
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Admin Navigation"
        className="relative inline-flex max-w-full items-center rounded-2xl bg-[#1d2636]/90 p-1.5 border border-white/10 shadow-inner backdrop-blur-md overflow-x-auto select-none"
      >
        {/* Sliding background pill */}
        <div
          aria-hidden="true"
          className="absolute rounded-xl bg-[#C47D54] shadow-md pointer-events-none"
          style={{
            left: `${indicatorStyle.left}px`,
            top: `${indicatorStyle.top}px`,
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.ready && indicatorStyle.width > 0 ? 1 : 0,
            transition: isInitialMount ? "none" : "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttonRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              className={`relative z-10 rounded-xl px-5 py-2 text-xs sm:text-sm font-black uppercase tracking-wider transition-colors duration-200 cursor-pointer flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-none select-none ${
                isActive
                  ? "text-disco-dark"
                  : "text-disco-cream/70 hover:text-disco-cream hover:bg-white/5"
              }`}
              style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            >
              {tab.icon ? <span>{tab.icon}</span> : null}
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black transition-colors ${
                    isActive
                      ? "bg-disco-dark text-white"
                      : "bg-rose-500 text-white animate-pulse"
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResetDatabaseModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  counts,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  counts?: {
    shows: number;
    episodes: number;
    snippets: number;
    territoryClaims: number;
  };
}) {
  const [typedPhrase, setTypedPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const REQUIRED_PHRASE = "RESET DATABASE";

  useEffect(() => {
    if (!isOpen) {
      setTypedPhrase("");
      setAcknowledged(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const isPhraseMatch = typedPhrase.trim() === REQUIRED_PHRASE;
  const canProceed = isPhraseMatch && acknowledged && !isDeleting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#161c28] p-6 sm:p-8 space-y-6 shadow-2xl shadow-rose-950/60 text-disco-cream">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-rose-500/20 p-3 border border-rose-500/40 text-rose-400 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
              Danger Zone &bull; Destructive Action
            </span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Wipe Entire Database?
            </h3>
            <p className="mt-1 text-xs text-disco-cream/70 leading-relaxed">
              This action is <strong className="text-rose-300">immediate and irreversible</strong>. All podcasts, episodes, snippets, and claims will be purged.
            </p>
          </div>
        </div>

        {/* Breakdown of items to be deleted */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3.5 space-y-1.5 text-xs text-rose-200/90">
          <div className="font-bold text-rose-300 text-[11px] uppercase tracking-wider">
            Items to be deleted:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-disco-cream/80">
            <li>{counts?.shows ?? 0} Podcasts &amp; Host Profiles</li>
            <li>{counts?.episodes ?? 0} Episodes &amp; Audio URLs</li>
            <li>{counts?.snippets ?? 0} Vector Embeddings &amp; Reel Clips</li>
            <li>{counts?.territoryClaims ?? 0} Show Claims &amp; Claim Tokens</li>
          </ul>
        </div>

        {/* Difficult confirmation: typed phrase */}
        <div className="space-y-2">
          <label htmlFor="confirm-phrase-input" className="block text-xs font-bold text-disco-cream/90">
            To confirm, type <span className="font-mono font-black text-rose-400 select-all bg-black/40 px-1.5 py-0.5 rounded border border-rose-500/30">{REQUIRED_PHRASE}</span> below:
          </label>
          <input
            id="confirm-phrase-input"
            type="text"
            autoFocus
            value={typedPhrase}
            onChange={(e) => setTypedPhrase(e.target.value)}
            placeholder={REQUIRED_PHRASE}
            disabled={isDeleting}
            className="w-full rounded-xl border border-rose-500/40 bg-black/60 px-4 py-2.5 text-sm font-mono text-white placeholder:text-disco-cream/20 focus:border-rose-400 focus:outline-none shadow-inner"
          />
        </div>

        {/* Checkbox confirmation */}
        <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-disco-cream/80">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isDeleting}
            className="mt-0.5 h-4 w-4 rounded border-rose-500/40 bg-black/50 text-rose-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span>I understand that all podcast data will be permanently wiped from Convex and cannot be recovered.</span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl px-4 py-2 text-xs font-bold text-disco-cream/70 hover:text-disco-cream hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!canProceed}
            className={`rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
              canProceed
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 active:scale-95"
                : "bg-rose-950/30 text-rose-300/30 border border-rose-500/20 cursor-not-allowed"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? "Wiping Database..." : "Permanently Wipe Database"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailHistoryModal({
  show,
  onClose,
  onInspect,
}: {
  show: AdminShowSummary;
  onClose: () => void;
  onInspect: (showId: string) => void;
}) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [isDispatchingTraction, setIsDispatchingTraction] = useState(false);
  const [tractionNotice, setTractionNotice] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const analytics = useQuery(api.analytics.getShowAnalytics, {
    showId: show.showId as Id<"shows">,
  });
  const triggerManualTraction = useAction(api.analytics.triggerManualTractionNotification);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleCopyToken(token: string) {
    void navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  async function handleSendTestTractionEmail() {
    setIsDispatchingTraction(true);
    setTractionNotice(null);
    try {
      const res = await triggerManualTraction({
        showId: show.showId as Id<"shows">,
      });
      setTractionNotice(res);
    } catch (err) {
      setTractionNotice({
        success: false,
        message: err instanceof Error ? err.message : "Failed to trigger traction notification.",
      });
    } finally {
      setIsDispatchingTraction(false);
    }
  }

  const hasThread = Boolean(show.inboxThreadId);
  const isClaimed = show.isClaimed;

  const totalListens = analytics?.totalListens ?? 0;
  const totalSkips = analytics?.totalSkips ?? 0;
  const totalClicks = analytics?.totalChannelClicks ?? 0;
  const conversionRate = analytics?.conversionRate ?? 0;
  const tractionNotifiedAt = analytics?.tractionNotifiedAt;
  const hasMetThreshold = totalListens >= 3 || totalClicks >= 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-disco-navy/95 p-6 shadow-2xl space-y-5 text-disco-cream">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/20 border border-purple-500/30 p-2.5 text-purple-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-disco-cream leading-tight">
                Email &amp; AgentMail History
              </h3>
              <p className="text-xs text-disco-cream/60 truncate max-w-sm">{show.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-disco-cream/60 hover:text-disco-cream hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Host Contact Information from Firecrawl */}
        <div className="rounded-2xl border border-white/10 bg-disco-dark/50 p-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-disco-cream/50">
            Host &amp; Discovery Contact
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-disco-cream/50 block text-[10px]">Host Name</span>
              <span className="font-semibold text-disco-cream">{show.hostName || "Not detected in RSS"}</span>
            </div>
            <div>
              <span className="text-disco-cream/50 block text-[10px]">Host Email (Firecrawl/RSS)</span>
              {show.hostEmail ? (
                <span className="font-mono text-emerald-300 font-semibold">{show.hostEmail}</span>
              ) : (
                <span className="text-disco-cream/40 italic">None detected</span>
              )}
            </div>
          </div>
        </div>

        {/* Listener Traction & Clip Quality Engine */}
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Listener Traction &amp; Clip Quality
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                tractionNotifiedAt
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : hasMetThreshold
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-cyan-500/10 text-cyan-300/70 border border-cyan-500/20"
              }`}
            >
              {tractionNotifiedAt
                ? `✓ Notified (${new Date(tractionNotifiedAt).toLocaleDateString()})`
                : hasMetThreshold
                ? "Milestone Hit (Pending Outbound)"
                : "Awaiting Traction"}
            </span>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-center">
              <div className="flex items-center justify-center text-cyan-400 mb-1">
                <Headphones className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-black text-white">{totalListens}</div>
              <div className="text-[10px] text-disco-cream/50 uppercase tracking-wider font-semibold">Listens</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-center">
              <div className="flex items-center justify-center text-amber-400 mb-1">
                <Radio className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-black text-white">{totalSkips}</div>
              <div className="text-[10px] text-disco-cream/50 uppercase tracking-wider font-semibold">Skips</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-center">
              <div className="flex items-center justify-center text-emerald-400 mb-1">
                <MousePointerClick className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-black text-white">{totalClicks}</div>
              <div className="text-[10px] text-disco-cream/50 uppercase tracking-wider font-semibold">Clicks</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-center">
              <div className="flex items-center justify-center text-purple-400 mb-1">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-black text-white">{conversionRate}%</div>
              <div className="text-[10px] text-disco-cream/50 uppercase tracking-wider font-semibold">Conv Rate</div>
            </div>
          </div>

          {/* Channel breakdown if available */}
          {analytics?.channelBreakdown && Object.keys(analytics.channelBreakdown).length > 0 ? (
            <div className="text-[11px] text-disco-cream/70 flex items-center gap-1.5 flex-wrap">
              <span className="text-disco-cream/40">External channels clicked:</span>
              {Object.entries(analytics.channelBreakdown).map(([ch, count]) => (
                <span key={ch} className="rounded bg-cyan-900/40 px-1.5 py-0.5 text-cyan-200 border border-cyan-700/40">
                  {ch}: <b>{Number(count)}</b>
                </span>
              ))}
            </div>
          ) : null}

          {/* Milestone requirement info & Test action button */}
          <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between gap-2">
            <p className="text-[10px] text-cyan-200/60 leading-tight">
              Hosts receive <em>&quot;{show.title} is getting noticed on DiscoPod&quot;</em> after ≥3 listens or ≥1 channel clickout.
            </p>
            <button
              type="button"
              onClick={() => void handleSendTestTractionEmail()}
              disabled={isDispatchingTraction || !show.hostEmail}
              className="shrink-0 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-3 w-3" />
              <span>{isDispatchingTraction ? "Sending..." : "Test Traction Email"}</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {tractionNotice ? (
            <div
              className={`rounded-xl border p-2.5 text-xs flex items-center gap-2 ${
                tractionNotice.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {tractionNotice.success ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{tractionNotice.message}</span>
            </div>
          ) : null}
        </div>

        {/* Claim & AgentMail Thread Status */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
              AgentMail Thread &amp; Claim Record
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isClaimed
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : hasThread
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/10 text-disco-cream/60"
              }`}
            >
              {isClaimed ? "✓ Verified Host" : hasThread ? "Pending Claim" : "Unclaimed"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-purple-300/60 block text-[10px] font-mono">AgentMail Thread ID</span>
              {show.inboxThreadId ? (
                <span className="font-mono text-purple-200 bg-purple-900/40 px-2 py-1 rounded inline-block text-[11px] break-all border border-purple-500/30">
                  {show.inboxThreadId}
                </span>
              ) : (
                <span className="text-disco-cream/40 italic">
                  {tractionNotifiedAt
                    ? "Pending initial webhook response."
                    : "Quiet mode: Waiting for listener traction before dispatching claim email."}
                </span>
              )}
            </div>

            {show.claimToken ? (
              <div className="space-y-1">
                <span className="text-purple-300/60 block text-[10px] font-mono">Claim Verification Token</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-purple-200 bg-purple-900/40 px-2 py-1 rounded text-[11px] border border-purple-500/30">
                    {show.claimToken}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyToken(show.claimToken!)}
                    className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 underline cursor-pointer"
                  >
                    {copiedToken ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Direct AgentMail Dashboard Link */}
          <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between">
            <span className="text-[11px] text-purple-200/70">AgentMail Inbox:</span>
            <a
              href="https://agentmail.to/inbox/discopod"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-purple-200 underline"
            >
              <span>View in AgentMail Console</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-disco-cream/70 hover:text-disco-cream hover:bg-white/5 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onInspect(show.showId)}
            className="rounded-xl bg-[#C47D54] hover:bg-[#b06f4a] px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow"
          >
            <span>Deep Dive &amp; QA</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardLive({ currentUser }: { currentUser?: CurrentUser }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("shows");
  const [showsSubView, setShowsSubView] = useState<"explorer" | "inspector">("explorer");
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const stats = useQuery(api.admin.getDatabaseStats, {}) as AdminStats | undefined;
  const envHealth = useQuery(api.admin.checkEnvHealth, {}) as EnvHealth | undefined;
  const allUsers = useQuery(api.users.listUsers) as AdminUserItem[] | undefined;
  const pendingCount = allUsers?.filter((u) => u.role === "pending").length ?? 0;

  useEffect(() => {
    if (!selectedShowId && stats?.shows && stats.shows.length > 0) {
      const firstShow = stats.shows[0];
      if (firstShow) {
        setSelectedShowId(firstShow.showId);
      }
    }
  }, [selectedShowId, stats?.shows]);

  const clearDatabase = useMutation(api.admin.clearDatabase);

  const [clearing, setClearing] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Active previewed show / clip
  const [activeSeededShow, setActiveSeededShow] = useState<SeededShowDetail | null>(null);

  // Host Email editing & Email History state
  const updateShowHostEmail = useMutation(api.shows.updateShowHostEmail);
  const [editingEmailShowId, setEditingEmailShowId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailHistoryModalShow, setEmailHistoryModalShow] = useState<AdminShowSummary | null>(null);

  async function handleSaveHostEmail(showId: string) {
    setSavingEmail(true);
    try {
      await updateShowHostEmail({
        showId: showId as Id<"shows">,
        hostEmail: editingEmailValue.trim(),
      });
      setEditingEmailShowId(null);
      setFeedbackMessage({
        type: "success",
        text: `Host email updated to "${editingEmailValue.trim() || "(cleared)"}".`,
      });
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update host email.",
      });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleClearDatabase() {
    setClearing(true);
    setFeedbackMessage(null);
    try {
      const res = await clearDatabase({});
      setShowResetDialog(false);
      setActiveSeededShow(null);
      setFeedbackMessage({
        type: "info",
        text: `Database wiped: ${res.clearedShows} shows, ${res.clearedEpisodes} episodes, ${res.clearedSnippets} snippets, and ${res.clearedClaims} claims permanently removed.`,
      });
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to wipe database.",
      });
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Shows"
          value={stats ? stats.counts.shows : "..."}
          color="border-disco-rose/40"
        />
        <MetricCard
          label="Episodes"
          value={stats ? stats.counts.episodes : "..."}
          color="border-disco-caramel/40"
        />
        <MetricCard
          label="Snippets"
          value={stats ? stats.counts.snippets : "..."}
          color="border-emerald-500/40"
        />
        <MetricCard
          label="Claims"
          value={stats ? stats.counts.territoryClaims : "..."}
          color="border-purple-500/40"
        />
      </div>

      {/* Global Action Feedback Alert */}
      {feedbackMessage ? (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-sm border transition ${
            feedbackMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
              : feedbackMessage.type === "error"
                ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
                : "bg-disco-navy/60 border-disco-caramel/50 text-disco-cream"
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs underline hover:opacity-80 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Navigation Tabs (Segmented Control) */}
      <AdminSegmentedControl
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingCount={pendingCount}
      />

      {/* TAB 1: Shows (Sub-view: Deep Dive & QA Inspector) */}
      {activeTab === "shows" && showsSubView === "inspector" ? (
        <ShowInspectorAndQaSection
          shows={stats?.shows ?? []}
          selectedShowId={selectedShowId}
          onSelectShowId={(id) => setSelectedShowId(id)}
          onNavigateToDiscovery={() => setActiveTab("seed")}
          onBackToExplorer={() => setShowsSubView("explorer")}
        />
      ) : null}

      {/* TAB 1: Shows (Sub-view: Database & Shows Explorer) */}
      {activeTab === "shows" && showsSubView === "explorer" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Shows Explorer */}
          <div className="rounded-2xl border border-white/10 bg-disco-navy/20 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
                Shows in Database ({stats?.shows.length ?? 0})
              </h3>
              {stats && stats.shows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedShowId && stats.shows[0]) {
                      setSelectedShowId(stats.shows[0].showId);
                    }
                    setShowsSubView("inspector");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#C47D54]/40 bg-[#C47D54]/15 hover:bg-[#C47D54]/25 px-3.5 py-1.5 text-xs font-bold text-disco-cream transition cursor-pointer"
                >
                  <span>Open Deep Dive &amp; QA</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#C47D54]" />
                </button>
              ) : null}
            </div>

            {!stats || stats.shows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-disco-cream/60 text-xs">
                No shows in database. Go to the &ldquo;Seed&rdquo; tab to discover and seed real podcasts!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-disco-cream/80">
                  <thead className="border-b border-white/10 text-[11px] font-black uppercase tracking-wider text-disco-cream/50">
                    <tr>
                      <th className="py-3 px-3">Title / Host</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Episodes</th>
                      <th className="py-3 px-3">Snippets</th>
                      <th className="py-3 px-3">Host Email (Firecrawl)</th>
                      <th className="py-3 px-3">Claim</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.shows.map((show) => (
                      <tr key={show.showId} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3 font-semibold text-disco-cream">
                          <div>{show.title}</div>
                          <div className="text-[10px] text-disco-cream/50 font-normal">
                            {show.hostName ?? "No host"} &bull; {show.slug}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {show.isClaimed ? (
                            <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 font-bold text-[10px]">
                              ✓ Verified Host
                            </span>
                          ) : (
                            <span className="rounded bg-white/10 text-disco-cream/60 px-2 py-0.5 text-[10px]">
                              Unclaimed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">{show.episodeCount}</td>
                        <td className="py-3 px-3">{show.snippetCount}</td>
                        <td className="py-3 px-3">
                          {editingEmailShowId === show.showId ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="email"
                                value={editingEmailValue}
                                onChange={(e) => setEditingEmailValue(e.target.value)}
                                placeholder="host@podcast.com"
                                className="rounded bg-black/60 border border-amber-400/50 px-2 py-1 text-[11px] text-disco-cream font-mono focus:outline-none focus:border-amber-400 w-44"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSaveHostEmail(show.showId);
                                  if (e.key === "Escape") setEditingEmailShowId(null);
                                }}
                              />
                              <button
                                type="button"
                                disabled={savingEmail}
                                onClick={() => void handleSaveHostEmail(show.showId)}
                                className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50 cursor-pointer"
                                title="Save Email"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingEmailShowId(null)}
                                className="p-1 rounded bg-white/10 text-disco-cream/60 hover:bg-white/20 transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 group">
                                {show.hostEmail ? (
                                  <span className="font-mono text-[11px] text-disco-cream/90">{show.hostEmail}</span>
                                ) : (
                                  <span className="text-[10px] text-disco-cream/40 italic">No email from Firecrawl</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmailShowId(show.showId);
                                    setEditingEmailValue(show.hostEmail || "");
                                  }}
                                  className="opacity-50 group-hover:opacity-100 hover:text-amber-300 p-0.5 rounded transition cursor-pointer"
                                  title="Edit host email"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>

                              <div>
                                <button
                                  type="button"
                                  onClick={() => setEmailHistoryModalShow(show)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300 hover:text-purple-200 underline cursor-pointer"
                                  title="View AgentMail thread & claim history"
                                >
                                  <Mail className="h-3 w-3 text-purple-400" />
                                  <span>Email History</span>
                                  {show.inboxThreadId ? (
                                    <span className="text-[9px] text-purple-400/60 font-mono no-underline">
                                      ({show.inboxThreadId.slice(0, 10)}...)
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {show.isClaimed ? (
                            <span className="text-emerald-400 font-semibold text-[10px]">
                              Claimed
                            </span>
                          ) : (
                            <span className="text-disco-cream/40 text-[10px]">Unclaimed</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShowId(show.showId);
                              setShowsSubView("inspector");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C47D54]/20 hover:bg-[#C47D54]/35 text-disco-cream border border-[#C47D54]/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider shadow transition cursor-pointer"
                          >
                            <span>Deep Dive &amp; QA</span>
                            <ArrowRight className="h-3 w-3 text-[#C47D54]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Right Discreet Reset Action */}
            <div className="flex items-center justify-end pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowResetDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-rose-400/60 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
                title="Permanently wipe database"
              >
                <Trash2 className="h-3 w-3" />
                <span>Reset database</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 2: Integrations Test Lab */}
      {activeTab === "integrations" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Environment Secrets Status */}
          <div className="rounded-2xl border border-white/10 bg-disco-navy/20 p-6 space-y-4">
            <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
              Integration Secrets Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <EnvStatusPill
                label="OPENAI_API_KEY"
                isSet={envHealth?.openaiConfigured ?? false}
              />
              <EnvStatusPill
                label="FIRECRAWL_API_KEY"
                isSet={envHealth?.firecrawlConfigured ?? false}
              />
              <EnvStatusPill
                label="AGENTMAIL_API_KEY"
                isSet={envHealth?.agentmailConfigured ?? false}
              />
              <EnvStatusPill
                label="AGENTMAIL_SECRET"
                isSet={envHealth?.webhookSecretConfigured ?? false}
              />
            </div>
          </div>

          {/* AgentMail Outbound Routing & Email Override */}
          <EmailOverrideCard />

          {/* Host Single-Contact Rule Guard */}
          <HostOutreachGuardCard />

          {/* Human-in-the-loop admin escalation (distinct from staging override) */}
          <HumanInTheLoopEmailCard />

          {/* Human-in-the-loop access requests table */}
          <AccessRequestsCard />

          {/* Anti-Competitor Takedown Requests table */}
          <TakedownRequestsCard />

          {/* Interactive Integration Testers */}
          <div className="grid md:grid-cols-2 gap-6">
            <OpenAiTestCard />
            <FirecrawlTestCard />
            <IngestionPipelineTestCard />
            <AgentMailSimulationCard />
          </div>
        </div>
      ) : null}

      {/* TAB 3: Super Admin Team Approvals */}
      {activeTab === "team" ? (
        currentUser?.role === "superadmin" ? (
          <AdminTeamApprovalsPanel currentUser={currentUser} />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-disco-navy/30 p-8 text-center space-y-3">
            <Users className="mx-auto h-8 w-8 text-disco-cream/40" />
            <h3 className="text-base font-bold text-disco-cream">Super Admin Access Required</h3>
            <p className="text-xs text-disco-cream/60 max-w-md mx-auto">
              Team approval and role administration requires Super Admin privileges. Please contact an existing Super Admin to manage access.
            </p>
          </div>
        )
      ) : null}

      {/* TAB 4: Podcast Discovery & Seeding Flow */}
      {activeTab === "seed" ? (
        <PodcastDiscoveryFlowSection
          onShowSeeded={(showDetail) => {
            setActiveSeededShow(showDetail);
            setSelectedShowId(showDetail.showId);
            setFeedbackMessage({
              type: "success",
              text: `Successfully enriched and seeded "${showDetail.title}"! Switch to Shows to view or inspect deep dive QA.`,
            });
          }}
          activeSeededShow={activeSeededShow}
          ingestedShows={stats?.shows ?? []}
          onInspectShow={(showId) => {
            setSelectedShowId(showId);
            setActiveTab("shows");
            setShowsSubView("inspector");
          }}
        />
      ) : null}

      {/* Difficult Confirmation Modal for Database Reset */}
      <ResetDatabaseModal
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleClearDatabase}
        isDeleting={clearing}
        counts={stats?.counts}
      />

      {/* Email & AgentMail Thread History Modal */}
      {emailHistoryModalShow ? (
        <EmailHistoryModal
          show={emailHistoryModalShow}
          onClose={() => setEmailHistoryModalShow(null)}
          onInspect={(showId) => {
            setSelectedShowId(showId);
            setShowsSubView("inspector");
            setEmailHistoryModalShow(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Simple Markdown Viewer for Firecrawl "Show Your Work" Research Dossier
// ----------------------------------------------------------------------------

function renderFormattedSpans(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-extrabold text-disco-cream">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px] text-disco-caramel">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function SimpleMarkdownViewer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-xs text-disco-cream/85 font-sans leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h3 key={idx} className="text-base font-black text-disco-cream pt-2 pb-1 border-b border-white/10">
              {trimmed.slice(2)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h4 key={idx} className="text-sm font-extrabold text-disco-caramel pt-2 pb-0.5">
              {trimmed.slice(3)}
            </h4>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h5 key={idx} className="text-xs font-bold text-disco-rose pt-1">
              {trimmed.slice(4)}
            </h5>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const itemText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-disco-rose font-bold text-xs select-none">&bull;</span>
              <span className="flex-1 text-disco-cream/90">{renderFormattedSpans(itemText)}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} className="border-l-2 border-disco-caramel pl-3 py-1 my-1 italic text-disco-cream/70 bg-white/5 rounded-r">
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        return (
          <p key={idx} className="text-disco-cream/80">
            {renderFormattedSpans(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Show Search Combobox Component
// ----------------------------------------------------------------------------

function ShowCombobox({
  shows,
  selectedShowId,
  onSelectShowId,
}: {
  shows: AdminShowSummary[];
  selectedShowId: string | null;
  onSelectShowId: (showId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedShow = useMemo(
    () => shows.find((s) => s.showId === selectedShowId) || shows[0] || null,
    [shows, selectedShowId],
  );

  const filteredShows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shows;
    return shows.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.hostName && s.hostName.toLowerCase().includes(q)) ||
        (s.slug && s.slug.toLowerCase().includes(q)),
    );
  }, [shows, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-disco-dark/95 hover:border-disco-rose/60 px-4 py-2.5 text-left transition shadow-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-disco-rose/40"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0 text-[#C47D54]">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-disco-cream truncate">
                {selectedShow ? selectedShow.title : "Select a podcast..."}
              </span>
              {selectedShow?.isClaimed ? (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.2 text-[8px] font-black text-emerald-400 border border-emerald-400/40">
                  CLAIMED
                </span>
              ) : null}
            </div>
            {selectedShow ? (
              <p className="text-[10px] text-disco-cream/60 truncate mt-0.5">
                {selectedShow.hostName || "Unknown Host"} &bull; {selectedShow.snippetCount} clip{selectedShow.snippetCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-disco-cream/50">
          <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-md hidden sm:inline-block">
            {shows.length} shows
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-disco-rose" : ""}`} />
        </div>
      </button>

      {/* Combobox Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-white/20 bg-disco-dark/98 p-2 shadow-2xl backdrop-blur-2xl">
          {/* Search Input Box */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-disco-cream/40" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search podcasts by title, host, or keyword..."
              className="w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-8 py-2 text-xs font-medium text-disco-cream placeholder:text-disco-cream/40 focus:border-disco-rose focus:outline-none focus:bg-white/10 transition"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                } else if (e.key === "Enter" && filteredShows.length > 0) {
                  const first = filteredShows[0];
                  if (first) {
                    onSelectShowId(first.showId);
                    setIsOpen(false);
                    setSearchQuery("");
                  }
                }
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-disco-cream/40 hover:text-disco-cream p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Results Count Bar */}
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-disco-cream/40 uppercase tracking-wider border-b border-white/5 mb-1">
            <span>{filteredShows.length} podcast{filteredShows.length === 1 ? "" : "s"} found</span>
            <span className="hidden sm:inline">Press Enter to select</span>
          </div>

          {/* Scrollable Show Options List */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {filteredShows.length === 0 ? (
              <div className="p-4 text-center text-xs text-disco-cream/50">
                No podcasts matching "{searchQuery}"
              </div>
            ) : (
              filteredShows.map((s) => {
                const isSelected = s.showId === selectedShowId;
                return (
                  <button
                    key={s.showId}
                    type="button"
                    onClick={() => {
                      onSelectShowId(s.showId);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-emerald-500/20 text-disco-cream border border-emerald-500/40"
                        : "hover:bg-white/8 text-disco-cream/80 hover:text-disco-cream border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold truncate ${isSelected ? "text-emerald-300" : "text-disco-cream"}`}>
                          {s.title}
                        </span>
                        {s.isClaimed ? (
                          <span className="shrink-0 text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1">
                            CLAIMED
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-disco-cream/50 truncate mt-0.5">
                        {s.hostName || "Unknown Host"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-mono text-disco-cream/70">
                        {s.snippetCount} clip{s.snippetCount === 1 ? "" : "s"}
                      </span>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Show Deep Dive & Integrations QA Section
// ----------------------------------------------------------------------------

function ShowInspectorAndQaSection({
  shows,
  selectedShowId,
  onSelectShowId,
  onNavigateToDiscovery,
  onBackToExplorer,
}: {
  shows: AdminShowSummary[];
  selectedShowId: string | null;
  onSelectShowId: (showId: string) => void;
  onNavigateToDiscovery: () => void;
  onBackToExplorer?: () => void;
}) {
  const deepDive = useQuery(
    api.admin.getShowDeepDiveForAdmin,
    selectedShowId ? { showId: selectedShowId as Id<"shows"> } : "skip",
  ) as DeepDiveData | null | undefined;

  const runFirecrawlProbe = useAction(api.admin.qaFirecrawlProbe);
  const saveDeepDossier = useMutation(api.admin.saveDeepResearchDossier);

  const [probeLoading, setProbeLoading] = useState(false);
  const [probeElapsedMs, setProbeElapsedMs] = useState(0);
  const [probeResult, setProbeResult] = useState<{
    success: boolean;
    latencyMs: number;
    queryUsed: string;
    officialWebsite: string;
    reviews: string;
    socialLinks: string[];
    rawSnippet: string;
    hosts?: DiscoveredHost[];
    socialProfiles?: DiscoveredSocials;
    highlightClips?: DiscoveredClip[];
    firecrawlReport?: FirecrawlReport;
    error?: string;
  } | null>(null);

  const [savingSignals, setSavingSignals] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [firecrawlTab, setFirecrawlTab] = useState<"dossier" | "signals" | "searches" | "clips">("dossier");
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [openaiTab, setOpenaiTab] = useState<"player" | "dossier" | "tinder_preview">("player");
  const [copiedOpenaiMarkdown, setCopiedOpenaiMarkdown] = useState(false);

  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedRss, setCopiedRss] = useState(false);

  // Audio player state for selected clip
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipCurrentSeconds, setClipCurrentSeconds] = useState(0);
  const [showCardTranscript, setShowCardTranscript] = useState(false);

  useEffect(() => {
    setSelectedClipIndex(0);
    setProbeResult(null);
    setSaveFeedback(null);
    setIsPlaying(false);
    setClipCurrentSeconds(0);
    setShowCardTranscript(false);
  }, [selectedShowId]);

  const activeClip = deepDive?.snippets[selectedClipIndex] || deepDive?.snippets[0];
  const clipDuration = activeClip ? activeClip.duration : 30;

  useEffect(() => {
    setIsPlaying(false);
    setClipCurrentSeconds(0);
    if (audioRef.current && activeClip) {
      audioRef.current.currentTime = activeClip.startTime;
    }
  }, [activeClip]);

  function togglePlay() {
    if (!audioRef.current || !activeClip) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (
        audioRef.current.currentTime < activeClip.startTime ||
        audioRef.current.currentTime >= activeClip.endTime - 0.5
      ) {
        audioRef.current.currentTime = activeClip.startTime;
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current || !activeClip) return;
    const cur = audioRef.current.currentTime;
    if (cur >= activeClip.endTime) {
      audioRef.current.pause();
      audioRef.current.currentTime = activeClip.startTime;
      setIsPlaying(false);
      setClipCurrentSeconds(clipDuration);
      return;
    }
    if (cur < activeClip.startTime) {
      audioRef.current.currentTime = activeClip.startTime;
      setClipCurrentSeconds(0);
      return;
    }
    setClipCurrentSeconds(Math.max(0, cur - activeClip.startTime));
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    if (!audioRef.current || !activeClip) return;
    const targetOffset = Number(e.target.value);
    audioRef.current.currentTime = activeClip.startTime + targetOffset;
    setClipCurrentSeconds(targetOffset);
  }

  const bars = useMemo(() => {
    const seed = activeClip ? activeClip.hookText : "waveform";
    const res: number[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < 48; i++) {
      h = (Math.imul(1664525, h) + 1013904223) | 0;
      res.push(20 + (Math.abs(h) % 75));
    }
    return res;
  }, [activeClip]);

  const progressFraction = Math.min(1, Math.max(0, clipCurrentSeconds / clipDuration));

  async function handleRunProbe() {
    if (!selectedShowId) return;
    setProbeLoading(true);
    setProbeResult(null);
    setSaveFeedback(null);
    const start = Date.now();
    const interval = setInterval(() => {
      setProbeElapsedMs(Date.now() - start);
    }, 50);

    try {
      const res = await runFirecrawlProbe({ showId: selectedShowId as Id<"shows"> });
      setProbeResult(res);
      if (res.success && res.firecrawlReport) {
        setFirecrawlTab("dossier");
      }
    } catch (err) {
      setProbeResult({
        success: false,
        latencyMs: Date.now() - start,
        queryUsed: "Multi-Query Deep Agent Search",
        officialWebsite: "",
        reviews: "",
        socialLinks: [],
        rawSnippet: "",
        error: err instanceof Error ? err.message : "Firecrawl research probe failed",
      });
    } finally {
      clearInterval(interval);
      setProbeLoading(false);
    }
  }

  async function handleSaveDiscoveredSignals() {
    if (!selectedShowId || !probeResult || !probeResult.success) return;
    setSavingSignals(true);
    setSaveFeedback(null);
    try {
      await saveDeepDossier({
        showId: selectedShowId as Id<"shows">,
        canonicalWebsite: probeResult.officialWebsite,
        hosts: probeResult.hosts,
        socialProfiles: probeResult.socialProfiles,
        highlightClips: probeResult.highlightClips,
        firecrawlReport: probeResult.firecrawlReport,
        firecrawlSignals: {
          reviews: probeResult.reviews,
          socialLinks: probeResult.socialLinks,
          officialWebsite: probeResult.officialWebsite,
        },
      });
      setSaveFeedback("✓ Comprehensive research dossier (canonical website, host handles, socials, clips & report) saved to Convex!");
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : "Failed to save dossier");
    } finally {
      setSavingSignals(false);
    }
  }

  function handleCopyMarkdown(md: string) {
    void navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  }

  function handleCopyOpenaiMarkdown(md: string) {
    void navigator.clipboard.writeText(md);
    setCopiedOpenaiMarkdown(true);
    setTimeout(() => setCopiedOpenaiMarkdown(false), 2000);
  }

  function handleCopyJson() {
    if (!deepDive) return;
    void navigator.clipboard.writeText(JSON.stringify(deepDive, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  function handleCopyToken(token: string) {
    void navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  function handleCopyRss(url: string) {
    void navigator.clipboard.writeText(url);
    setCopiedRss(true);
    setTimeout(() => setCopiedRss(false), 2000);
  }

  if (shows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-disco-navy/20 p-12 text-center space-y-4 animate-fade-in">
        {onBackToExplorer ? (
          <div className="text-left mb-2">
            <button
              type="button"
              onClick={onBackToExplorer}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-disco-cream transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#C47D54]" />
              <span>Back to Shows Explorer</span>
            </button>
          </div>
        ) : null}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-disco-rose/20 text-disco-rose text-2xl font-black">
          🎙️
        </div>
        <h3 className="text-lg font-extrabold text-disco-cream uppercase tracking-wider">
          No Podcasts Ingested Yet
        </h3>
        <p className="text-xs text-disco-cream/70 max-w-md mx-auto leading-relaxed">
          Once podcasts are ingested (either in production or via the Discovery flow), you can
          inspect everything known about the show, its host, and run QA on Firecrawl and OpenAI here.
        </p>
        <button
          type="button"
          onClick={onNavigateToDiscovery}
          className="rounded-full bg-disco-rose px-6 py-2.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:bg-disco-rose/90 transition cursor-pointer"
        >
          Go to Seed Tab
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Show Selector Header & Quick Switcher */}
      <div className="rounded-3xl border border-white/15 bg-disco-navy/40 p-6 space-y-4 backdrop-blur-sm">
        {onBackToExplorer ? (
          <div>
            <button
              type="button"
              onClick={onBackToExplorer}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-disco-cream transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#C47D54]" />
              <span>Back to Shows Explorer</span>
            </button>
          </div>
        ) : null}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                Admin QA Inspector
              </span>
              <span className="text-xs text-disco-cream/60">
                {shows.length} Ingested Podcast{shows.length === 1 ? "" : "s"} in Convex
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-disco-cream">
              Show Deep Dive &amp; Integrations QA
            </h2>
            <p className="text-xs text-disco-cream/70">
              Search or select an ingested show to inspect metadata, host contact, territory claims, Firecrawl signals, and OpenAI audio hooks.
            </p>
          </div>

          <div className="w-full lg:w-auto lg:min-w-[420px]">
            <ShowCombobox
              shows={shows}
              selectedShowId={selectedShowId}
              onSelectShowId={onSelectShowId}
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {deepDive === undefined ? (
        <div className="rounded-3xl border border-white/10 bg-disco-navy/20 p-12 text-center text-xs text-disco-cream/60 space-y-3">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-disco-rose border-t-transparent" />
          <p>Loading full show document, episodes, audio clips, and integration signals from Convex...</p>
        </div>
      ) : deepDive === null ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-8 text-center text-xs text-rose-300">
          Selected podcast record not found in Convex database.
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: Show & Host Overview ("Everything We Know") */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Show Profile & Coordinates (2 cols) */}
            <div className="lg:col-span-2 rounded-3xl border border-white/15 bg-disco-navy/40 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <img
                  src={deepDive.show.coverArtUrl || "https://placehold.co/300x300"}
                  alt={deepDive.show.title}
                  className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl object-cover shadow-2xl border border-white/15 flex-shrink-0"
                />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-disco-rose px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-dark">
                      Show Profile
                    </span>
                    {deepDive.show.isClaimed ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        ✓ Verified Creator
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 text-disco-cream/60 px-2.5 py-0.5 text-[10px] font-bold">
                        Unclaimed
                      </span>
                    )}
                    <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-mono">
                      ID: {deepDive.show.showId}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-disco-cream tracking-tight">
                    {deepDive.show.title}
                  </h3>

                  <p className="text-xs text-disco-cream/60 font-mono">
                    slug: <span className="text-disco-caramel">{deepDive.show.slug}</span>
                  </p>

                  <p className="text-xs text-disco-cream/80 leading-relaxed line-clamp-3">
                    {deepDive.show.description || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Spatial Coordinates & External Links Ribbon */}
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/50">
                    3D Globe Spatial Coordinates
                  </span>
                  <div className="font-mono text-xs text-emerald-400 font-bold">
                    x: {deepDive.show.coordinates.x.toFixed(3)}, y:{" "}
                    {deepDive.show.coordinates.y.toFixed(3)}, z:{" "}
                    {deepDive.show.coordinates.z.toFixed(3)}
                  </div>
                  <p className="text-[10px] text-disco-cream/50">
                    Deterministic coordinates mapped onto the React Three Fiber interactive globe.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-4 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/50">
                    Feed &amp; Web Links
                  </span>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-disco-cream/60 text-[11px]">RSS Feed:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyRss(deepDive.show.rssUrl)}
                          className="text-[10px] text-disco-caramel hover:underline cursor-pointer"
                        >
                          {copiedRss ? "Copied!" : "Copy URL"}
                        </button>
                        <a
                          href={deepDive.show.rssUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-disco-rose underline truncate max-w-[140px]"
                        >
                          Open XML
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-disco-cream/60 text-[11px]">Website:</span>
                      {deepDive.show.websiteUrl ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          {deepDive.show.websiteUrl.includes("libsyn.com") ||
                          deepDive.show.websiteUrl.includes("podbean.com") ||
                          deepDive.show.websiteUrl.includes("anchor.fm") ||
                          deepDive.show.websiteUrl.includes("buzzsprout.com") ? (
                            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                              Feed Host URL
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                              Canonical Site
                            </span>
                          )}
                          <a
                            href={deepDive.show.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-disco-caramel underline truncate max-w-[170px]"
                          >
                            {deepDive.show.websiteUrl}
                          </a>
                        </div>
                      ) : (
                        <span className="text-disco-cream/40 text-[11px]">Not resolved</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discovered Social Channels Strip */}
                <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-disco-dark/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/50">
                      Discovered Social Channels
                    </span>
                    <span className="text-[10px] text-disco-cream/40">
                      From show notes &amp; Firecrawl research
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(() => {
                      const socials = deepDive.socialProfiles || probeResult?.socialProfiles;
                      const rawLinks = deepDive.firecrawlSignals.socialLinks || [];
                      const linksToRender: Array<{ label: string; url: string; icon: string; color: string }> = [];

                      if (socials?.youtube) linksToRender.push({ label: "YouTube", url: socials.youtube, icon: "▶", color: "bg-red-950/40 text-red-300 border-red-500/30" });
                      if (socials?.twitter) linksToRender.push({ label: "X / Twitter", url: socials.twitter, icon: "𝕏", color: "bg-sky-950/40 text-sky-300 border-sky-500/30" });
                      if (socials?.instagram) linksToRender.push({ label: "Instagram", url: socials.instagram, icon: "📸", color: "bg-pink-950/40 text-pink-300 border-pink-500/30" });
                      if (socials?.tiktok) linksToRender.push({ label: "TikTok", url: socials.tiktok, icon: "🎵", color: "bg-slate-900/60 text-teal-300 border-teal-500/30" });
                      if (socials?.linkedin) linksToRender.push({ label: "LinkedIn", url: socials.linkedin, icon: "in", color: "bg-blue-950/40 text-blue-300 border-blue-500/30" });
                      if (socials?.newsletter) linksToRender.push({ label: "Newsletter", url: socials.newsletter, icon: "✉", color: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" });

                      if (linksToRender.length === 0 && rawLinks.length > 0) {
                        for (const url of rawLinks) {
                          let label = "Social";
                          let icon = "↗";
                          if (url.includes("youtube.com") || url.includes("youtu.be")) { label = "YouTube"; icon = "▶"; }
                          else if (url.includes("twitter.com") || url.includes("x.com")) { label = "X"; icon = "𝕏"; }
                          else if (url.includes("instagram.com")) { label = "Instagram"; icon = "📸"; }
                          else if (url.includes("tiktok.com")) { label = "TikTok"; icon = "🎵"; }
                          else if (url.includes("linkedin.com")) { label = "LinkedIn"; icon = "in"; }
                          linksToRender.push({ label, url, icon, color: "bg-white/10 text-disco-cream border-white/10" });
                        }
                      }

                      if (linksToRender.length === 0) {
                        return <span className="text-xs text-disco-cream/40 italic">No social profiles detected yet. Run Deep Firecrawl Research below.</span>;
                      }

                      return linksToRender.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition flex items-center gap-1.5 hover:scale-105 active:scale-95 ${link.color}`}
                        >
                          <span className="font-mono text-[10px]">{link.icon}</span>
                          <span>{link.label}</span>
                          <span className="text-[9px] opacity-60">↗</span>
                        </a>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Host & Claim Overview (1 col) */}
            <div className="rounded-3xl border border-white/15 bg-disco-navy/40 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-disco-rose">
                    Host &amp; Show Claim
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      deepDive.show.isClaimed
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-white/10 text-disco-cream/60"
                    }`}
                  >
                    {deepDive.show.isClaimed ? "Claimed" : "Unclaimed"}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-disco-cream/50 text-[10px] font-bold uppercase block">
                      Host Name
                    </span>
                    <span className="text-base font-bold text-disco-cream">
                      {deepDive.show.hostName || "Unknown Host"}
                    </span>
                  </div>

                  <div>
                    <span className="text-disco-cream/50 text-[10px] font-bold uppercase block">
                      Host Email
                    </span>
                    <span className="font-mono text-disco-cream/90">
                      {deepDive.show.hostEmail || (
                        <span className="text-disco-cream/40 italic">None detected in RSS owner tags</span>
                      )}
                    </span>
                  </div>

                  {deepDive.claims[0] ? (
                    (() => {
                      const primaryClaim = deepDive.claims[0];
                      return (
                        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-purple-300 uppercase">
                              Claim Verification Token
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(primaryClaim.token)}
                              className="text-[10px] text-purple-200 underline cursor-pointer"
                            >
                              {copiedToken ? "Copied Token" : "Copy Token"}
                            </button>
                          </div>
                          <div className="font-mono text-xs text-purple-200 truncate">
                            {primaryClaim.token}
                          </div>
                          <div className="text-[10px] text-purple-300/70">
                            Status: <span className="font-bold uppercase">{primaryClaim.claimStatus}</span> &bull; Thread: {primaryClaim.inboxThreadId}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/40 p-3 text-[11px] text-disco-cream/60">
                      No show claim initiated. When claimed, an AgentMail verification token is generated.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-disco-dark/50 p-3.5 text-[11px] text-disco-cream/60 leading-relaxed">
                <span className="font-bold text-disco-rose block mb-1">Creator Claim Loop:</span>
                Creators claim ownership of their globe location by verifying via email token. Once claimed, they can re-slice their 15-45s audio highlight reels, customize narrative hooks, and converse with DiscoPod AI.
              </div>
            </div>
          </div>

          {/* Host Roster Section */}
          {(() => {
            const hosts = deepDive.hosts || probeResult?.hosts || [];
            if (hosts.length === 0) return null;
            return (
              <div className="rounded-3xl border border-white/15 bg-disco-navy/40 p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-disco-rose/20 text-disco-rose border border-disco-rose/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      Host Roster &amp; Personal Handles
                    </span>
                    <span className="text-xs text-disco-cream/60">
                      {hosts.length} Host{hosts.length === 1 ? "" : "s"} Extracted
                    </span>
                  </div>
                  <span className="text-[10px] text-disco-cream/50">
                    Extracted from show title, RSS notes &amp; Firecrawl entity resolution
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {hosts.map((host, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/10 bg-disco-dark/60 p-4 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="font-extrabold text-sm text-disco-cream">{host.name}</div>
                        {host.handle ? (
                          <a
                            href={host.handle.startsWith("http") ? host.handle : `https://x.com/${host.handle.replace("@", "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-disco-rose/15 border border-disco-rose/30 px-2.5 py-0.5 text-[11px] font-mono text-disco-rose hover:bg-disco-rose/25 transition"
                          >
                            <span>{host.handle.startsWith("@") ? host.handle : `@${host.handle}`}</span>
                            <span className="text-[8px] opacity-60">↗</span>
                          </a>
                        ) : (
                          <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-disco-cream/40 font-mono">
                            No handle found
                          </span>
                        )}
                        <div className="text-[11px] text-disco-cream/70 font-semibold">{host.role || "Host / Creator"}</div>
                        {host.bio ? <div className="text-[10px] text-disco-cream/50 line-clamp-2">{host.bio}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Highlight Clips & Creator Chapters Section */}
          {(() => {
            const clips = deepDive.highlightClips || probeResult?.highlightClips || [];
            if (clips.length === 0) return null;
            return (
              <div className="rounded-3xl border border-white/15 bg-disco-navy/40 p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      Creator Chapters &amp; Discovered Highlight Clips
                    </span>
                    <span className="text-xs text-disco-cream/60">
                      {clips.length} Marker{clips.length === 1 ? "" : "s"} Extracted
                    </span>
                    <span className="rounded-full bg-disco-rose/20 text-disco-rose border border-disco-rose/30 px-2 py-0.5 text-[9px] font-bold">
                      ⚡ Fed into OpenAI Audio Curator
                    </span>
                  </div>
                  <span className="text-[10px] text-disco-cream/50">
                    Source: RSS Show Notes &amp; Scraped Timestamps
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clips.map((clip, idx) => {
                    const isRedundantDesc =
                      !clip.description ||
                      clip.description.trim() === clip.title.trim() ||
                      clip.description.length > 200;

                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-white/10 bg-disco-dark/60 p-4 space-y-2 flex flex-col justify-between hover:border-white/20 transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded bg-white/10 text-disco-cream/70 px-2 py-0.5 text-[9px] font-mono">
                              {clip.platform || "Chapter Marker"}
                            </span>
                            {clip.timestamp ? (
                              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded shadow-sm">
                                ⏱ {clip.timestamp}
                              </span>
                            ) : null}
                          </div>
                          <h5 className="font-bold text-xs text-disco-cream leading-snug">
                            {clip.title}
                          </h5>
                          {!isRedundantDesc ? (
                            <p className="text-[10px] text-disco-cream/60 line-clamp-2">
                              {clip.description}
                            </p>
                          ) : null}
                        </div>
                        {clip.url ? (
                          <a
                            href={clip.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-mono text-disco-caramel underline hover:text-disco-rose pt-1 self-start"
                          >
                            View External Clip ↗
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* SECTION 2: Firecrawl Integration QA & Show-Your-Work Dossier */}
          {(() => {
            const report = probeResult?.firecrawlReport || deepDive.firecrawlReport;

            return (
              <div className="rounded-3xl border-2 border-disco-caramel/50 bg-disco-navy/40 p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-disco-caramel px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-dark">
                        Firecrawl Research Agent
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          deepDive.firecrawlReport
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : probeResult?.firecrawlReport
                              ? "bg-purple-950 text-purple-300 border border-purple-500/30"
                              : "bg-amber-950 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {deepDive.firecrawlReport
                          ? "✓ Research Dossier Saved in Convex"
                          : probeResult?.firecrawlReport
                            ? "⚡ Fresh Live Probe Result"
                            : "Standard Firecrawl Signals"}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-extrabold text-disco-cream">
                      Deep Web Intelligence &amp; &ldquo;Show Your Work&rdquo; Report
                    </h3>
                    <p className="text-xs text-disco-cream/60">
                      Multi-phase web research agent finding canonical website, verified socials, host roster, chapters, and listener sentiment.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleRunProbe()}
                      disabled={probeLoading}
                      className="rounded-full bg-disco-caramel hover:bg-disco-caramel/90 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {probeLoading ? (
                        <>
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-disco-dark border-t-transparent" />
                          <span>Deep Agent Searching ({probeElapsedMs}ms)...</span>
                        </>
                      ) : (
                        <>
                          <span>🤖</span>
                          <span>Run Deep Firecrawl Research Agent</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Research Execution Metrics Strip */}
                {report ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-3 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-disco-cream/50">Agent Latency</span>
                      <div className="text-base font-black text-emerald-400 font-mono">
                        {report.latencyMs ? `${(report.latencyMs / 1000).toFixed(1)}s` : `${probeResult?.latencyMs ?? 0}ms`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-3 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-disco-cream/50">Searches Run</span>
                      <div className="text-base font-black text-disco-caramel font-mono">
                        {report.searchesRun.length} Queries
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-3 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-disco-cream/50">Sources Scraped</span>
                      <div className="text-base font-black text-disco-rose font-mono">
                        {report.sourcesScraped.length} Domains
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-3 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-disco-cream/50">Curated Clips/Chapters</span>
                      <div className="text-base font-black text-purple-300 font-mono">
                        {report.discoveredClips.length} Extracted
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Live Probe Status / Save Button Banner */}
                {probeResult ? (
                  <div
                    className={`rounded-2xl border p-4 space-y-3 ${
                      probeResult.success
                        ? "border-emerald-500/40 bg-emerald-950/20"
                        : "border-rose-500/40 bg-rose-950/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            probeResult.success ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                          }`}
                        />
                        <span className="font-extrabold text-xs uppercase tracking-wider text-disco-cream">
                          {probeResult.success ? "Research Completed" : "Research Error"} ({probeResult.latencyMs}ms)
                        </span>
                      </div>
                      {probeResult.success ? (
                        <button
                          type="button"
                          onClick={() => void handleSaveDiscoveredSignals()}
                          disabled={savingSignals}
                          className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-black uppercase tracking-wider shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>💾</span>
                          <span>{savingSignals ? "Saving..." : "Save Research Dossier to Convex"}</span>
                        </button>
                      ) : null}
                    </div>

                    {saveFeedback ? (
                      <div className="rounded-xl bg-emerald-900/40 border border-emerald-500/40 p-2.5 text-xs text-emerald-200">
                        {saveFeedback}
                      </div>
                    ) : null}

                    {!probeResult.success && probeResult.error ? (
                      <p className="text-xs text-rose-300">{probeResult.error}</p>
                    ) : null}
                  </div>
                ) : null}

                {/* Navigation Tabs for Firecrawl Research */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <button
                    type="button"
                    onClick={() => setFirecrawlTab("dossier")}
                    className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      firecrawlTab === "dossier"
                        ? "bg-disco-caramel text-disco-dark shadow"
                        : "bg-disco-dark/60 text-disco-cream/70 hover:text-disco-cream"
                    }`}
                  >
                    📄 &ldquo;Show Your Work&rdquo; Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => setFirecrawlTab("searches")}
                    className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      firecrawlTab === "searches"
                        ? "bg-disco-caramel text-disco-dark shadow"
                        : "bg-disco-dark/60 text-disco-cream/70 hover:text-disco-cream"
                    }`}
                  >
                    🔍 Multi-Query Audit Trail ({report?.searchesRun.length || 1})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFirecrawlTab("signals")}
                    className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      firecrawlTab === "signals"
                        ? "bg-disco-caramel text-disco-dark shadow"
                        : "bg-disco-dark/60 text-disco-cream/70 hover:text-disco-cream"
                    }`}
                  >
                    🏷️ Entity Signals &amp; Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() => setFirecrawlTab("clips")}
                    className={`rounded-xl px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                      firecrawlTab === "clips"
                        ? "bg-disco-caramel text-disco-dark shadow"
                        : "bg-disco-dark/60 text-disco-cream/70 hover:text-disco-cream"
                    }`}
                  >
                    ⏱️ Discovered Clips ({report?.discoveredClips.length || 0})
                  </button>
                </div>

                {/* TAB CONTENT: "Show Your Work" Markdown Report */}
                {firecrawlTab === "dossier" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-disco-cream/50 uppercase tracking-wider">
                        Curator Dossier (Markdown Synthesis)
                      </span>
                      {report?.researchMarkdown ? (
                        <button
                          type="button"
                          onClick={() => handleCopyMarkdown(report.researchMarkdown)}
                          className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 text-xs text-disco-cream transition border border-white/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>📋</span>
                          <span>{copiedMarkdown ? "Copied!" : "Copy Markdown Dossier"}</span>
                        </button>
                      ) : null}
                    </div>

                    {report?.researchMarkdown ? (
                      <div className="rounded-2xl border border-white/10 bg-disco-dark/80 p-6 shadow-inner max-h-[500px] overflow-y-auto">
                        <SimpleMarkdownViewer content={report.researchMarkdown} />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-disco-cream/60 space-y-3">
                        <p>No full markdown research report generated yet.</p>
                        <p className="text-[11px] text-disco-cream/40">
                          Click &ldquo;Run Deep Firecrawl Research Agent&rdquo; above to execute multi-query searches and produce a submission-ready research dossier.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* TAB CONTENT: Multi-Query Search Audit Trail */}
                {firecrawlTab === "searches" ? (
                  <div className="space-y-4">
                    <span className="text-[11px] font-bold text-disco-cream/50 uppercase tracking-wider block">
                      Search Queries Run by Firecrawl Research Agent
                    </span>
                    <div className="space-y-2">
                      {(report?.searchesRun || [probeResult?.queryUsed || "Initial podcast probe"]).map((q, idx) => (
                        <div key={idx} className="rounded-xl border border-white/10 bg-disco-dark/60 p-3 flex items-center gap-3">
                          <span className="rounded-full bg-disco-caramel/20 text-disco-caramel font-mono text-[10px] px-2 py-0.5">
                            Query {idx + 1}
                          </span>
                          <span className="font-mono text-xs text-disco-cream/90 flex-1">{q}</span>
                          <span className="text-[10px] text-emerald-400 font-bold">200 OK</span>
                        </div>
                      ))}
                    </div>

                    <span className="text-[11px] font-bold text-disco-cream/50 uppercase tracking-wider block pt-2">
                      Sources &amp; Domains Scraped ({report?.sourcesScraped.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(report?.sourcesScraped || []).map((src, idx) => (
                        <a
                          key={idx}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-disco-dark/60 hover:bg-disco-dark px-3 py-1.5 text-[11px] font-mono text-disco-caramel border border-white/10 hover:border-white/30 transition flex items-center gap-1"
                        >
                          <span className="truncate max-w-[280px]">{src}</span>
                          <span className="text-[9px] opacity-60">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* TAB CONTENT: Entity Signals & Praise */}
                {firecrawlTab === "signals" ? (
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* 1. Official Website */}
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-5 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-disco-caramel block">
                        1. Resolved Canonical Website
                      </span>
                      {deepDive.firecrawlSignals.officialWebsite ? (
                        <div className="space-y-1">
                          <a
                            href={deepDive.firecrawlSignals.officialWebsite}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-emerald-300 underline break-all hover:text-emerald-200"
                          >
                            {deepDive.firecrawlSignals.officialWebsite}
                          </a>
                          <p className="text-[10px] text-disco-cream/50">
                            Bypasses feed platform redirects to reach the canonical landing domain.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-disco-cream/40 italic">
                          No official website link returned yet.
                        </p>
                      )}
                    </div>

                    {/* 2. Discovered Social Profiles */}
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-5 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-disco-caramel block">
                        2. Discovered Social Profiles ({deepDive.firecrawlSignals.socialLinks.length})
                      </span>
                      {deepDive.firecrawlSignals.socialLinks.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {deepDive.firecrawlSignals.socialLinks.map((url, idx) => {
                            let label = "Social";
                            if (url.includes("twitter.com") || url.includes("x.com")) label = "X / Twitter";
                            else if (url.includes("youtube.com")) label = "YouTube";
                            else if (url.includes("instagram.com")) label = "Instagram";
                            else if (url.includes("linkedin.com")) label = "LinkedIn";
                            else if (url.includes("facebook.com")) label = "Facebook";

                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-bold text-disco-cream transition border border-white/10 flex items-center gap-1"
                              >
                                <span>{label}</span>
                                <span className="text-[8px] opacity-60">↗</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-disco-cream/40 italic">
                          No social profile URLs discovered yet. Run QA probe to scrape.
                        </p>
                      )}
                    </div>

                    {/* 3. Listener Praise & Reviews */}
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/60 p-5 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-disco-caramel block">
                        3. Listener Praise &amp; Review Signals
                      </span>
                      <p className="text-xs text-disco-cream/90 italic leading-relaxed line-clamp-4">
                        &ldquo;{deepDive.firecrawlSignals.reviews}&rdquo;
                      </p>
                      <p className="text-[10px] text-disco-cream/50">
                        Supplied directly to OpenAI to generate high-engagement &ldquo;Why listeners love it&rdquo; hooks.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* TAB CONTENT: Discovered Clips & Chapters */}
                {firecrawlTab === "clips" ? (
                  <div className="space-y-4">
                    <span className="text-[11px] font-bold text-disco-cream/50 uppercase tracking-wider block">
                      Discovered Highlight Clips &amp; Creator Chapters
                    </span>
                    {(report?.discoveredClips || []).length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(report?.discoveredClips || []).map((clip, idx) => (
                          <div key={idx} className="rounded-2xl border border-white/10 bg-disco-dark/60 p-3.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded bg-white/10 text-disco-cream/70 px-2 py-0.5 text-[9px] font-mono">
                                {clip.platform}
                              </span>
                              {clip.timestamp ? (
                                <span className="font-mono text-xs font-bold text-disco-rose">
                                  ⏱ {clip.timestamp}
                                </span>
                              ) : null}
                            </div>
                            <h5 className="font-bold text-xs text-disco-cream">{clip.title}</h5>
                            {clip.url ? (
                              <a
                                href={clip.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-mono text-disco-caramel underline truncate block"
                              >
                                {clip.url}
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-disco-cream/60">
                        No highlight clips or chapters extracted yet. Run the deep research agent to discover them.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* SECTION 3: OpenAI Audio Curation Engine & "Show Your Work" QA */}
          <div className="rounded-3xl border-2 border-disco-rose/50 bg-disco-navy/40 p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Header & Badges */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-disco-rose px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-dark">
                    OpenAI Audio Curation Engine
                  </span>
                  <span className="text-xs text-emerald-300 font-bold">
                    gpt-4o-mini &amp; text-embedding-3-small
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-extrabold text-disco-cream">
                  Opinionated 15-45s Audio Curation &amp; Discovery Signals
                </h3>
                <p className="text-xs text-disco-cream/60">
                  Enforcing the 15-45s duration spec, scoring hook punchiness, and backing recommendations with a transparent curation dossier.
                </p>
              </div>

              {/* Compliance Badges */}
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-[11px] flex items-center gap-1.5 text-rose-300 font-bold">
                  <span>💖</span>
                  <span>Fall in Love in 45s Spec</span>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-1.5 text-[11px] flex items-center gap-1.5 text-emerald-300">
                  <span>✓</span>
                  <span className="font-bold">15-45s Bounded Duration</span>
                </div>
                {deepDive.openAiCurationReport?.clipsEvaluated ? (
                  <div className="rounded-xl border border-white/10 bg-disco-dark/60 px-3 py-1.5 text-[11px] flex items-center gap-1.5 text-disco-cream/80">
                    <span className="text-disco-cream/50">Evaluated:</span>
                    <span className="font-bold text-disco-caramel">
                      {deepDive.openAiCurationReport.clipsEvaluated} Candidates
                    </span>
                  </div>
                ) : null}
                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 px-3 py-1.5 text-[11px] flex items-center gap-1.5 text-purple-300 font-mono">
                  <span>1536 dims</span>
                </div>
              </div>
            </div>

            {/* Core 45-Second Discovery Promise Banner */}
            {deepDive.openAiCurationReport?.fallInLovePromise ? (
              <div className="rounded-2xl bg-gradient-to-r from-disco-rose/20 via-disco-navy to-disco-caramel/20 p-4 border border-disco-rose/30 space-y-1 shadow-md">
                <div className="flex items-center gap-2 text-disco-rose font-black text-[11px] uppercase tracking-wider">
                  <span>💖</span>
                  <span>Curator&apos;s Core 45-Second Discovery Promise</span>
                </div>
                <p className="text-sm font-bold text-disco-cream italic leading-snug">
                  &ldquo;{deepDive.openAiCurationReport.fallInLovePromise}&rdquo;
                </p>
              </div>
            ) : null}

            {/* Navigation Tabs for OpenAI Audio Curation */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setOpenaiTab("player")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  openaiTab === "player"
                    ? "bg-disco-rose text-disco-dark shadow-md"
                    : "bg-disco-navy text-disco-cream/70 hover:text-disco-cream border border-white/10"
                }`}
              >
                <span>🎧</span>
                <span>Audio Player &amp; Clip QA ({deepDive.snippets.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenaiTab("dossier")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  openaiTab === "dossier"
                    ? "bg-disco-rose text-disco-dark shadow-md"
                    : "bg-disco-navy text-disco-cream/70 hover:text-disco-cream border border-white/10"
                }`}
              >
                <span>📝</span>
                <span>Show Your Work Dossier</span>
                {deepDive.openAiCurationReport ? (
                  <span className="ml-1 rounded-full bg-emerald-400/20 text-emerald-300 text-[9px] px-2 py-0.2 font-mono">
                    Active
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setOpenaiTab("tinder_preview")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  openaiTab === "tinder_preview"
                    ? "bg-disco-rose text-disco-dark shadow-md"
                    : "bg-disco-navy text-disco-cream/70 hover:text-disco-cream border border-white/10"
                }`}
              >
                <span>🎴</span>
                <span>Tinder Discovery Card Preview</span>
                <span className="ml-1 rounded-full bg-disco-caramel/20 text-disco-caramel text-[9px] px-2 py-0.2 font-mono">
                  Live UI
                </span>
              </button>
            </div>

            {/* Hidden HTML5 Audio Element (mounted across all tabs) */}
            <audio
              ref={audioRef}
              src={activeClip?.audioUrl}
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />

            {/* TAB 1: AUDIO PLAYER & CLIP QA */}
            {openaiTab === "player" ? (
              deepDive.snippets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-disco-cream/60">
                  No snippets generated for this show yet. Run show ingestion to curate clips.
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  {/* Clip Selection Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {deepDive.snippets.map((snip, idx) => (
                      <button
                        key={snip.snippetId}
                        type="button"
                        onClick={() => setSelectedClipIndex(idx)}
                        className={`rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer text-left ${
                          selectedClipIndex === idx
                            ? "bg-disco-rose text-disco-dark shadow-md ring-2 ring-disco-rose/40"
                            : "bg-disco-dark/60 text-disco-cream/70 hover:text-disco-cream border border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="block text-[10px] uppercase tracking-wider font-mono opacity-80">
                            Clip {idx + 1} ({snip.duration}s)
                          </span>
                          {snip.curatorScore ? (
                            <span className="rounded bg-emerald-950 text-emerald-300 text-[9px] font-mono px-1.5 py-0.2 border border-emerald-500/30">
                              ★ {snip.curatorScore}
                            </span>
                          ) : null}
                          {snip.energyLevel ? (
                            <span className="rounded bg-amber-950/60 text-amber-300 text-[9px] px-1.5 py-0.2">
                              {snip.energyLevel}
                            </span>
                          ) : null}
                        </div>
                        <span className="line-clamp-1 mt-0.5">{snip.episodeTitle}</span>
                      </button>
                    ))}
                  </div>

                  {activeClip ? (
                    <div className="rounded-2xl border border-white/15 bg-disco-dark/80 p-6 space-y-6 shadow-2xl">
                      {/* Active Clip Badges & Header */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase border ${
                              activeClip.isValidDuration
                                ? "bg-emerald-950 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-950 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {activeClip.isValidDuration ? "✓ Valid 15-45s Duration" : "Outside Spec"}
                          </span>
                          <span className="text-[11px] text-disco-cream/60 font-mono">
                            Window: {formatSeconds(activeClip.startTime)} &rarr;{" "}
                            {formatSeconds(activeClip.endTime)} ({clipDuration}s clip)
                          </span>
                          {activeClip.curatorScore ? (
                            <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold">
                              ★ {activeClip.curatorScore}/100 Curator Score
                            </span>
                          ) : null}
                          {activeClip.energyLevel ? (
                            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold">
                              ⚡ {activeClip.energyLevel}
                            </span>
                          ) : null}
                          {activeClip.topic ? (
                            <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold">
                              🏷 {activeClip.topic}
                            </span>
                          ) : null}
                        </div>

                        {/* Hook Text */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-disco-rose block">
                            OpenAI Curated Hook Quote (The 45s Hook)
                          </span>
                          <h4 className="text-xl font-extrabold text-disco-cream leading-tight">
                            &ldquo;{activeClip.hookText}&rdquo;
                          </h4>
                        </div>

                        {/* Why Listeners Will Love It */}
                        <div className="rounded-xl border border-disco-caramel/30 bg-disco-navy/40 p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-disco-caramel">
                            <span className="text-xs">⭐</span>
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              Why Listeners Will Fall In Love (Tinder Recommendation Rationale)
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-disco-cream/90 leading-relaxed font-medium">
                            {activeClip.whyYouWillLikeIt ||
                              "Curated highlight designed to demonstrate the core energy and host chemistry in 45 seconds."}
                          </p>
                        </div>

                        {/* Spoken Transcript */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/50 block">
                            Spoken Audio Window Transcript
                          </span>
                          <p className="mt-1 text-xs text-disco-cream/80 italic border-l-2 border-disco-rose/40 pl-3 leading-relaxed">
                            &ldquo;{activeClip.transcriptExcerpt}&rdquo;
                          </p>
                        </div>

                        {/* Alternatives Considered */}
                        {activeClip.alternativeMomentsConsidered ? (
                          <div className="rounded-xl border border-white/10 bg-disco-dark/50 p-3 space-y-1">
                            <span className="text-[10px] font-mono text-disco-cream/50 uppercase tracking-wider block">
                              Alternative Windows Evaluated &amp; Filtered
                            </span>
                            <p className="text-[11px] text-disco-cream/70 font-mono">
                              {activeClip.alternativeMomentsConsidered}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* Waveform Visualization */}
                      <div className="relative h-20 w-full overflow-hidden rounded-xl border border-white/10 bg-black/50 p-3 flex items-end gap-1">
                        {bars.map((height, i) => {
                          const barFraction = i / bars.length;
                          const isPlayed = barFraction <= progressFraction;
                          return (
                            <span
                              key={i}
                              className="flex-1 rounded-sm transition-colors duration-100"
                              style={{
                                height: `${height}%`,
                                backgroundColor: isPlayed ? "#b97179" : "#354156",
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Audio Player Controls */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-mono text-disco-cream/70">
                          <span>{formatSeconds(Math.floor(clipCurrentSeconds))}</span>
                          <span>{formatSeconds(clipDuration)}</span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={clipDuration}
                          step={0.1}
                          value={clipCurrentSeconds}
                          onChange={handleScrub}
                          className="w-full accent-disco-rose cursor-pointer"
                        />

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={togglePlay}
                              className="flex h-12 w-12 items-center justify-center rounded-full bg-disco-rose text-disco-dark shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
                              aria-label={isPlaying ? "Pause" : "Play"}
                            >
                              {isPlaying ? (
                                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                  <rect x="6" y="4" width="4" height="16" rx="1" />
                                  <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (audioRef.current && activeClip) {
                                  audioRef.current.currentTime = activeClip.startTime;
                                  setClipCurrentSeconds(0);
                                  void audioRef.current.play();
                                  setIsPlaying(true);
                                }
                              }}
                              className="rounded-full bg-disco-navy px-4 py-2 text-xs font-bold text-disco-cream border border-white/10 hover:border-white/30 cursor-pointer transition"
                            >
                              Replay Bounded Clip
                            </button>
                          </div>

                          <div className="text-[11px] text-disco-cream/60 font-mono">
                            Audio Stream: {activeClip.audioUrl ? "Online" : "No Audio URL"}
                          </div>
                        </div>
                      </div>

                      {/* Vector Embedding QA Card */}
                      <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-purple-300 uppercase tracking-wider">
                              Vector Embedding QA (text-embedding-3-small)
                            </span>
                            <span className="rounded bg-purple-900/60 text-purple-200 px-2 py-0.5 text-[10px] font-mono">
                              {activeClip.vectorDimensions} Dimensions
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-purple-300">
                            L2 Norm: <span className="font-bold">{activeClip.vectorNorm.toFixed(4)}</span> (~1.0000)
                          </div>
                        </div>

                        <div>
                          <span className="text-purple-300/60 text-[10px] font-mono block">
                            Preview Vector Floats (First 8 values):
                          </span>
                          <pre className="mt-1 rounded-lg bg-black/50 p-2.5 font-mono text-[10px] text-purple-200 overflow-x-auto">
                            [{activeClip.vectorPreview.map((v) => v.toFixed(5)).join(", ")}]
                          </pre>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-purple-300/70">
                          <span>Play Count: <strong className="text-white">{activeClip.playCount}</strong></span>
                          <span>Upvotes: <strong className="text-white">{activeClip.upvotes}</strong></span>
                          <span>Snippet ID: <code className="text-purple-200">{activeClip.snippetId}</code></span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            ) : null}

            {/* TAB 2: SHOW YOUR WORK DOSSIER (MARKDOWN) */}
            {openaiTab === "dossier" ? (
              <div className="space-y-4 animate-fade-in">
                {deepDive.openAiCurationReport?.curationMarkdown ? (
                  <div className="space-y-4">
                    {/* Dossier Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-disco-dark/70 border border-white/10 p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-0.5 text-[10px] font-bold">
                          ✓ Saved OpenAI Curation Dossier
                        </span>
                        <span className="text-xs font-mono text-disco-cream/60">
                          Latency: {deepDive.openAiCurationReport.latencyMs}ms
                        </span>
                        <span className="text-xs font-mono text-disco-cream/60">
                          Moments: {deepDive.openAiCurationReport.clipsEvaluated} evaluated &rarr;{" "}
                          {deepDive.openAiCurationReport.clipsSelected} curated
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyOpenaiMarkdown(deepDive.openAiCurationReport!.curationMarkdown)}
                        className="rounded-full bg-disco-rose/20 text-disco-rose border border-disco-rose/40 hover:bg-disco-rose hover:text-disco-dark px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{copiedOpenaiMarkdown ? "✓ Copied!" : "📋 Copy Markdown"}</span>
                      </button>
                    </div>

                    {/* Rendered Dossier Markdown */}
                    <div className="rounded-2xl border border-white/10 bg-disco-dark/80 p-6 shadow-inner">
                      <SimpleMarkdownViewer content={deepDive.openAiCurationReport.curationMarkdown} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center space-y-3">
                    <p className="text-sm font-bold text-disco-cream">
                      No OpenAI Curation Dossier Stored Yet
                    </p>
                    <p className="text-xs text-disco-cream/60 max-w-md mx-auto">
                      Ingest or re-enrich this show through the ingestion pipeline or Test Lab to generate the opinionated 5-section &ldquo;Show Your Work&rdquo; audio curation dossier.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* TAB 3: TINDER DISCOVERY CARD PREVIEW */}
            {openaiTab === "tinder_preview" ? (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl bg-disco-dark/50 border border-white/10 p-3 text-center">
                  <span className="text-[11px] font-mono text-disco-rose font-bold uppercase tracking-wider">
                    ⚡ Live Discovery Preview: Fall in Love with a Podcast in 45 Seconds
                  </span>
                  <p className="text-[11px] text-disco-cream/60 mt-0.5">
                    This is the exact interactive card users swipe through on DiscoPod to discover this show.
                  </p>
                </div>

                {activeClip ? (
                  <div className="max-w-md mx-auto">
                    {/* Active Tinder Card Container */}
                    <div className="relative rounded-3xl bg-disco-navy p-5 sm:p-6 shadow-2xl border border-white/15 backdrop-blur-md space-y-4">
                      {/* Show Header & Cover Art */}
                      <div className="flex items-start gap-4 pb-3 border-b border-white/10">
                        <div className="relative h-20 w-20 shrink-0 rounded-2xl overflow-hidden shadow-xl ring-2 ring-disco-cream/20 bg-disco-dark">
                          {deepDive.show.coverArtUrl ? (
                            <img
                              src={deepDive.show.coverArtUrl}
                              alt={deepDive.show.title}
                              className="h-full w-full object-cover select-none"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-disco-cream/40">
                              No Art
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="rounded-full bg-disco-rose/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-rose border border-disco-rose/30">
                              {activeClip.curatorScore || 96}% Vibe Match
                            </span>
                            <span className="rounded-full bg-disco-cream/10 px-2 py-0.5 text-[10px] font-bold text-disco-cream/70">
                              {activeClip.topic || "Curated Podcast"}
                            </span>
                          </div>

                          <h3 className="font-['Lato'] text-lg font-extrabold text-disco-cream leading-tight line-clamp-2">
                            {deepDive.show.title}
                          </h3>
                          <p className="text-xs text-disco-cream/60 mt-0.5 line-clamp-1">
                            Hosted by {deepDive.show.hostName || "Hosts"}
                          </p>
                        </div>
                      </div>

                      {/* "Why you might like this" Golden Rationale */}
                      <div className="rounded-2xl bg-disco-dark/60 p-3.5 border border-disco-caramel/40 space-y-1">
                        <div className="flex items-center gap-1.5 text-disco-caramel">
                          <span className="text-xs">⭐</span>
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Why you might like this
                          </span>
                        </div>
                        <p className="text-xs text-disco-cream/90 leading-relaxed font-medium">
                          {activeClip.whyYouWillLikeIt ||
                            deepDive.openAiCurationReport?.fallInLovePromise ||
                            deepDive.show.description}
                        </p>
                      </div>

                      {/* Clip Switcher Pills */}
                      {deepDive.snippets.length > 1 ? (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          <span className="text-[10px] uppercase tracking-wider text-disco-cream/40 font-mono shrink-0">
                            Clips:
                          </span>
                          {deepDive.snippets.map((snip, idx) => (
                            <button
                              key={snip.snippetId}
                              type="button"
                              onClick={() => setSelectedClipIndex(idx)}
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition cursor-pointer ${
                                selectedClipIndex === idx
                                  ? "bg-disco-rose text-disco-dark shadow"
                                  : "bg-white/10 text-disco-cream/70 hover:bg-white/20"
                              }`}
                            >
                              Clip {idx + 1} ({snip.duration}s)
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Hook Quote Box */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-disco-rose">
                            Featured 45s Hook
                          </span>
                          <span className="text-[10px] font-mono text-disco-cream/50">
                            {clipDuration}s clip
                          </span>
                        </div>
                        <p className="text-sm sm:text-base font-extrabold text-disco-cream italic leading-snug">
                          &ldquo;{activeClip.hookText}&rdquo;
                        </p>
                      </div>

                      {/* Audio Playback Controls */}
                      <div className="rounded-2xl bg-black/40 p-3 space-y-2 border border-white/5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-disco-cream/60">
                          <span>{formatSeconds(Math.floor(clipCurrentSeconds))}</span>
                          <span>{formatSeconds(clipDuration)}</span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={clipDuration}
                          step={0.1}
                          value={clipCurrentSeconds}
                          onChange={handleScrub}
                          className="w-full accent-disco-rose cursor-pointer"
                        />

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={togglePlay}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-disco-rose text-disco-dark shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                          >
                            {isPlaying ? (
                              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCardTranscript(!showCardTranscript)}
                            className="text-[10px] text-disco-cream/60 hover:text-disco-cream transition underline font-mono"
                          >
                            {showCardTranscript ? "Hide Transcript ▲" : "Show Transcript ▼"}
                          </button>
                        </div>

                        {showCardTranscript ? (
                          <div className="pt-2 text-[11px] text-disco-cream/75 italic border-t border-white/10 leading-relaxed">
                            &ldquo;{activeClip.transcriptExcerpt}&rdquo;
                          </div>
                        ) : null}
                      </div>

                      {/* Bottom Tinder Buttons Simulator */}
                      <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:scale-110 active:scale-95 transition shadow-lg cursor-pointer"
                          title="Pass"
                        >
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-disco-dark hover:scale-110 active:scale-95 transition shadow-xl cursor-pointer"
                          title="Love It"
                        >
                          <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={onNavigateToDiscovery}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-disco-caramel/20 text-disco-caramel border border-disco-caramel/40 hover:scale-110 active:scale-95 transition shadow-lg cursor-pointer"
                          title="Explore on Globe"
                        >
                          <span className="text-lg">🌐</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-disco-cream/60">
                    No clip selected to preview in Tinder card.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* SECTION 4: Episodes Catalogue QA */}
          <div className="rounded-3xl border border-white/10 bg-disco-navy/30 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-disco-cream uppercase tracking-wider">
                  Ingested Episodes ({deepDive.episodes.length})
                </h3>
                <p className="text-xs text-disco-cream/60">
                  Full catalogue of episodes parsed from RSS and persisted in Convex.
                </p>
              </div>
            </div>

            <div className="divide-y divide-white/5 space-y-2">
              {deepDive.episodes.map((ep, idx) => {
                const formattedDate = new Date(ep.pubDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const durationFormatted =
                  ep.durationSeconds > 3600
                    ? `${Math.floor(ep.durationSeconds / 3600)}h ${Math.floor((ep.durationSeconds % 3600) / 60)}m`
                    : `${Math.floor(ep.durationSeconds / 60)}m ${ep.durationSeconds % 60}s`;

                return (
                  <div key={ep.episodeId} className="pt-3 first:pt-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono text-disco-cream/40 uppercase mr-2">
                          #{idx + 1}
                        </span>
                        <span className="text-sm font-bold text-disco-cream">{ep.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-disco-cream/60 font-mono">
                        <span>{formattedDate}</span>
                        <span>&bull;</span>
                        <span>{durationFormatted}</span>
                      </div>
                    </div>

                    <p className="text-xs text-disco-cream/70 line-clamp-2 leading-relaxed">
                      {ep.summary || "No episode summary provided in RSS feed."}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-disco-cream/50 pt-1">
                      <a
                        href={ep.audioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-disco-rose underline hover:text-disco-rose/80"
                      >
                        Audio Stream URL ↗
                      </a>
                      <span>&bull;</span>
                      <span className="font-mono">Episode ID: {ep.episodeId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: Raw Document JSON QA Inspector */}
          <div className="rounded-3xl border border-white/10 bg-disco-navy/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-disco-cream uppercase tracking-wider">
                  Raw Convex Document JSON
                </h3>
                <p className="text-xs text-disco-cream/60">
                  Inspect the exact JSON records returned from the Convex database.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="rounded-full bg-disco-navy hover:bg-white/10 text-disco-cream px-4 py-1.5 text-xs font-bold border border-white/15 transition cursor-pointer"
                >
                  {copiedJson ? "✓ Copied JSON" : "Copy JSON"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="rounded-full bg-disco-navy hover:bg-white/10 text-disco-cream px-4 py-1.5 text-xs font-bold border border-white/15 transition cursor-pointer"
                >
                  {showRawJson ? "Hide JSON" : "View Raw JSON"}
                </button>
              </div>
            </div>

            {showRawJson ? (
              <pre className="rounded-2xl border border-white/10 bg-black/70 p-4 font-mono text-[10px] text-emerald-300 max-h-96 overflow-auto">
                {JSON.stringify(deepDive, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Show Matching Helpers & Podcast Discovery Section
// ----------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function slugifyCandidate(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchIngestedShow(
  candidate: PodcastCandidate,
  ingestedShows: AdminShowSummary[],
): AdminShowSummary | undefined {
  const candFeed = candidate.feedUrl?.trim().toLowerCase().replace(/\/+$/, "");
  const candSlug = slugifyCandidate(candidate.title);
  const candNormTitle = normalizeText(candidate.title);

  return ingestedShows.find((s) => {
    // 1. Match by RSS feed URL
    if (s.rssUrl && candFeed) {
      const sFeed = s.rssUrl.trim().toLowerCase().replace(/\/+$/, "");
      if (sFeed === candFeed) return true;
    }
    // 2. Match by slug
    if (s.slug && candSlug && s.slug === candSlug) {
      return true;
    }
    // 3. Match by normalized alphanumeric title
    if (s.title && candNormTitle && normalizeText(s.title) === candNormTitle) {
      return true;
    }
    return false;
  });
}

function PodcastDiscoveryFlowSection({
  onShowSeeded,
  activeSeededShow,
  ingestedShows,
  onInspectShow,
}: {
  onShowSeeded: (showDetail: SeededShowDetail) => void;
  activeSeededShow: SeededShowDetail | null;
  ingestedShows: AdminShowSummary[];
  onInspectShow?: (showId: string) => void;
}) {
  const [genre, setGenre] = useState("technology");
  const [searchTerm, setSearchTerm] = useState("");
  const [selection, setSelection] = useState<"top" | "random">("top");
  const [recentOnly, setRecentOnly] = useState(true);
  const [queryLimit, setQueryLimit] = useState(50);

  const [loadingQuery, setLoadingQuery] = useState(false);
  const [candidates, setCandidates] = useState<PodcastCandidate[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);

  // New & Notable showcase states
  const [notableShows, setNotableShows] = useState<PodcastCandidate[]>([]);
  const [loadingNotable, setLoadingNotable] = useState(false);
  const [notableFilter, setNotableFilter] = useState<string>("all");

  // Seeding states
  const [seedingShowId, setSeedingShowId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    isActive: boolean;
    status: "running" | "success" | "error";
    showTitle: string;
    step: number;
    secondsElapsed: number;
    errorMessage?: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [batchSeeding, setBatchSeeding] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentShowTitle: string;
  } | null>(null);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const convex = useConvex();
  const previewSectionRef = useRef<HTMLDivElement | null>(null);
  const [loadingPreviewShowId, setLoadingPreviewShowId] = useState<string | null>(null);

  const queryPodcasts = useAction(api.podcastDiscoveryActions.queryPodcasts);
  const queryNewAndNotable = useAction(api.podcastDiscoveryActions.queryNewAndNotablePodcasts);
  const enrichAndSeedShow = useAction(api.podcastDiscoveryActions.enrichAndSeedShow);

  const unseededCandidates = useMemo(
    () => candidates.filter((c) => !matchIngestedShow(c, ingestedShows)),
    [candidates, ingestedShows],
  );

  const filteredNotableShows = useMemo(() => {
    if (notableFilter === "all") return notableShows;
    const lower = notableFilter.toLowerCase();
    return notableShows.filter((s) => {
      const g = (s.genre || "").toLowerCase();
      const t = (s.title || "").toLowerCase();
      const h = (s.hostName || "").toLowerCase();
      if (lower === "tech") {
        return (
          g.includes("tech") ||
          t.includes("tech") ||
          t.includes("ai") ||
          t.includes("fork") ||
          h.includes("mkbhd") ||
          t.includes("lex") ||
          t.includes("dwarkesh")
        );
      }
      if (lower === "crime") {
        return (
          g.includes("crime") ||
          g.includes("investigative") ||
          t.includes("scam") ||
          t.includes("darknet")
        );
      }
      if (lower === "business") {
        return (
          g.includes("business") ||
          t.includes("acquired") ||
          t.includes("ceo") ||
          t.includes("money")
        );
      }
      if (lower === "comedy") {
        return (
          g.includes("comedy") ||
          t.includes("smartless") ||
          t.includes("gossip")
        );
      }
      if (lower === "health") {
        return (
          g.includes("health") ||
          g.includes("science") ||
          t.includes("huberman") ||
          t.includes("modern wisdom")
        );
      }
      return g.includes(lower) || t.includes(lower);
    });
  }, [notableShows, notableFilter]);

  const unseededNotableShows = useMemo(
    () => filteredNotableShows.filter((s) => !matchIngestedShow(s, ingestedShows)),
    [filteredNotableShows, ingestedShows],
  );

  async function handlePreviewIngestedShow(ingested: AdminShowSummary) {
    setLoadingPreviewShowId(ingested.showId);
    try {
      const clipsData = await convex.query(api.admin.getShowClipsForAdmin, {
        showId: ingested.showId,
      });

      if (clipsData) {
        onShowSeeded(clipsData as SeededShowDetail);
        setTimeout(() => {
          previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (err) {
      console.error("Failed to load show clips:", err);
    } finally {
      setLoadingPreviewShowId(null);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadNewAndNotable = useCallback(async () => {
    setLoadingNotable(true);
    try {
      const results = await queryNewAndNotable({ limit: 40 });
      if (results && results.length > 0) {
        setNotableShows(results);
      }
    } catch (err) {
      console.warn("Could not load New & Notable via Convex action:", err);
      try {
        const fallback = await fetchApplePodcastsClient({
          genre: "all",
          selection: "top",
          recentOnly: false,
          limit: 30,
        });
        setNotableShows(fallback);
      } catch (fallbackErr) {
        console.error("New & Notable fallback failed:", fallbackErr);
      }
    } finally {
      setLoadingNotable(false);
    }
  }, [queryNewAndNotable]);

  async function handleSearch() {
    setLoadingQuery(true);
    setQueryError(null);
    try {
      const actionPromise = queryPodcasts({
        genre,
        query: searchTerm.trim() || undefined,
        selection,
        recentOnly,
        limit: queryLimit,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Convex action timed out")), 12000),
      );

      let results: PodcastCandidate[];
      try {
        results = await Promise.race([actionPromise, timeoutPromise]);
      } catch {
        // Resilient fallback to direct Apple Podcasts API fetch
        results = await fetchApplePodcastsClient({
          genre,
          query: searchTerm.trim() || undefined,
          selection,
          recentOnly,
          limit: queryLimit,
        });
      }

      setCandidates(results);
      if (results.length === 0) {
        setQueryError(
          "No shows matched the criteria. Try unchecking 'Active in last 4 weeks only' or searching a different keyword.",
        );
      }
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Failed to query podcasts.");
    } finally {
      setLoadingQuery(false);
    }
  }

  // Load initial directory shows & New & Notable on mount
  useEffect(() => {
    void handleSearch();
    void loadNewAndNotable();
  }, []);

  async function handleSeedSingle(candidate: PodcastCandidate) {
    const alreadyIngested = matchIngestedShow(candidate, ingestedShows);
    if (alreadyIngested) {
      await handlePreviewIngestedShow(alreadyIngested);
      return;
    }

    setSeedingShowId(candidate.appleId);

    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    setProgress({
      isActive: true,
      status: "running",
      showTitle: candidate.title,
      step: 1,
      secondsElapsed: 0,
    });

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      let step = 1;
      if (elapsed >= 7) {
        step = 4;
      } else if (elapsed >= 4) {
        step = 3;
      } else if (elapsed >= 2) {
        step = 2;
      }
      setProgress((prev) =>
        prev && prev.status === "running"
          ? { ...prev, secondsElapsed: elapsed, step }
          : prev,
      );
    }, 500);

    try {
      const result = await enrichAndSeedShow({
        feedUrl: candidate.feedUrl,
        title: candidate.title,
        hostName: candidate.hostName,
        coverArtUrl: candidate.coverArtUrl,
        genre: candidate.genre,
      });

      if (timerRef.current) clearInterval(timerRef.current);
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      setProgress({
        isActive: true,
        status: "success",
        showTitle: candidate.title,
        step: 4,
        secondsElapsed: totalElapsed,
      });

      onShowSeeded(result);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      setProgress({
        isActive: true,
        status: "error",
        showTitle: candidate.title,
        step: 0,
        secondsElapsed: totalElapsed,
        errorMessage: err instanceof Error ? err.message : "Enrichment pipeline error",
      });
    } finally {
      setSeedingShowId(null);
    }
  }

  async function handleBatchSeedList(items: PodcastCandidate[], countToSeed?: number) {
    const unseeded = items.filter((c) => !matchIngestedShow(c, ingestedShows));
    const targetCount = countToSeed ?? Math.min(5, unseeded.length);
    if (targetCount <= 0 || unseeded.length === 0) return;

    const toProcess = unseeded.slice(0, targetCount);
    setBatchSeeding(true);
    setBatchResult(null);

    let succeeded = 0;
    const errors: string[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      const candidate = toProcess[i];
      if (!candidate) continue;

      setBatchProgress({
        current: i + 1,
        total: toProcess.length,
        currentShowTitle: candidate.title,
      });

      try {
        await enrichAndSeedShow({
          feedUrl: candidate.feedUrl,
          title: candidate.title,
          hostName: candidate.hostName,
          coverArtUrl: candidate.coverArtUrl,
          genre: candidate.genre || genre,
        });
        succeeded++;
      } catch (err) {
        console.error(`Failed seeding ${candidate.title}:`, err);
        errors.push(`${candidate.title}: ${err instanceof Error ? err.message : "Enrichment error"}`);
      }

      if (i < toProcess.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setBatchProgress(null);
    setBatchSeeding(false);

    const remaining = Math.max(0, unseeded.length - succeeded);
    const remainingText =
      remaining === 0
        ? " — All selected shows are now ingested! ✓"
        : ` — ${remaining} unseeded shows remaining.`;

    const errorDetails =
      errors.length > 0
        ? ` (${errors.length} shows encountered issues: ${errors.slice(0, 2).join("; ")}${errors.length > 2 ? "..." : ""})`
        : "";

    setBatchResult(
      `✓ Batch complete: successfully enriched and seeded ${succeeded}/${toProcess.length} shows!${errorDetails}${remainingText}`,
    );
  }

  async function handleBatchSeed(countToSeed?: number) {
    await handleBatchSeedList(unseededCandidates, countToSeed);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 0. 🎧 STREAMING PLATFORM LINKS CATCH-UP DASHBOARD */}
      <PlatformLinksCatchUpSection />

      {/* 1. 🔥 NEW & NOTABLE / TRENDING BREAKOUTS SHOWCASE SECTION */}
      <div className="rounded-2xl border border-disco-rose/30 bg-gradient-to-br from-disco-rose/10 via-disco-navy/40 to-disco-dark/90 p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-disco-rose animate-pulse" />
              <h3 className="text-base font-black uppercase tracking-wider text-disco-cream flex items-center gap-2">
                🔥 New &amp; Notable / Trending Breakouts
              </h3>
              <span className="rounded-full bg-disco-rose/20 text-disco-rose border border-disco-rose/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                Curated + Top Charts
              </span>
            </div>
            <p className="text-xs text-disco-cream/70">
              High-momentum breakout debuts and chart-topping series across AI, Tech, Investigative Journalism, Business, and Comedy.
            </p>
          </div>

          {/* Quick Actions for New & Notable */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadNewAndNotable()}
              disabled={loadingNotable || batchSeeding}
              className="rounded-full border border-white/20 bg-disco-dark/60 hover:bg-disco-dark px-3.5 py-1.5 text-xs font-bold text-disco-cream/80 hover:text-disco-cream transition cursor-pointer flex items-center gap-1.5"
            >
              <span className={loadingNotable ? "animate-spin inline-block" : ""}>🔄</span>
              {loadingNotable ? "Refreshing..." : "Refresh Debuts"}
            </button>

            {unseededNotableShows.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleBatchSeedList(unseededNotableShows, Math.min(5, unseededNotableShows.length))}
                  disabled={batchSeeding || Boolean(seedingShowId)}
                  className="rounded-full bg-disco-caramel hover:bg-disco-caramel/90 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow transition cursor-pointer"
                >
                  Batch Seed Next 5
                </button>
                <button
                  type="button"
                  onClick={() => void handleBatchSeedList(unseededNotableShows, unseededNotableShows.length)}
                  disabled={batchSeeding || Boolean(seedingShowId)}
                  className="rounded-full bg-disco-rose hover:bg-disco-rose/90 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow transition cursor-pointer"
                >
                  Batch Seed ALL ({unseededNotableShows.length}) Debuts
                </button>
              </>
            ) : (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-1 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>✓</span> All Featured Debuts Ingested
              </span>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: `All Breakouts (${notableShows.length})` },
            { id: "tech", label: "Tech & AI" },
            { id: "crime", label: "Investigative & Crime" },
            { id: "business", label: "Business & Startups" },
            { id: "comedy", label: "Comedy & Culture" },
            { id: "health", label: "Health & Science" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setNotableFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                notableFilter === tab.id
                  ? "bg-disco-rose text-disco-dark shadow"
                  : "bg-disco-dark/70 text-disco-cream/60 hover:text-disco-cream border border-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notable Shows Compact Grid */}
        {loadingNotable && notableShows.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-xs text-disco-cream/60">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-disco-rose border-t-transparent mr-2" />
            Loading breakout shows...
          </div>
        ) : filteredNotableShows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-disco-cream/50">
            No shows in this category. Click &ldquo;All Breakouts&rdquo; above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredNotableShows.map((show) => {
              const ingested = matchIngestedShow(show, ingestedShows);
              const isIngested = Boolean(ingested);
              const isSeedingThis = seedingShowId === show.appleId;
              const isLoadingPreview = ingested && loadingPreviewShowId === ingested.showId;

              return (
                <div
                  key={show.appleId}
                  className={`rounded-xl border p-3 flex flex-col justify-between space-y-3 transition ${
                    isIngested
                      ? "border-emerald-500/40 bg-emerald-950/20"
                      : "border-white/10 bg-disco-dark/60 hover:border-disco-rose/40"
                  }`}
                >
                  <div className="flex gap-2.5">
                    <img
                      src={show.coverArtUrl || "https://placehold.co/100x100"}
                      alt={show.title}
                      className="h-12 w-12 rounded-lg object-cover border border-white/10 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-disco-rose uppercase line-clamp-1">
                          {show.genre}
                        </span>
                        {isIngested ? (
                          <span className="ml-auto text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            ✓ Ingested
                          </span>
                        ) : null}
                      </div>
                      <h5 className="font-bold text-xs text-disco-cream line-clamp-1">
                        {show.title}
                      </h5>
                      <p className="text-[10px] text-disco-cream/60 line-clamp-1">{show.hostName}</p>
                    </div>
                  </div>

                  <div>
                    {isIngested && ingested ? (
                      <button
                        type="button"
                        onClick={() => void handlePreviewIngestedShow(ingested)}
                        disabled={isLoadingPreview}
                        className="w-full rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        {isLoadingPreview ? "Loading..." : "✓ Preview Ingested Clips"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSeedSingle(show)}
                        disabled={Boolean(seedingShowId) || batchSeeding}
                        className="w-full rounded-lg bg-disco-rose/90 hover:bg-disco-rose text-disco-dark px-2.5 py-1 text-[11px] font-black uppercase tracking-wider shadow active:scale-95 disabled:opacity-50 transition cursor-pointer"
                      >
                        {isSeedingThis ? "Enriching..." : "Seed Show"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Top Query Controls Card */}
      <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 space-y-6">
        <div>
          <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
            Query Podcasts Directory (Apple Podcasts &amp; RSS)
          </h3>
          <p className="mt-1 text-xs text-disco-cream/70">
            Query shows by genre or search keywords. Filter for shows with recent episodes released in the last 4 weeks. Expand up to top 50 in any category.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Genre Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-disco-cream/60">
              Genre
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2.5 text-xs text-disco-cream focus:border-disco-rose focus:outline-none"
            >
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Keywords */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-disco-cream/60">
              Search by Title or Host
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Lex Fridman, Syntax, AI..."
              className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2.5 text-xs text-disco-cream placeholder-disco-cream/40 focus:border-disco-rose focus:outline-none"
            />
          </div>

          {/* Selection Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-disco-cream/60">
              Selection Mode
            </label>
            <div className="flex rounded-xl border border-white/15 p-1 bg-disco-dark/80">
              <button
                type="button"
                onClick={() => setSelection("top")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                  selection === "top"
                    ? "bg-disco-rose text-disco-dark shadow"
                    : "text-disco-cream/60 hover:text-disco-cream"
                }`}
              >
                Top Shows
              </button>
              <button
                type="button"
                onClick={() => setSelection("random")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                  selection === "random"
                    ? "bg-disco-rose text-disco-dark shadow"
                    : "text-disco-cream/60 hover:text-disco-cream"
                }`}
              >
                Random Sample
              </button>
            </div>
          </div>

          {/* Candidate Limit */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-disco-cream/60">
              Candidate Limit
            </label>
            <select
              value={queryLimit}
              onChange={(e) => setQueryLimit(Number(e.target.value))}
              className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2.5 text-xs text-disco-cream focus:border-disco-rose focus:outline-none"
            >
              <option value={20}>Top 20 Candidates</option>
              <option value={35}>Top 35 Candidates</option>
              <option value={50}>Top 50 Candidates (Max)</option>
            </select>
          </div>

          {/* Recent Episode Filter & Submit */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center gap-2 text-xs text-disco-cream/80 cursor-pointer select-none mb-1">
              <input
                type="checkbox"
                checked={recentOnly}
                onChange={(e) => setRecentOnly(e.target.checked)}
                className="accent-disco-rose rounded"
              />
              <span className="text-[11px] font-semibold">Active in last 4w only</span>
            </label>

            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loadingQuery}
              className="w-full rounded-xl bg-disco-rose px-5 py-2.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              {loadingQuery ? "Querying Shows..." : "Query Podcasts"}
            </button>
          </div>
        </div>

        {queryError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
            {queryError}
          </div>
        ) : null}
      </div>

      {/* Multi-Step Pipeline Progress Indicator with Live Timer */}
      {progress && progress.isActive ? (
        <div
          className={`rounded-3xl border p-6 transition-all duration-300 shadow-xl space-y-4 ${
            progress.status === "error"
              ? "border-rose-500/50 bg-rose-950/30 text-rose-200"
              : progress.status === "success"
                ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-200"
                : "border-disco-rose/60 bg-disco-navy/80 text-disco-cream"
          }`}
        >
          {/* Header Row with Show Title & Timer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              {progress.status === "running" ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-disco-rose opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-disco-rose" />
                </span>
              ) : progress.status === "success" ? (
                <span className="text-emerald-400 font-black text-base">✓</span>
              ) : (
                <span className="text-rose-400 font-black text-base">✕</span>
              )}
              <div>
                <h4 className="font-extrabold text-sm text-disco-cream">
                  {progress.status === "running"
                    ? `Enriching & Slicing Clips: "${progress.showTitle}"`
                    : progress.status === "success"
                      ? `Successfully Seeded: "${progress.showTitle}"`
                      : `Enrichment Failed: "${progress.showTitle}"`}
                </h4>
                <p className="text-[11px] text-disco-cream/60">
                  {progress.status === "running"
                    ? "Full pipeline in progress: RSS → Firecrawl → OpenAI → Convex Vector Index"
                    : progress.status === "success"
                      ? `Completed in ${progress.secondsElapsed}s! 3 audio clips and vector embeddings created.`
                      : progress.errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-disco-caramel bg-disco-dark/60 px-3 py-1 rounded-full border border-white/10">
                ⏱️ {progress.secondsElapsed}s elapsed
              </span>
              {progress.status !== "running" ? (
                <button
                  type="button"
                  onClick={() => setProgress(null)}
                  className="text-xs text-disco-cream/60 hover:text-disco-cream underline cursor-pointer"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>

          {/* 4-Step Visual Stepper */}
          {progress.status === "running" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Step 1 */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition ${
                  progress.step > 1
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : progress.step === 1
                      ? "border-disco-rose bg-disco-rose/10 text-disco-cream shadow"
                      : "border-white/5 bg-white/5 text-disco-cream/40"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>1. RSS &amp; Audio Feed</span>
                  <span>{progress.step > 1 ? "✓ Done" : progress.step === 1 ? "Active..." : "Pending"}</span>
                </div>
                <p className="text-[10px] mt-1 opacity-70">Extracting feed XML &amp; 3 recent episodes</p>
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition ${
                  progress.step > 2
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : progress.step === 2
                      ? "border-disco-caramel bg-disco-caramel/10 text-disco-cream shadow"
                      : "border-white/5 bg-white/5 text-disco-cream/40"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>2. Firecrawl Intel</span>
                  <span>{progress.step > 2 ? "✓ Done" : progress.step === 2 ? "Active..." : "Pending"}</span>
                </div>
                <p className="text-[10px] mt-1 opacity-70">Reviews, host info &amp; social profiles</p>
              </div>

              {/* Step 3 */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition ${
                  progress.step > 3
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : progress.step === 3
                      ? "border-disco-rose bg-disco-rose/10 text-disco-cream shadow"
                      : "border-white/5 bg-white/5 text-disco-cream/40"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>3. OpenAI Hook Slicing</span>
                  <span>{progress.step > 3 ? "✓ Done" : progress.step === 3 ? "Active..." : "Pending"}</span>
                </div>
                <p className="text-[10px] mt-1 opacity-70">15-45s hooks &amp; &ldquo;Why you&rsquo;ll love it&rdquo;</p>
              </div>

              {/* Step 4 */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition ${
                  progress.step >= 4
                    ? "border-purple-500 bg-purple-950/20 text-purple-200 shadow"
                    : "border-white/5 bg-white/5 text-disco-cream/40"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>4. Vectors &amp; Convex DB</span>
                  <span>{progress.step >= 4 ? "Active..." : "Pending"}</span>
                </div>
                <p className="text-[10px] mt-1 opacity-70">1536-dim vector embeddings &amp; 3D globe</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Batch Seeding Action Bar */}
      {candidates.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-disco-cream/90 font-medium">
                Found <span className="font-bold text-disco-rose">{candidates.length}</span> matching shows
                {candidates.some((c) => matchIngestedShow(c, ingestedShows)) ? (
                  <span>
                    {" "}
                    (
                    <span className="font-bold text-emerald-400">
                      {candidates.filter((c) => matchIngestedShow(c, ingestedShows)).length} already ingested
                    </span>
                    )
                  </span>
                ) : null}
                {unseededCandidates.length > 0 ? (
                  <span>
                    {" "}
                    &bull;{" "}
                    <span className="font-bold text-disco-caramel">
                      {unseededCandidates.length} unseeded remaining
                    </span>
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-disco-cream/60">
                Autonomous Firecrawl research, OpenAI clip extraction, and vector embedding. Ingested shows are strictly skipped to prevent duplicate token burn.
              </p>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {unseededCandidates.length === 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-xs font-bold text-emerald-300">
                  <span>✓</span> All {candidates.length} Shows Ingested
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleBatchSeed(Math.min(5, unseededCandidates.length))}
                    disabled={batchSeeding || Boolean(seedingShowId)}
                    className="rounded-full bg-disco-caramel px-4 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                  >
                    {batchSeeding ? "Seeding..." : `Batch Seed Next ${Math.min(5, unseededCandidates.length)} Shows`}
                  </button>

                  {unseededCandidates.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => void handleBatchSeed(10)}
                      disabled={batchSeeding || Boolean(seedingShowId)}
                      className="rounded-full bg-disco-cream px-4 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                    >
                      {batchSeeding ? "Seeding..." : "Batch Seed Next 10 Shows"}
                    </button>
                  ) : null}

                  {unseededCandidates.length > 15 ? (
                    <button
                      type="button"
                      onClick={() => void handleBatchSeed(25)}
                      disabled={batchSeeding || Boolean(seedingShowId)}
                      className="rounded-full bg-purple-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                    >
                      {batchSeeding ? "Seeding..." : "Batch Seed Next 25 Shows"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleBatchSeed(unseededCandidates.length)}
                    disabled={batchSeeding || Boolean(seedingShowId)}
                    className="rounded-full bg-disco-rose px-4 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
                  >
                    {batchSeeding ? "Seeding..." : `Batch Seed ALL (${unseededCandidates.length}) Unseeded Shows`}
                  </button>
                </>
              )}
            </div>
          </div>

          {batchSeeding ? (
            <div className="rounded-xl border border-disco-caramel/40 bg-disco-caramel/10 p-4 text-xs text-disco-caramel flex items-center gap-3.5">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-disco-caramel border-t-transparent shrink-0" />
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-2">
                  <span>Batch Seeding in progress:</span>
                  {batchProgress ? (
                    <span className="rounded-full bg-disco-caramel/30 px-2 py-0.5 text-[11px] font-mono font-black text-disco-cream">
                      Show {batchProgress.current} of {batchProgress.total}
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-disco-cream/80">
                  {batchProgress ? (
                    <span>
                      Enriching <strong className="text-disco-rose font-bold">&ldquo;{batchProgress.currentShowTitle}&rdquo;</strong> (autonomous Firecrawl research + OpenAI clip curation)...
                    </span>
                  ) : (
                    "Preparing shows and skipping duplicates..."
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {batchResult ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200">
              {batchResult}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Interactive 45-Second Clip Previewer (Highlighted when show is seeded) */}
      {activeSeededShow ? (
        <div
          ref={previewSectionRef}
          className="rounded-3xl border-2 border-disco-rose bg-disco-navy/60 p-6 sm:p-8 shadow-2xl space-y-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-disco-rose px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-dark">
                  Validated &amp; Seeded
                </span>
                <span className="text-xs text-emerald-300 font-bold">15-45s Hook Preview</span>
              </div>
              <h3 className="mt-1 text-xl font-extrabold text-disco-cream">
                {activeSeededShow.title}
              </h3>
              <p className="text-xs text-disco-cream/60">
                Hosted by {activeSeededShow.hostName} &bull; Website:{" "}
                <a
                  href={activeSeededShow.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-disco-caramel"
                >
                  {activeSeededShow.websiteUrl || "Extracted"}
                </a>
              </p>
            </div>

            {/* Firecrawl Signals Badge */}
            <div className="rounded-xl border border-white/10 bg-disco-dark/60 p-3 max-w-sm text-[11px] text-disco-cream/70">
              <span className="font-bold text-disco-rose block mb-1">Firecrawl Signals:</span>
              <p className="line-clamp-2 italic">&ldquo;{activeSeededShow.firecrawlSignals.reviews}&rdquo;</p>
            </div>
          </div>

          {/* 45-Second Clip Audio Player Component */}
          <FortyFiveSecondClipPlayer clips={activeSeededShow.clips} showTitle={activeSeededShow.title} />
        </div>
      ) : null}

      {/* Candidate Shows Grid */}
      <div className="space-y-4">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-disco-cream">
          Directory Results ({candidates.length})
        </h4>

        {candidates.length === 0 && !loadingQuery ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-disco-cream/60">
            No shows found. Select a genre above and click &ldquo;Query Podcasts&rdquo;.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((show) => {
              const ingested = matchIngestedShow(show, ingestedShows);
              const isIngested = Boolean(ingested);
              const isSeedingThis = seedingShowId === show.appleId;
              const isLoadingPreview = ingested && loadingPreviewShowId === ingested.showId;
              const isActiveInPlayer = Boolean(
                activeSeededShow &&
                  ((ingested && activeSeededShow.showId === ingested.showId) ||
                    normalizeText(activeSeededShow.title) === normalizeText(show.title)),
              );

              const formattedDate = new Date(show.releaseDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={show.appleId}
                  className={`rounded-2xl border p-4 flex flex-col justify-between space-y-4 transition ${
                    isIngested
                      ? "border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-500/70 shadow-sm shadow-emerald-950/40"
                      : "border-white/10 bg-disco-navy/30 hover:border-white/20"
                  }`}
                >
                  <div className="flex gap-3">
                    <img
                      src={show.coverArtUrl || "https://placehold.co/100x100"}
                      alt={show.title}
                      className={`h-16 w-16 rounded-xl object-cover shadow border flex-shrink-0 ${
                        isIngested ? "border-emerald-500/40 ring-2 ring-emerald-500/20" : "border-white/10"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-disco-cream/70 uppercase">
                          {show.genre}
                        </span>
                        {show.isRecent ? (
                          <span className="rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                            Recent (4w)
                          </span>
                        ) : null}
                        {isIngested ? (
                          <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">✓</span> Ingested
                          </span>
                        ) : null}
                      </div>
                      <h5 className="mt-1 font-bold text-xs text-disco-cream line-clamp-1">
                        {show.title}
                      </h5>
                      <p className="text-[11px] text-disco-cream/60 line-clamp-1">{show.hostName}</p>
                      <div className="flex items-center justify-between text-[10px] text-disco-cream/40 mt-0.5">
                        <span>Updated: {formattedDate}</span>
                        {isIngested && ingested ? (
                          <span className="text-emerald-400/80 font-mono font-medium">
                            {ingested.snippetCount} clip{ingested.snippetCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isIngested && ingested ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handlePreviewIngestedShow(ingested)}
                        disabled={isLoadingPreview}
                        className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 ${
                          isActiveInPlayer
                            ? "bg-emerald-500 text-disco-dark shadow ring-2 ring-emerald-300/50"
                            : "bg-emerald-700 hover:bg-emerald-600 text-white shadow"
                        }`}
                      >
                        {isLoadingPreview ? (
                          <span>Loading...</span>
                        ) : (
                          <>
                            <span>✓</span>
                            <span>{isActiveInPlayer ? "Playing" : "Preview"}</span>
                          </>
                        )}
                      </button>
                      {onInspectShow ? (
                        <button
                          type="button"
                          onClick={() => onInspectShow(ingested.showId)}
                          className="flex-1 rounded-xl bg-disco-rose hover:bg-disco-rose/90 text-disco-dark px-3 py-2 text-[11px] font-black uppercase tracking-wider transition cursor-pointer shadow flex items-center justify-center gap-1"
                        >
                          Deep Dive &amp; QA
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSeedSingle(show)}
                      disabled={Boolean(seedingShowId) || batchSeeding}
                      className="w-full rounded-xl bg-disco-rose/90 hover:bg-disco-rose px-4 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow active:scale-95 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isSeedingThis ? "Enriching & Slicing Clips..." : "Test Seed This Podcast"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Streaming Platform Links Catch-Up: Spotify & Apple Podcasts Recrawler
// ----------------------------------------------------------------------------

interface PlatformLinksCoverageShow {
  showId: Id<"shows">;
  title: string;
  hostName?: string;
  coverArtUrl: string;
  hasSpotify: boolean;
  spotifyUrl?: string;
  hasApple: boolean;
  appleUrl?: string;
  hasBoth: boolean;
  isMissing: boolean;
}

interface PlatformLinksCoverageResponse {
  totalShows: number;
  withSpotify: number;
  withApple: number;
  withBoth: number;
  missingCount: number;
  shows: PlatformLinksCoverageShow[];
}

function PlatformLinksCatchUpSection() {
  const coverageRaw = useQuery(api.platformLinksCrawler.getPlatformLinksCoverage, {});
  const coverage = coverageRaw as PlatformLinksCoverageResponse | undefined;
  const batchCatchUp = useAction(api.platformLinksCrawler.batchCatchUpShows);
  const catchUpSingle = useAction(api.platformLinksCrawler.catchUpSingleShow);

  const [isRunning, setIsRunning] = useState(false);
  const [activeBatchSize, setActiveBatchSize] = useState<number | null>(null);
  const [recrawlingShowId, setRecrawlingShowId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showRegistryTable, setShowRegistryTable] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [filterMissingOnly, setFilterMissingOnly] = useState(true);

  async function handleBatch(limit: number) {
    setIsRunning(true);
    setActiveBatchSize(limit);
    setStatusMessage(`Running catch-up for next ${limit} shows (querying iTunes API + Firecrawl)...`);
    try {
      const res = (await batchCatchUp({ limit })) as {
        attempted: number;
        updated: number;
        alreadyComplete: number;
        remaining: number;
      };
      setStatusMessage(
        `✓ Catch-up complete: ${res.updated} shows updated with streaming links! (${res.remaining} shows remaining)`
      );
    } catch (err) {
      setStatusMessage(`Error during batch catch-up: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRunning(false);
      setActiveBatchSize(null);
    }
  }

  async function handleSingle(showId: Id<"shows">, title: string) {
    setRecrawlingShowId(showId);
    try {
      const res = (await catchUpSingle({ showId, force: true })) as {
        success: boolean;
        showId: Id<"shows">;
        title: string;
        spotify?: string;
        apple?: string;
        discoveredSpotify: boolean;
        discoveredApple: boolean;
      };
      if (res.success && (res.discoveredSpotify || res.discoveredApple)) {
        setStatusMessage(
          `✓ Updated "${title}": ${[res.discoveredSpotify ? "Spotify" : "", res.discoveredApple ? "Apple Podcasts" : ""].filter(Boolean).join(" & ")} discovered!`
        );
      } else {
        setStatusMessage(`Crawl checked "${title}". Current links: Spotify: ${res.spotify ? "Found" : "None"}, Apple: ${res.apple ? "Found" : "None"}.`);
      }
    } catch (err) {
      setStatusMessage(`Failed to recrawl "${title}": ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRecrawlingShowId(null);
    }
  }

  const filteredShows: PlatformLinksCoverageShow[] = useMemo(() => {
    if (!coverage?.shows) return [];
    let list: PlatformLinksCoverageShow[] = coverage.shows;
    if (filterMissingOnly) {
      list = list.filter((s: PlatformLinksCoverageShow) => s.isMissing);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (s: PlatformLinksCoverageShow) => s.title.toLowerCase().includes(q) || (s.hostName && s.hostName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [coverage?.shows, filterMissingOnly, searchFilter]);

  const percentBoth = coverage && coverage.totalShows > 0 ? Math.round((coverage.withBoth / coverage.totalShows) * 100) : 0;
  const percentSpotify = coverage && coverage.totalShows > 0 ? Math.round((coverage.withSpotify / coverage.totalShows) * 100) : 0;
  const percentApple = coverage && coverage.totalShows > 0 ? Math.round((coverage.withApple / coverage.totalShows) * 100) : 0;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-disco-navy/40 to-disco-dark/90 p-6 space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-black uppercase tracking-wider text-disco-cream flex items-center gap-2">
              🎧 Streaming Platform Links Catch-Up
            </h3>
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Spotify &amp; Apple Podcasts
            </span>
          </div>
          <p className="text-xs text-disco-cream/70">
            Automated crawler that matches existing ingested shows against the official iTunes Podcast API and Firecrawl to grab direct, verified destination URLs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleBatch(10)}
            disabled={isRunning || !coverage || coverage.missingCount === 0}
            className="rounded-full bg-disco-caramel px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
          >
            {isRunning && activeBatchSize === 10 ? "Catching Up..." : "Catch Up Next 10"}
          </button>
          <button
            type="button"
            onClick={() => void handleBatch(25)}
            disabled={isRunning || !coverage || coverage.missingCount === 0}
            className="rounded-full bg-disco-cream px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
          >
            {isRunning && activeBatchSize === 25 ? "Catching Up..." : "Catch Up Next 25"}
          </button>
          <button
            type="button"
            onClick={() => void handleBatch(coverage ? Math.min(50, coverage.missingCount) : 50)}
            disabled={isRunning || !coverage || coverage.missingCount === 0}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:bg-emerald-400 active:scale-95 disabled:opacity-50 transition cursor-pointer"
          >
            {isRunning && activeBatchSize && activeBatchSize > 25 ? "Catching Up..." : `Catch Up ALL (${coverage?.missingCount ?? 0}) Missing`}
          </button>
        </div>
      </div>

      {/* Coverage KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-disco-dark/60 border border-white/10 p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/60">Total Shows</span>
          <div className="text-xl font-black text-disco-cream font-mono">{coverage ? coverage.totalShows : "..."}</div>
          <span className="text-[10px] text-disco-cream/40">In Convex database</span>
        </div>
        <div className="rounded-xl bg-disco-dark/60 border border-white/10 p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#1DB954]">Spotify Connected</span>
          <div className="text-xl font-black text-[#1DB954] font-mono">
            {coverage ? `${coverage.withSpotify} (${percentSpotify}%)` : "..."}
          </div>
          <span className="text-[10px] text-disco-cream/40">Verified show URLs</span>
        </div>
        <div className="rounded-xl bg-disco-dark/60 border border-white/10 p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">Apple Podcasts</span>
          <div className="text-xl font-black text-purple-300 font-mono">
            {coverage ? `${coverage.withApple} (${percentApple}%)` : "..."}
          </div>
          <span className="text-[10px] text-disco-cream/40">iTunes API matched</span>
        </div>
        <div className="rounded-xl bg-disco-dark/60 border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Fully Connected (Both)</span>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {coverage ? `${coverage.withBoth} (${percentBoth}%)` : "..."}
          </div>
          <span className="text-[10px] text-emerald-400/60">
            {coverage ? `${coverage.missingCount} shows missing links` : ""}
          </span>
        </div>
      </div>

      {/* Progress / Status Message */}
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400/60 hover:text-emerald-300 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Toggle Shows Table */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowRegistryTable(!showRegistryTable)}
          className="text-xs font-bold text-disco-cream/70 hover:text-disco-cream flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>{showRegistryTable ? "▲ Hide Links Registry Table" : "▼ Inspect Links Registry Table"}</span>
          <span className="text-[10px] font-mono text-disco-cream/40">({coverage?.shows?.length ?? 0} shows)</span>
        </button>

        {showRegistryTable ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-disco-cream/80 cursor-pointer">
              <input
                type="checkbox"
                checked={filterMissingOnly}
                onChange={(e) => setFilterMissingOnly(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              <span>Missing links only ({coverage?.missingCount ?? 0})</span>
            </label>
            <input
              type="text"
              placeholder="Filter by title..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="rounded-lg bg-disco-dark border border-white/10 px-2.5 py-1 text-xs text-disco-cream placeholder-disco-cream/40 focus:outline-none focus:border-emerald-500"
            />
          </div>
        ) : null}
      </div>

      {/* Registry Table */}
      {showRegistryTable ? (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredShows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-disco-cream/50">
              No shows matching filter.
            </div>
          ) : (
            filteredShows.map((show: PlatformLinksCoverageShow) => {
              const isRecrawling = recrawlingShowId === show.showId;
              return (
                <div
                  key={show.showId}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-disco-dark/60 p-3 border border-white/5 hover:border-white/15 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={show.coverArtUrl || "https://placehold.co/40x40"}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-disco-cream truncate max-w-[280px] sm:max-w-md">
                        {show.title}
                      </h5>
                      <p className="text-[10px] text-disco-cream/60 truncate">{show.hostName || "Host unknown"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Spotify status */}
                    {show.hasSpotify && show.spotifyUrl ? (
                      <a
                        href={show.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View on Spotify"
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30 hover:underline"
                      >
                        <span>✓ Spotify</span>
                      </a>
                    ) : (
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-white/5 text-disco-cream/40 border border-white/10">
                        ✕ Spotify
                      </span>
                    )}

                    {/* Apple status */}
                    {show.hasApple && show.appleUrl ? (
                      <a
                        href={show.appleUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View on Apple Podcasts"
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:underline"
                      >
                        <span>✓ Apple</span>
                      </a>
                    ) : (
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-white/5 text-disco-cream/40 border border-white/10">
                        ✕ Apple
                      </span>
                    )}

                    {/* Single recrawl button */}
                    <button
                      type="button"
                      onClick={() => void handleSingle(show.showId, show.title)}
                      disabled={isRecrawling || isRunning}
                      className="rounded-full bg-white/10 hover:bg-white/20 text-disco-cream px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      {isRecrawling ? "Crawling..." : "Recrawl"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 45-Second Clip Player: Bounded Audio, Waveform, Rationale, and Export
// ----------------------------------------------------------------------------

function FortyFiveSecondClipPlayer({
  clips,
  showTitle,
}: {
  clips: EnrichedClip[];
  showTitle: string;
}) {
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const clip = clips[selectedClipIndex] || clips[0];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipCurrentSeconds, setClipCurrentSeconds] = useState(0);

  const duration = clip ? Math.max(1, clip.endTime - clip.startTime) : 45;

  // Reset audio playback when switching clips
  useEffect(() => {
    setIsPlaying(false);
    setClipCurrentSeconds(0);
    if (audioRef.current && clip) {
      audioRef.current.currentTime = clip.startTime;
    }
  }, [clip]);

  function togglePlay() {
    if (!audioRef.current || !clip) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Ensure we start within bounds
      if (
        audioRef.current.currentTime < clip.startTime ||
        audioRef.current.currentTime >= clip.endTime - 0.5
      ) {
        audioRef.current.currentTime = clip.startTime;
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current || !clip) return;
    const cur = audioRef.current.currentTime;

    // Strict boundary enforcement: pause when reaching endTime
    if (cur >= clip.endTime) {
      audioRef.current.pause();
      audioRef.current.currentTime = clip.startTime;
      setIsPlaying(false);
      setClipCurrentSeconds(duration);
      return;
    }

    if (cur < clip.startTime) {
      audioRef.current.currentTime = clip.startTime;
      setClipCurrentSeconds(0);
      return;
    }

    setClipCurrentSeconds(Math.max(0, cur - clip.startTime));
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    if (!audioRef.current || !clip) return;
    const targetOffset = Number(e.target.value);
    audioRef.current.currentTime = clip.startTime + targetOffset;
    setClipCurrentSeconds(targetOffset);
  }

  // Waveform heights
  const bars = useMemo(() => {
    const seed = clip ? clip.hookText : "waveform";
    const res: number[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < 48; i++) {
      h = (Math.imul(1664525, h) + 1013904223) | 0;
      res.push(20 + (Math.abs(h) % 75));
    }
    return res;
  }, [clip]);

  const progressFraction = Math.min(1, Math.max(0, clipCurrentSeconds / duration));

  if (!clip) {
    return <div className="text-xs text-disco-cream/60">No clips available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-[11px] font-black uppercase tracking-wider text-disco-rose">
        {showTitle} &bull; Generated 15-45s Preview Clips
      </div>
      {/* Clip Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {clips.map((c, idx) => (
          <button
            key={c.episodeTitle}
            type="button"
            onClick={() => setSelectedClipIndex(idx)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer text-left ${
              selectedClipIndex === idx
                ? "bg-disco-rose text-disco-dark shadow"
                : "bg-disco-dark/50 text-disco-cream/70 hover:text-disco-cream border border-white/10"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wider opacity-70">
              Episode {idx + 1} Clip ({c.duration}s)
            </span>
            <span className="line-clamp-1">{c.episodeTitle}</span>
          </button>
        ))}
      </div>

      {/* Main Clip Player Card */}
      <div className="rounded-2xl border border-white/15 bg-disco-dark/80 p-6 space-y-6">
        {/* Hook Text & AI Rationale Card */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold uppercase">
              15-45s Hook
            </span>
            <span className="text-[11px] text-disco-cream/60 font-mono">
              Timestamp: {formatSeconds(clip.startTime)} &rarr; {formatSeconds(clip.endTime)} ({duration}s clip)
            </span>
          </div>
          <h4 className="text-lg font-extrabold text-disco-cream">&ldquo;{clip.hookText}&rdquo;</h4>
          <p className="text-xs text-disco-rose font-medium">
            <span className="font-black uppercase tracking-wider text-disco-rose/80">
              Why listeners will love this:
            </span>{" "}
            {clip.whyYouWillLikeIt}
          </p>
        </div>

        {/* Waveform Visualization */}
        <div className="relative h-20 w-full overflow-hidden rounded-xl border border-white/10 bg-black/50 p-3 flex items-end gap-1">
          {bars.map((height, i) => {
            const barFraction = i / bars.length;
            const isPlayed = barFraction <= progressFraction;
            return (
              <span
                key={i}
                className="flex-1 rounded-sm transition-colors duration-100"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPlayed ? "#b97179" : "#354156",
                }}
              />
            );
          })}
        </div>

        {/* Player Controls & Scrubber */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-disco-cream/70">
            <span>{formatSeconds(Math.floor(clipCurrentSeconds))}</span>
            <span>{formatSeconds(duration)}</span>
          </div>

          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={clipCurrentSeconds}
            onChange={handleScrub}
            className="w-full accent-disco-rose cursor-pointer"
          />

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-disco-rose text-disco-dark shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = clip.startTime;
                    setClipCurrentSeconds(0);
                    void audioRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                className="rounded-full bg-disco-navy px-4 py-2 text-xs font-bold text-disco-cream border border-white/10 hover:border-white/30 cursor-pointer transition"
              >
                Replay 45s Clip
              </button>
            </div>

            {/* Transcript Excerpt Pill */}
            <div className="text-[11px] text-disco-cream/60 max-w-md text-right line-clamp-1 italic">
              &ldquo;{clip.transcriptExcerpt}&rdquo;
            </div>
          </div>
        </div>

        {/* Hidden Audio Element controlling the stream */}
        <audio
          ref={audioRef}
          src={clip.audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      className={`rounded-2xl border ${color} bg-disco-navy/40 p-4 sm:p-5 flex flex-col justify-between backdrop-blur-sm`}
    >
      <span className="text-[11px] font-black uppercase tracking-wider text-disco-cream/60">
        {label}
      </span>
      <span className="mt-2 text-2xl sm:text-3xl font-black font-['Passion_One'] text-disco-cream">
        {value}
      </span>
    </div>
  );
}

function EnvStatusPill({ label, isSet }: { label: string; isSet: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-1 ${
        isSet
          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
          : "border-rose-500/30 bg-rose-950/20 text-rose-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold">{label}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${isSet ? "bg-emerald-400" : "bg-rose-400"}`}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wider font-semibold">
        {isSet ? "Configured" : "Missing"}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Test Cards
// ----------------------------------------------------------------------------

function OpenAiTestCard() {
  const [prompt, setPrompt] = useState("technology podcasts with great storytelling");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    dimensions: number;
    latencyMs: number;
    previewVector: number[];
    error?: string;
  } | null>(null);

  const testEmbedding = useAction(api.admin.testOpenAiEmbedding);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await testEmbedding({ prompt });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        dimensions: 0,
        latencyMs: 0,
        previewVector: [],
        error: err instanceof Error ? err.message : "OpenAI test action error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-disco-cream">
            OpenAI Embeddings
          </h4>
          <span className="text-[10px] font-mono text-disco-caramel">text-embedding-3-small</span>
        </div>
        <p className="text-xs text-disco-cream/70">
          Validates that OpenAI creates 1536-dimensional vectors for semantic search.
        </p>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt to embed..."
          className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2 text-xs text-disco-cream placeholder-disco-cream/40 focus:border-disco-rose focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={loading}
          className="w-full rounded-full bg-disco-rose px-5 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Generating Embedding..." : "Test Embedding"}
        </button>

        {result ? (
          <div
            className={`rounded-xl border p-3 text-xs space-y-1.5 ${
              result.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/20 text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>{result.success ? "Success" : "Failed"}</span>
              <span className="text-[10px] font-mono">{result.latencyMs}ms</span>
            </div>
            {result.success ? (
              <>
                <p className="text-[11px] text-emerald-300">
                  Vector shape: {result.dimensions} dimensions
                </p>
                <p className="font-mono text-[10px] text-disco-cream/60 truncate">
                  First 5 values: [{result.previewVector.map((v) => v.toFixed(4)).join(", ")}]
                </p>
              </>
            ) : (
              <p className="text-[11px] text-rose-300 break-words">{result.error}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FirecrawlTestCard() {
  const [sourceType, setSourceType] = useState<"title" | "rss" | "apple">("title");
  const [sourceValue, setSourceValue] = useState("Syntax - Tasty Web Development Treats");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    latencyMs: number;
    extractedTitle?: string;
    episodeCount?: number;
    rawSnippet?: string;
    error?: string;
  } | null>(null);

  const testFirecrawl = useAction(api.admin.testFirecrawlExtraction);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await testFirecrawl({ sourceType, sourceValue });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : "Firecrawl action error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-disco-cream">
            Firecrawl Podcast Extraction
          </h4>
          <span className="text-[10px] font-mono text-disco-caramel">v1/extract</span>
        </div>
        <p className="text-xs text-disco-cream/70">
          Tests feed/metadata extraction from RSS, Apple Podcasts, or title query.
        </p>
        <div className="flex gap-2">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "title" | "rss" | "apple")}
            className="rounded-xl border border-white/15 bg-disco-dark/80 px-3 py-2 text-xs text-disco-cream focus:border-disco-rose focus:outline-none"
          >
            <option value="title">Title</option>
            <option value="rss">RSS URL</option>
            <option value="apple">Apple URL</option>
          </select>
          <input
            type="text"
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            placeholder="Podcast title or URL..."
            className="flex-1 rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2 text-xs text-disco-cream placeholder-disco-cream/40 focus:border-disco-rose focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={loading}
          className="w-full rounded-full bg-disco-caramel px-5 py-2 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:opacity-90 active:scale-95 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Extracting..." : "Test Firecrawl"}
        </button>

        {result ? (
          <div
            className={`rounded-xl border p-3 text-xs space-y-1.5 ${
              result.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/20 text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>{result.success ? "Success" : "Failed"}</span>
              <span className="text-[10px] font-mono">{result.latencyMs}ms</span>
            </div>
            {result.success ? (
              <>
                <p className="text-[11px] text-emerald-300">
                  Extracted: &ldquo;{result.extractedTitle}&rdquo; ({result.episodeCount} episodes)
                </p>
                {result.rawSnippet ? (
                  <p className="font-mono text-[10px] text-disco-cream/60 truncate">
                    Preview: {result.rawSnippet}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[11px] text-rose-300 break-words">{result.error}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IngestionPipelineTestCard() {
  const [prompt, setPrompt] = useState("Acquired");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    showId?: string;
    mappedNow?: boolean;
    episodeCount?: number;
    snippetCount?: number;
    error?: string;
  } | null>(null);

  const findOrMapShow = useAction(api.ingestionActions.findOrMapShow);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await findOrMapShow({ prompt });
      setResult({
        success: true,
        showId: res.showId,
        mappedNow: res.mappedNow,
        episodeCount: res.episodeCount,
        snippetCount: res.snippetCount,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Pipeline execution failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-disco-cream">
            Map-a-Show Pipeline
          </h4>
          <span className="text-[10px] font-mono text-disco-caramel">End-to-End</span>
        </div>
        <p className="text-xs text-disco-cream/70">
          Runs the complete extraction &rarr; snippet build &rarr; embedding &rarr; Convex database pipeline.
        </p>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Podcast name or topic..."
          className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3.5 py-2 text-xs text-disco-cream placeholder-disco-cream/40 focus:border-disco-rose focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={loading}
          className="w-full rounded-full bg-emerald-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-emerald-500 active:scale-95 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Running Pipeline..." : "Run Ingestion Pipeline"}
        </button>

        {result ? (
          <div
            className={`rounded-xl border p-3 text-xs space-y-1.5 ${
              result.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/20 text-rose-200"
            }`}
          >
            <div className="font-bold">{result.success ? "Pipeline Success" : "Failed"}</div>
            {result.success ? (
              <div className="space-y-1 text-[11px] text-emerald-300">
                <p>Status: {result.mappedNow ? "Newly Mapped to DB" : "Already Existed in DB"}</p>
                <p>Show ID: {result.showId}</p>
                <p>
                  Episodes: {result.episodeCount} &bull; Snippets: {result.snippetCount}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-rose-300 break-words">{result.error}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmailOverrideCard() {
  const settings = useQuery(api.ownerSettings.getOwnerSettings, {}) as
    | { emailEnabled: boolean; emailOverrideAddress: string }
    | undefined;

  const setEmailOverride = useMutation(api.ownerSettings.setEmailOverride);
  const sendTestEmail = useAction(api.agentmailActions.sendTestEmailAction);

  const [inputEmail, setInputEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
    threadId?: string;
  } | null>(null);

  // Sync input with database setting once loaded
  const currentSavedOverride = settings?.emailOverrideAddress || "";
  useEffect(() => {
    if (settings) {
      setInputEmail(settings.emailOverrideAddress || "");
    }
  }, [settings]);

  const hasOverride = Boolean(currentSavedOverride.trim());
  const hasUnsavedChanges = inputEmail.trim() !== currentSavedOverride.trim();

  async function handleSaveOverride(emailToSave: string) {
    setIsSaving(true);
    setFeedback(null);
    try {
      await setEmailOverride({ emailOverrideAddress: emailToSave.trim() });
      setFeedback({
        type: "success",
        text: emailToSave.trim()
          ? `Email override saved to Convex! All outbound AgentMail emails will now route to ${emailToSave.trim()}.`
          : "Email override cleared! Direct delivery to scraped podcast host addresses is restored.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save email override.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTest() {
    setIsSendingTest(true);
    setFeedback(null);
    try {
      const res = (await sendTestEmail({
        customSubject: `[DiscoPod Test] AgentMail Override Ping (${new Date().toLocaleTimeString()})`,
      })) as {
        success: boolean;
        recipient: string;
        isOverridden: boolean;
        inboxThreadId: string;
        message: string;
      };

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Test email successfully sent via AgentMail to ${res.recipient}! Check your inbox or AgentMail dashboard.`,
          threadId: res.inboxThreadId,
        });
      } else {
        setFeedback({
          type: "error",
          text: res.message,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to trigger test email.",
      });
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#C47D54]/20 p-2.5 border border-[#C47D54]/30 text-[#C47D54]">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream flex items-center gap-2">
              <span>AgentMail Outbound Routing &amp; Email Override</span>
            </h3>
            <p className="text-xs text-disco-cream/70">
              When an override is active, all creator claim invitations, 45-second reel previews, and AI email updates go here instead of real hosts.
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div>
          {hasOverride ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D54]/20 text-[#C47D54] border border-[#C47D54]/40 px-3 py-1 text-xs font-black uppercase tracking-wider shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#C47D54] animate-pulse" />
              <span>Override Active: {currentSavedOverride}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-disco-cream/60 border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-white/40" />
              <span>Direct Mode (No Override)</span>
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/20 p-4 space-y-3">
        <label htmlFor="email-override-input" className="block text-xs font-bold uppercase tracking-wider text-disco-cream/80">
          Target Test Email Address:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              id="email-override-input"
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              placeholder="e.g. your-email@example.com"
              className="w-full rounded-xl border border-white/15 bg-disco-dark/90 px-4 py-2.5 text-xs text-disco-cream placeholder:text-disco-cream/30 focus:border-[#C47D54] focus:outline-none shadow-inner"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSaveOverride(inputEmail)}
              disabled={isSaving || !hasUnsavedChanges}
              className="rounded-xl bg-[#C47D54] hover:bg-[#b36c44] text-disco-dark px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Override"}</span>
            </button>

            {hasOverride ? (
              <button
                type="button"
                onClick={() => {
                  setInputEmail("");
                  void handleSaveOverride("");
                }}
                disabled={isSaving}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-disco-cream px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 cursor-pointer"
              >
                Clear Override
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSendTest()}
              disabled={isSendingTest || !hasOverride}
              title={!hasOverride ? "Save an email override first to test dispatch" : "Send test email now"}
              className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSendingTest ? "Sending..." : "Send Test Email"}</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-disco-cream/50 leading-relaxed">
          Stored in Convex as a singleton reactive record. All background workers, ingestion jobs, and preview senders read this override before dispatching.
        </p>
      </div>

      {feedback ? (
        <div
          className={`flex items-start justify-between rounded-xl p-3.5 text-xs border transition ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
              : feedback.type === "error"
                ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
                : "bg-disco-navy/60 border-disco-caramel/50 text-disco-cream"
          }`}
        >
          <div className="space-y-1">
            <p>{feedback.text}</p>
            {feedback.threadId ? (
              <p className="font-mono text-[10px] text-emerald-300">
                AgentMail Thread ID: {feedback.threadId}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[10px] underline hover:opacity-80 ml-4 cursor-pointer self-start"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HostOutreachGuardCard() {
  const outreachLogs = useQuery(api.ownerSettings.listHostOutreachLog, {}) as
    | Array<{
        _id: Id<"hostOutreachLog">;
        email: string;
        showId?: Id<"shows">;
        showTitle?: string;
        subject: string;
        inboxThreadId: string;
        isStaging: boolean;
        sentAt: number;
        hasReceivedReply: boolean;
        lastReplyAt?: number;
      }>
    | undefined;

  const deleteEntry = useMutation(api.ownerSettings.deleteHostOutreachLogEntry);
  const backfillOutreach = useMutation(api.ownerSettings.backfillExistingOutreach);

  const [testHostEmail, setTestHostEmail] = useState("");
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillFeedback, setBackfillFeedback] = useState<string | null>(null);

  // Live status check for the entered testHostEmail
  const emailStatus = useQuery(
    api.ownerSettings.checkHostEmailStatus,
    testHostEmail.trim().length > 3 ? { hostEmail: testHostEmail.trim() } : "skip",
  ) as
    | {
        allowed: boolean;
        reason: string;
        previousSentAt?: number;
        hasReceivedReply: boolean;
        lastReplyAt?: number;
        outreachCount: number;
      }
    | undefined;

  async function handleBackfill() {
    setIsBackfilling(true);
    setBackfillFeedback(null);
    try {
      const res = await backfillOutreach({});
      setBackfillFeedback(`Synced ${res.backfilled} existing claims into the single-contact outreach log.`);
    } catch (err) {
      setBackfillFeedback(err instanceof Error ? err.message : "Failed to sync historical claims.");
    } finally {
      setIsBackfilling(false);
    }
  }

  async function handleDelete(id: Id<"hostOutreachLog">) {
    try {
      await deleteEntry({ id });
    } catch (err) {
      console.error("Failed to delete outreach entry:", err);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/20 p-2.5 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream flex items-center gap-2">
              <span>Host Single-Contact Rule Guard</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                Enforced
              </span>
            </h3>
            <p className="text-xs text-disco-cream/70">
              Guarantees hosts never receive more than 1 outbound email unless they reply. Subsequent automated or manual outreach is blocked until unlocked by host response.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleBackfill()}
            disabled={isBackfilling}
            className="rounded-xl bg-white/10 hover:bg-white/20 text-disco-cream px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            title="Scan claims and record past outreaches to ensure historical shows are protected"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{isBackfilling ? "Syncing..." : "Sync Claims"}</span>
          </button>
        </div>
      </div>

      {backfillFeedback ? (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-3 text-xs text-emerald-200 flex items-center justify-between">
          <span>{backfillFeedback}</span>
          <button
            type="button"
            onClick={() => setBackfillFeedback(null)}
            className="text-[10px] underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Live Host Email Guard Checker */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="test-host-email" className="text-xs font-bold uppercase tracking-wider text-disco-cream/80">
            Test Host Email Status (Real-time Guard Evaluation):
          </label>
          <span className="text-[11px] text-disco-cream/50">
            Check any podcast host email before disabling override
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              id="test-host-email"
              type="email"
              value={testHostEmail}
              onChange={(e) => setTestHostEmail(e.target.value)}
              placeholder="Enter host email to check (e.g. host@podcast.fm)..."
              className="w-full rounded-xl border border-white/15 bg-disco-dark/90 px-4 py-2.5 text-xs text-disco-cream placeholder:text-disco-cream/30 focus:border-emerald-500 focus:outline-none shadow-inner"
            />
          </div>
        </div>

        {testHostEmail.trim().length > 3 && emailStatus ? (
          <div
            className={`rounded-xl p-3 text-xs border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition ${
              emailStatus.allowed
                ? emailStatus.reason === "reply_received"
                  ? "bg-sky-950/40 border-sky-500/50 text-sky-200"
                  : "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/50 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {emailStatus.allowed ? (
                emailStatus.reason === "reply_received" ? (
                  <Sparkles className="h-4 w-4 text-sky-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-bold uppercase tracking-wider">
                  {emailStatus.allowed
                    ? emailStatus.reason === "reply_received"
                      ? "UNLOCKED — Host Replied"
                      : "ALLOWED — First Outreach"
                    : "BLOCKED — Awaiting Host Reply"}
                </span>
                <span className="text-disco-cream/70 ml-2">
                  {emailStatus.allowed
                    ? emailStatus.reason === "reply_received"
                      ? `Host previously replied on ${new Date(emailStatus.lastReplyAt || Date.now()).toLocaleDateString()}. Follow-ups permitted.`
                      : "Host has never been emailed. First intro/traction notification is permitted."
                    : `Host was already emailed on ${new Date(emailStatus.previousSentAt || Date.now()).toLocaleDateString()}. Further emails blocked until they reply.`}
                </span>
              </div>
            </div>

            <div className="text-[11px] font-mono opacity-80 shrink-0">
              Total outreaches: {emailStatus.outreachCount}
            </div>
          </div>
        ) : null}
      </div>

      {/* Outreach Log Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-disco-cream/80">
            Recent Host Outreach Dispatches ({outreachLogs?.length ?? 0}):
          </h4>
          <span className="text-[11px] text-disco-cream/50">
            Auto-populated whenever traction notification or preview is sent
          </span>
        </div>

        {outreachLogs && outreachLogs.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left text-xs text-disco-cream/80">
                <thead className="bg-white/5 uppercase text-[10px] tracking-wider text-disco-cream/50 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Host Email</th>
                    <th className="py-2.5 px-3">Show</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {outreachLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 whitespace-nowrap text-disco-cream/60">
                        {new Date(log.sentAt).toLocaleDateString()} {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-disco-cream font-sans">
                        {log.email}
                        {log.isStaging ? (
                          <span className="ml-1.5 rounded bg-amber-500/20 text-amber-300 text-[9px] px-1 py-0.5 border border-amber-500/30">
                            Staging
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-sans text-disco-cream/90 max-w-[160px] truncate" title={log.showTitle || ""}>
                        {log.showTitle || "—"}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-sans">
                        {log.hasReceivedReply ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5 text-[10px] font-bold">
                            <Check className="h-3 w-3" /> Replied ({new Date(log.lastReplyAt || log.sentAt).toLocaleDateString()})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 text-[10px] font-bold">
                            <Clock className="h-3 w-3" /> Awaiting Reply (Blocked)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-sans">
                        <button
                          type="button"
                          onClick={() => void handleDelete(log._id)}
                          className="text-rose-400 hover:text-rose-300 transition text-[11px] cursor-pointer"
                          title="Delete entry (e.g. to reset test outreach)"
                        >
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-center text-xs text-disco-cream/50">
            No outbound host outreaches logged yet. All podcast hosts are currently eligible for their initial message.
          </div>
        )}
      </div>
    </div>
  );
}

function HumanInTheLoopEmailCard() {
  const settings = useQuery(api.ownerSettings.getOwnerSettings, {}) as
    | { emailEnabled: boolean; emailOverrideAddress: string; humanInTheLoopEmail: string }
    | undefined;

  const setHumanInTheLoopEmail = useMutation(api.ownerSettings.setHumanInTheLoopEmail);
  const [inputEmail, setInputEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const savedEmail = settings?.humanInTheLoopEmail || "";
  useEffect(() => {
    if (settings) {
      setInputEmail(settings.humanInTheLoopEmail || "");
    }
  }, [settings]);

  const hasUnsavedChanges = inputEmail.trim() !== savedEmail.trim();

  async function handleSave() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await setHumanInTheLoopEmail({ humanInTheLoopEmail: inputEmail.trim() });
      setFeedback({
        type: "success",
        text: inputEmail.trim()
          ? `HITL admin destination saved. Alternate-email host requests will escalate to ${inputEmail.trim()}.`
          : "HITL admin destination cleared. Alternate-email requests will fail until configured.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save HITL email.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-500/20 p-2.5 border border-indigo-400/30 text-indigo-300">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
            Human-in-the-Loop Admin Escalation
          </h3>
          <p className="text-xs text-disco-cream/70 max-w-2xl">
            When a host submits an alternate email (wrong address on file), escalations go here — not to the staging
            override inbox. This admin can resolve requests via AgentMail reply (APPROVE/REJECT — full loop coming soon).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/20 p-4 space-y-3">
        <label htmlFor="hitl-email-input" className="block text-xs font-bold uppercase tracking-wider text-disco-cream/80">
          Admin escalation inbox:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="hitl-email-input"
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            placeholder="e.g. admin@your-discopod-agent-inbox.com"
            className="flex-1 rounded-xl border border-white/15 bg-disco-dark/90 px-4 py-2.5 text-xs text-disco-cream placeholder:text-disco-cream/30 focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasUnsavedChanges}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save HITL Email"}
          </button>
        </div>
        <p className="text-[11px] text-disco-cream/50">
          Use a dedicated AgentMail agent inbox — not a personal mailbox. Distinct from the outbound test override above.
        </p>
      </div>

      {feedback ? (
        <div
          className={`rounded-xl p-3 text-xs border ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
              : "bg-rose-950/40 border-rose-500/50 text-rose-200"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  );
}

function AccessRequestsCard() {
  const requests = useQuery(api.hostAccess.listAccessRequests, {}) as
    | Array<{
        _id: Id<"hostAccessRequests">;
        showId: Id<"shows">;
        showTitle: string;
        requestType: string;
        status: string;
        onFileEmail?: string;
        alternateEmail?: string;
        requesterNote?: string;
        createdAt: number;
        updatedAt: number;
      }>
    | undefined;

  const resolveAccessRequest = useMutation(api.hostAccess.resolveAccessRequest);
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleResolve(requestId: Id<"hostAccessRequests">, decision: "approve" | "reject") {
    setActingId(requestId);
    setFeedback(null);
    try {
      const res = (await resolveAccessRequest({ requestId, decision })) as { success: boolean; message: string };
      setFeedback(res.message);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  const pendingRequests = (requests || []).filter((r) => r.status === "pending" || r.status === "escalated");

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/20 p-2.5 border border-amber-400/30 text-amber-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
              Host Access &amp; Verification Requests
            </h3>
            <p className="text-xs text-disco-cream/70">
              Creators who requested access with an alternate email or require human review.
            </p>
          </div>
        </div>
        {pendingRequests.length > 0 && (
          <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-bold">
            {pendingRequests.length} Pending
          </span>
        )}
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/50 p-3 text-xs text-emerald-200">
          {feedback}
        </div>
      )}

      {requests === undefined ? (
        <div className="text-xs text-disco-cream/40 py-2">Loading access requests...</div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-disco-cream/50 text-center">
          No host access requests recorded yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {requests.map((req) => {
            const isPending = req.status === "pending" || req.status === "escalated";
            return (
              <div
                key={req._id}
                className={`rounded-xl border p-3.5 space-y-2 text-xs ${
                  isPending
                    ? "border-amber-500/30 bg-amber-950/10"
                    : "border-white/5 bg-black/20 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-disco-cream text-sm truncate">
                      {req.showTitle}
                    </span>
                    {req.requestType === "network_disambiguation" && (
                      <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shrink-0">
                        Network Ambiguity
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      req.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : req.status === "rejected"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-disco-cream/80">
                  <div>
                    <span className="text-disco-cream/40 block text-[10px]">Email on File (RSS):</span>
                    <span className="font-mono">{req.onFileEmail || "None"}</span>
                  </div>
                  <div>
                    <span className="text-disco-cream/40 block text-[10px]">Requested Email:</span>
                    <span className="font-mono text-emerald-300 font-bold">{req.alternateEmail || "N/A"}</span>
                  </div>
                </div>

                {req.requesterNote && (
                  <div className="text-[11px] text-disco-cream/70 bg-black/20 p-2 rounded-lg border border-white/5">
                    <span className="text-disco-cream/40 font-bold block text-[10px]">Creator Note:</span>
                    {req.requesterNote}
                  </div>
                )}

                {isPending && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actingId === req._id}
                      onClick={() => void handleResolve(req._id, "approve")}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold shadow transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Approve &amp; Verify
                    </button>
                    <button
                      type="button"
                      disabled={actingId === req._id}
                      onClick={() => void handleResolve(req._id, "reject")}
                      className="rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/30 px-3 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TakedownRequestsCard() {
  const takedowns = useQuery(api.takedowns.listTakedowns, {}) as
    | Array<{
        _id: Id<"takedownRequests">;
        showId?: Id<"shows">;
        title: string;
        feedUrl?: string;
        appleId?: string;
        requesterEmail?: string;
        source: string;
        reason?: string;
        status: string;
        verifiedOnFile: boolean;
        requesterProofNotes?: string;
        createdAt: number;
        resolvedAt?: number;
        resolvedBy?: string;
      }>
    | undefined;

  const resolveTakedown = useMutation(api.takedowns.resolveTakedownRequest);
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleResolve(takedownId: Id<"takedownRequests">, decision: "approve" | "reject") {
    setActingId(takedownId);
    setFeedback(null);
    try {
      const res = (await resolveTakedown({ takedownId, decision })) as { success: boolean; message: string };
      setFeedback(res.message);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  const pendingTakedowns = (takedowns || []).filter((t) => t.status === "pending_hitl");

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/20 p-2.5 border border-rose-400/30 text-rose-300">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-disco-cream">
              Podcast Takedown &amp; Tombstone Requests
            </h3>
            <p className="text-xs text-disco-cream/70">
              Protects creators against competitor takedowns. Unverified requests require human approval.
            </p>
          </div>
        </div>
        {pendingTakedowns.length > 0 && (
          <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-bold animate-pulse">
            {pendingTakedowns.length} Awaiting Verification
          </span>
        )}
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/50 p-3 text-xs text-emerald-200">
          {feedback}
        </div>
      )}

      {takedowns === undefined ? (
        <div className="text-xs text-disco-cream/40 py-2">Loading takedown records...</div>
      ) : takedowns.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-disco-cream/50 text-center">
          No takedown requests recorded yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {takedowns.map((item) => {
            const isPending = item.status === "pending_hitl";
            return (
              <div
                key={item._id}
                className={`rounded-xl border p-3.5 space-y-2 text-xs ${
                  isPending
                    ? "border-rose-500/40 bg-rose-950/20"
                    : item.status === "completed"
                    ? "border-white/5 bg-black/20 opacity-70"
                    : "border-white/5 bg-black/10 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-disco-cream text-sm">
                      {item.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        item.verifiedOnFile
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {item.verifiedOnFile ? "✓ Verified on File" : "⚠️ Unverified / Competitor Check"}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      item.status === "completed"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : item.status === "rejected"
                        ? "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {item.status === "pending_hitl" ? "Pending Review" : item.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-disco-cream/80">
                  <div>
                    <span className="text-disco-cream/40 block text-[10px]">Requester Email:</span>
                    <span className="font-mono">{item.requesterEmail || "None provided"}</span>
                  </div>
                  <div>
                    <span className="text-disco-cream/40 block text-[10px]">Channel / Source:</span>
                    <span className="font-mono">{item.source}</span>
                  </div>
                </div>

                {item.requesterProofNotes && (
                  <div className="text-[11px] text-disco-cream/70 bg-black/20 p-2 rounded-lg border border-white/5">
                    <span className="text-disco-cream/40 font-bold block text-[10px]">Proof Notes / Explanation:</span>
                    {item.requesterProofNotes}
                  </div>
                )}

                {isPending && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actingId === item._id}
                      onClick={() => void handleResolve(item._id, "approve")}
                      className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 text-xs font-bold shadow transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Approve &amp; Tombstone
                    </button>
                    <button
                      type="button"
                      disabled={actingId === item._id}
                      onClick={() => void handleResolve(item._id, "reject")}
                      className="rounded-lg bg-gray-600/30 hover:bg-gray-600/50 text-gray-200 border border-white/10 px-3 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Dismiss (Reject Competitor)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentMailSimulationCard() {
  const [command, setCommand] = useState<"verify" | "claim" | "reject" | "change_snippet">("verify");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    outcome: string;
    tokenUsed: string;
    inboxThreadId: string;
  } | null>(null);

  const simulateAgentMail = useAction(api.admin.testAgentMailSimulation);

  async function handleSimulate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await simulateAgentMail({ command });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        outcome: err instanceof Error ? err.message : "Simulation failed",
        tokenUsed: "none",
        inboxThreadId: "none",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-disco-navy/30 p-6 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-disco-cream">
            AgentMail Webhook Simulation
          </h4>
          <span className="text-[10px] font-mono text-disco-caramel">Creator Loop</span>
        </div>
        <p className="text-xs text-disco-cream/70">
          Simulates an inbound creator email reply (&ldquo;Verify&rdquo;, &ldquo;Reject&rdquo;,
          &ldquo;Change snippet&rdquo;) on an active claim.
        </p>
        <div className="flex gap-2">
          <select
            value={command}
            onChange={(e) =>
              setCommand(e.target.value as "verify" | "claim" | "reject" | "change_snippet")
            }
            className="w-full rounded-xl border border-white/15 bg-disco-dark/80 px-3 py-2 text-xs text-disco-cream focus:border-disco-rose focus:outline-none"
          >
            <option value="verify">Command: &ldquo;Verify&rdquo; (Verifies host claim)</option>
            <option value="reject">Command: &ldquo;Reject&rdquo; (Marks rejected)</option>
            <option value="change_snippet">Command: &ldquo;Change snippet&rdquo; (Queues update)</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleSimulate()}
          disabled={loading}
          className="w-full rounded-full bg-purple-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-purple-500 active:scale-95 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? "Simulating Webhook..." : "Simulate Inbound Email"}
        </button>

        {result ? (
          <div
            className={`rounded-xl border p-3 text-xs space-y-1.5 ${
              result.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/20 text-rose-200"
            }`}
          >
            <div className="font-bold">{result.success ? "Webhook Result" : "Simulation Failed"}</div>
            <div className="space-y-0.5 text-[11px] text-disco-cream/80">
              <p>Outcome: <span className="font-mono text-emerald-300">{result.outcome}</span></p>
              <p className="text-[10px] text-disco-cream/60">
                Token: {result.tokenUsed} &bull; Thread: {result.inboxThreadId}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

