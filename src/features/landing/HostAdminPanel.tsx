/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Pause,
  Play,
  Quote,
  Radio,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Sparkles,
  UserRound,
  Volume2,
  X,
} from "lucide-react";

import { api } from "../../convexApi";
import { MOCK_SHOWS, MOCK_SNIPPETS } from "../mockData";

export interface HostAdminPanelProps {
  initialCode?: string;
  onLocateShowOnGlobe?: (showId: string) => void;
  onClose: () => void;
  isOffline?: boolean;
}

interface LoadedShowData {
  show: {
    showId: string;
    title: string;
    slug: string;
    description: string;
    rssUrl: string;
    websiteUrl?: string;
    coverArtUrl: string;
    hostName?: string;
    hostEmail?: string;
    isClaimed: boolean;
    coordinates: { x: number; y: number; z: number };
  };
  claim: {
    claimId: string;
    claimStatus: "pending" | "verified" | "rejected";
    token: string;
  };
  snippets: Array<{
    snippetId: string;
    episodeId: string;
    episodeTitle: string;
    audioUrl: string;
    startTime: number;
    endTime: number;
    duration: number;
    hookText: string;
    transcriptExcerpt: string;
    whyYouWillLikeIt: string;
    playCount: number;
    upvotes: number;
  }>;
  episodes: Array<{
    episodeId: string;
    title: string;
    audioUrl: string;
    pubDate: number;
    durationSeconds: number;
    summary: string;
  }>;
}

export function HostAdminPanel({
  initialCode = "",
  onLocateShowOnGlobe,
  onClose,
  isOffline = false,
}: HostAdminPanelProps) {
  const [inputCode, setInputCode] = useState(initialCode);
  const [activeCode, setActiveCode] = useState(initialCode);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Host access search flow
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [showHitlForm, setShowHitlForm] = useState(false);
  const [alternateEmail, setAlternateEmail] = useState("");
  const [hitlNote, setHitlNote] = useState("");
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showLegacyCodeEntry, setShowLegacyCodeEntry] = useState(Boolean(initialCode));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery(
    api.hostAccess.searchShowsForHostAccess,
    !isOffline && debouncedSearch.length >= 2 ? { query: debouncedSearch, limit: 8 } : "skip",
  ) as
    | Array<{
        showId: string;
        title: string;
        hostName: string;
        coverArtUrl: string;
        description: string;
        maskedHostEmail?: string;
        hasHostEmail: boolean;
        isClaimed: boolean;
      }>
    | undefined;

  const selectedShowPreview = useQuery(
    api.hostAccess.getShowAccessPreview,
    !isOffline && selectedShowId ? { showId: selectedShowId as never } : "skip",
  ) as
    | {
        showId: string;
        title: string;
        hostName?: string;
        coverArtUrl: string;
        description: string;
        maskedHostEmail?: string;
        hasHostEmail: boolean;
        isClaimed: boolean;
        claimStatus?: "pending" | "verified" | "rejected";
      }
    | null
    | undefined;

  const accessStatus = useQuery(
    api.hostAccess.getAccessRequestStatus,
    !isOffline && selectedShowId ? { showId: selectedShowId as never } : "skip",
  ) as
    | {
        claimStatus?: "pending" | "verified" | "rejected";
        isClaimed: boolean;
        claimToken?: string;
        status: string;
      }
    | null
    | undefined;

  const requestAccessOnFile = useAction(api.hostAccessActions.requestAccessOnFile);
  const requestAccessAlternate = useAction(api.hostAccessActions.requestAccessWithAlternateEmail);

  // Audio player state
  const [playingSnippetId, setPlayingSnippetId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Convex live query & mutation
  const liveData = useQuery(
    api.territoryClaims.getShowByClaimToken,
    !isOffline && activeCode.trim() ? { token: activeCode.trim() } : "skip",
  ) as LoadedShowData | null | undefined;

  const claimShowMutation = useMutation(api.territoryClaims.claimShowByToken);
  const updateCodeMutation = useMutation(api.territoryClaims.updateClaimToken);
  const updateHookMutation = useMutation(api.territoryClaims.updateShowHook);
  const reSliceClipMutation = useMutation(api.territoryClaims.reSliceShowClip);

  // In-app controls state
  const [isChangingCode, setIsChangingCode] = useState(false);
  const [newCustomCode, setNewCustomCode] = useState("");
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [customHookQuote, setCustomHookQuote] = useState("");
  const [isSavingHook, setIsSavingHook] = useState(false);

  const [reSliceMinutes, setReSliceMinutes] = useState("1");
  const [reSliceSeconds, setReSliceSeconds] = useState("15");
  const [isSavingReSlice, setIsSavingReSlice] = useState(false);

  // Offline mock data state
  const [offlineClaimStatus, setOfflineClaimStatus] = useState<"pending" | "verified">("pending");

  const mockLoadedData = useMemo((): LoadedShowData | null => {
    const token = activeCode.trim();
    if (!token) return null;

    if (token === "claim_tok_991823") {
      const show = MOCK_SHOWS[0];
      if (!show) return null;
      const snippets = MOCK_SNIPPETS.filter((s) => s.showId === show.showId);
      return {
        show: {
          showId: show.showId,
          title: show.title,
          slug: show.slug || "pitch-dark-product-stories",
          description: show.description || "Late-night tales of high-stakes product launches.",
          rssUrl: "https://feeds.discopod.io/pitch-dark/rss.xml",
          websiteUrl: "https://pitchdark.fm",
          coverArtUrl: show.coverArtUrl,
          hostName: show.hostName || "Elena Vance",
          hostEmail: "elena@pitchdark.fm",
          isClaimed: true,
          coordinates: show.coordinates,
        },
        claim: {
          claimId: "mock_claim_1",
          claimStatus: "verified",
          token: "claim_tok_991823",
        },
        snippets: snippets.map((s) => ({
          snippetId: s.snippetId,
          episodeId: s.episodeId,
          episodeTitle: s.episodeTitle,
          audioUrl: s.audioUrl,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.endTime - s.startTime,
          hookText: s.hookText,
          transcriptExcerpt: s.transcriptExcerpt,
          whyYouWillLikeIt: "High-engagement startup war story.",
          playCount: 42,
          upvotes: 18,
        })),
        episodes: [
          {
            episodeId: "mock_ep_1",
            title: "The launch that nearly missed midnight",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
            pubDate: Date.now() - 86400000 * 3,
            durationSeconds: 1840,
            summary: "How one unselected onboarding checkbox triggered cascading payment failures.",
          },
        ],
      };
    }

    if (token === "claim_tok_sidequest_77" || isOffline) {
      const show = MOCK_SHOWS[1] || MOCK_SHOWS[0];
      if (!show) return null;
      const snippets = MOCK_SNIPPETS.filter((s) => s.showId === show.showId);
      return {
        show: {
          showId: show.showId,
          title: show.title,
          slug: show.slug || "side-quest-signals",
          description: show.description || "Unexpected hacker hobbies, synthesizer tinkering, and creative tangents.",
          rssUrl: "https://feeds.discopod.io/side-quest/rss.xml",
          websiteUrl: "https://sidequest.io",
          coverArtUrl: show.coverArtUrl,
          hostName: show.hostName || "Marcus Brody",
          hostEmail: "marcus@sidequest.io",
          isClaimed: offlineClaimStatus === "verified",
          coordinates: show.coordinates,
        },
        claim: {
          claimId: "mock_claim_2",
          claimStatus: offlineClaimStatus,
          token: token,
        },
        snippets: snippets.map((s) => ({
          snippetId: s.snippetId,
          episodeId: s.episodeId,
          episodeTitle: s.episodeTitle,
          audioUrl: s.audioUrl,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.endTime - s.startTime,
          hookText: s.hookText,
          transcriptExcerpt: s.transcriptExcerpt,
          whyYouWillLikeIt: "Analog modular synth tinkering meets software craftsmanship.",
          playCount: 19,
          upvotes: 8,
        })),
        episodes: [
          {
            episodeId: "mock_ep_2",
            title: "Analog synthesizers and reactive programming",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg",
            pubDate: Date.now() - 86400000 * 5,
            durationSeconds: 2400,
            summary: "Modular patch cables taught me more about state machines than manuals.",
          },
        ],
      };
    }
    return null;
  }, [isOffline, activeCode, offlineClaimStatus]);

  // Live query from Convex takes priority; fallback to demo mock data if token matches demo
  const activeData = liveData || mockLoadedData;
  const isLookingUp = Boolean(activeCode && liveData === undefined && !mockLoadedData);

  // Show helpful error message if live query completes and no show was found (legacy code path)
  useEffect(() => {
    if (activeCode.trim() && liveData === null && !mockLoadedData && showLegacyCodeEntry) {
      setFeedback({
        type: "error",
        message: `Claim code "${activeCode}" was not found. Search for your show below instead.`,
      });
    }
  }, [activeCode, liveData, mockLoadedData, showLegacyCodeEntry]);

  // Auto-load dashboard when email verification completes
  useEffect(() => {
    if (!selectedShowId || !accessStatus) return;
    if (accessStatus.claimToken && (accessStatus.isClaimed || accessStatus.claimStatus === "verified")) {
      setActiveCode(accessStatus.claimToken);
      setInputCode(accessStatus.claimToken);
      setFeedback({
        type: "success",
        message: "Show verified! Your host dashboard is ready.",
      });
    }
  }, [selectedShowId, accessStatus?.claimToken, accessStatus?.isClaimed, accessStatus?.claimStatus]);

  useEffect(() => {
    if (initialCode && initialCode !== inputCode) {
      setInputCode(initialCode);
      setActiveCode(initialCode);
    }
  }, [initialCode]);

  function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = inputCode.trim();
    if (!trimmed) {
      setFeedback({ type: "error", message: "Please enter your claim code from the email." });
      return;
    }
    setFeedback(null);
    setActiveCode(trimmed);
  }

  async function handleClaimShow() {
    if (!activeCode.trim()) return;
    setIsClaiming(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setOfflineClaimStatus("verified");
        setFeedback({
          type: "success",
          message: "Show claimed successfully! Your Verified Host badge is active.",
        });
      } else {
        const res = await claimShowMutation({ token: activeCode.trim() });
        if (res.success) {
          setFeedback({
            type: "success",
            message: res.message || "Show claimed successfully!",
          });
        } else {
          setFeedback({
            type: "error",
            message: res.message || "Failed to claim show.",
          });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error claiming show.",
      });
    } finally {
      setIsClaiming(false);
    }
  }

  function handleTogglePlaySnippet(snippet: LoadedShowData["snippets"][0]) {
    if (playingSnippetId === snippet.snippetId) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    } else {
      setPlayingSnippetId(snippet.snippetId);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = snippet.audioUrl;
        audioRef.current.currentTime = snippet.startTime;
        audioRef.current.play().catch(() => {});
      }
    }
  }

  // Active highlight snippet (first snippet if available)
  const primarySnippet = activeData?.snippets[0] ?? null;

  useEffect(() => {
    if (primarySnippet) {
      setCustomHookQuote(primarySnippet.hookText);
      const mins = Math.floor(primarySnippet.startTime / 60);
      const secs = primarySnippet.startTime % 60;
      setReSliceMinutes(mins.toString());
      setReSliceSeconds(secs.toString().padStart(2, "0"));
    }
  }, [primarySnippet?.snippetId, primarySnippet?.startTime, primarySnippet?.hookText]);

  function handleLogOut() {
    setActiveCode("");
    setInputCode("");
    setSelectedShowId(null);
    setSearchQuery("");
    setShowHitlForm(false);
    setAlternateEmail("");
    setHitlNote("");
    setVerificationSent(false);
    setShowLegacyCodeEntry(false);
    setFeedback(null);
    setIsChangingCode(false);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  }

  async function handleRequestAccessOnFile() {
    if (!selectedShowId) return;
    setIsRequestingAccess(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setVerificationSent(true);
        setFeedback({
          type: "info",
          message: "Offline demo: verification email would be sent to the masked address on file.",
        });
        return;
      }
      const res = (await requestAccessOnFile({ showId: selectedShowId as never })) as {
        success: boolean;
        message: string;
        claimStatus?: "pending" | "verified" | "rejected";
      };
      if (res.success) {
        setVerificationSent(true);
        setFeedback({ type: res.claimStatus === "verified" ? "success" : "info", message: res.message });
        if (res.claimStatus === "verified" && accessStatus?.claimToken) {
          setActiveCode(accessStatus.claimToken);
        }
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to request access.",
      });
    } finally {
      setIsRequestingAccess(false);
    }
  }

  async function handleSubmitAlternateEmail(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedShowId) return;
    setIsRequestingAccess(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setFeedback({
          type: "success",
          message: "Offline demo: your alternate-email request would be escalated to a human admin.",
        });
        setShowHitlForm(false);
        return;
      }
      const res = (await requestAccessAlternate({
        showId: selectedShowId as never,
        alternateEmail: alternateEmail.trim(),
        note: hitlNote.trim() || undefined,
      })) as { success: boolean; message: string };
      setFeedback({ type: res.success ? "success" : "error", message: res.message });
      if (res.success) {
        setShowHitlForm(false);
        setAlternateEmail("");
        setHitlNote("");
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to submit review request.",
      });
    } finally {
      setIsRequestingAccess(false);
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleUpdateCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newCustomCode.trim();
    if (!trimmed || trimmed.length < 3) {
      setFeedback({ type: "error", message: "New code must be at least 3 characters long." });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setFeedback({
        type: "error",
        message: "Code can only contain letters, numbers, hyphens, and underscores.",
      });
      return;
    }

    setIsSavingCode(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setActiveCode(trimmed);
        setInputCode(trimmed);
        setIsChangingCode(false);
        setFeedback({
          type: "success",
          message: `Access code updated to "${trimmed}"! Save this code to manage your show anytime.`,
        });
      } else {
        const res = (await updateCodeMutation({
          currentToken: activeCode.trim(),
          newToken: trimmed,
        })) as { success: boolean; message: string; token?: string };
        if (res.success && typeof res.token === "string") {
          const updatedToken: string = res.token;
          setActiveCode(updatedToken);
          setInputCode(updatedToken);
          setIsChangingCode(false);
          setFeedback({
            type: "success",
            message: res.message || `Access code updated to "${updatedToken}"!`,
          });
        } else {
          setFeedback({
            type: "error",
            message: res.message || "Failed to update access code.",
          });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error updating access code.",
      });
    } finally {
      setIsSavingCode(false);
    }
  }

  async function handleSaveHook(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = customHookQuote.trim();
    if (!trimmed) {
      setFeedback({ type: "error", message: "Featured quote cannot be empty." });
      return;
    }

    setIsSavingHook(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setFeedback({ type: "success", message: "Featured quote updated successfully!" });
      } else {
        const res = (await updateHookMutation({
          token: activeCode.trim(),
          hookText: trimmed,
        })) as { success: boolean; message: string };
        if (res.success) {
          setFeedback({ type: "success", message: res.message });
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving narrative quote.",
      });
    } finally {
      setIsSavingHook(false);
    }
  }

  async function handleSaveReSlice(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const m = parseInt(reSliceMinutes || "0", 10);
    const s = parseInt(reSliceSeconds || "0", 10);
    const totalSeconds = Math.max(0, m * 60 + s);

    setIsSavingReSlice(true);
    setFeedback(null);
    try {
      if (isOffline) {
        setFeedback({
          type: "success",
          message: `Preview reel updated to start at ${m}:${s.toString().padStart(2, "0")}!`,
        });
      } else {
        const res = (await reSliceClipMutation({
          token: activeCode.trim(),
          startTime: totalSeconds,
          durationSeconds: 45,
        })) as { success: boolean; message: string };
        if (res.success) {
          setFeedback({ type: "success", message: res.message });
          if (audioRef.current && primarySnippet) {
            audioRef.current.currentTime = totalSeconds;
          }
        } else {
          setFeedback({ type: "error", message: res.message });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error updating preview reel.",
      });
    } finally {
      setIsSavingReSlice(false);
    }
  }

  return (
    <div className="w-full h-full flex-1 flex flex-col items-center justify-between text-left overflow-y-auto max-h-[calc(100dvh-160px)] sm:max-h-[calc(100dvh-220px)] pr-1">
      {/* Top Header Badge & Title */}
      <div className="w-full flex flex-col items-center justify-center text-center gap-2 pb-4 border-b border-disco-dark/15 mb-4 relative">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-disco-rose/25 px-3 py-1 font-['Lato'] text-[10px] sm:text-xs font-black uppercase tracking-wider text-disco-dark mb-1">
            <Radio className="h-3 w-3 text-disco-rose" />
            Show Host &amp; Manager Portal
          </div>
          <h2 className="font-['Lato'] text-lg sm:text-2xl font-black uppercase tracking-tight text-disco-dark">
            {activeData ? activeData.show.title : "Manage Your Show"}
          </h2>
        </div>

        {activeData && (
          <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-2 mt-2 sm:mt-0">
            {activeData.claim.claimStatus === "verified" || activeData.show.isClaimed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 font-['Lato'] text-xs font-black uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Verified Show
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 font-['Lato'] text-xs font-black uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Pending Verification
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setNewCustomCode(activeCode);
                setIsChangingCode((prev) => !prev);
              }}
              className="rounded-full bg-disco-navy/10 hover:bg-disco-navy/20 px-3 py-1 font-['Lato'] text-[11px] font-bold uppercase tracking-wider text-disco-navy transition cursor-pointer flex items-center gap-1"
              title="Update your access code to a memorable password"
            >
              <KeyRound className="h-3 w-3" />
              <span>Change Code</span>
            </button>
            <button
              type="button"
              onClick={handleLogOut}
              className="rounded-full bg-disco-dark/10 hover:bg-disco-dark/20 px-3 py-1 font-['Lato'] text-[11px] font-bold uppercase tracking-wider text-disco-dark transition cursor-pointer flex items-center gap-1"
              title="Log out of this show dashboard"
            >
              <LogOut className="h-3 w-3" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Change Code Drawer / Modal if toggled */}
      {activeData && isChangingCode && (
        <div className="w-full bg-white/90 border-2 border-disco-navy/30 rounded-2xl p-4 sm:p-5 shadow-md mb-4 transition-all animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-disco-navy" />
              <h4 className="font-['Lato'] text-sm font-black uppercase tracking-wide text-disco-dark">
                Update Your Access Code
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingCode(false)}
              className="h-6 w-6 rounded-full hover:bg-disco-dark/10 flex items-center justify-center text-disco-dark/60 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="font-['Lato'] text-xs text-disco-dark/75 mb-3 leading-relaxed">
            Replace your temporary random token with a custom code or password you can easily remember (e.g. <code className="bg-disco-dark/10 px-1 py-0.5 rounded font-mono text-[11px]">pitchdark_host</code> or <code className="bg-disco-dark/10 px-1 py-0.5 rounded font-mono text-[11px]">my_show_2026</code>).
          </p>
          <form
            onSubmit={(e) => {
              void handleUpdateCode(e);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={newCustomCode}
              onChange={(e) => setNewCustomCode(e.target.value)}
              placeholder="e.g. pitchdark_host or my_secret_code"
              className="flex-1 rounded-xl bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-disco-dark border-2 border-disco-dark/20 focus:border-disco-navy focus:outline-none placeholder:text-disco-dark/40 placeholder:font-sans"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSavingCode || !newCustomCode.trim() || newCustomCode.trim() === activeCode}
                className="rounded-xl bg-disco-navy hover:bg-disco-dark text-white px-4 py-2.5 font-['Lato'] text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isSavingCode ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save New Code</span>
              </button>
              <button
                type="button"
                onClick={() => setIsChangingCode(false)}
                className="rounded-xl bg-disco-dark/10 hover:bg-disco-dark/20 text-disco-dark px-3 py-2.5 font-['Lato'] text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hidden audio element for snippet player */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`w-full mb-4 p-3.5 rounded-xl font-['Lato'] text-xs sm:text-sm font-bold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : feedback.type === "error"
                ? "bg-rose-50 text-rose-900 border border-rose-200"
                : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* STATE 1: Code Input Mode */}
      {!activeData ? (
        <div className="w-full flex-1 flex flex-col justify-center items-center py-2 sm:py-6">
          <div className="w-full max-w-xl bg-white/60 border-2 border-disco-dark/15 rounded-2xl p-6 sm:p-8 shadow-sm text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-disco-rose/20 text-disco-rose flex items-center justify-center mb-4">
              <Search className="h-6 w-6" />
            </div>

            <h3 className="font-['Lato'] text-base sm:text-lg font-black uppercase tracking-wide text-disco-dark mb-2">
              Find Your Show &amp; Request Access
            </h3>
            <p className="font-['Lato'] text-xs sm:text-sm text-disco-dark/75 leading-relaxed mb-6 max-w-md">
              Search for your podcast on DiscoPod. We&apos;ll send a verification email to the host address we have on
              file so you can manage your 45-second Disco Reel.
            </p>

            <div className="w-full flex flex-col gap-2.5 mb-4 text-left">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-disco-dark/40" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedShowId(null);
                    setShowHitlForm(false);
                    setVerificationSent(false);
                  }}
                  placeholder="Search by show title or host name…"
                  className="w-full rounded-xl bg-white pl-10 pr-4 py-3 font-['Lato'] text-xs sm:text-sm font-bold text-disco-dark border-2 border-disco-dark/20 focus:border-disco-navy focus:outline-none placeholder:text-disco-dark/40"
                />
              </div>

              {debouncedSearch.length >= 2 && searchResults && searchResults.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-disco-dark/15 bg-white shadow-sm divide-y divide-disco-dark/10">
                  {searchResults.map((show) => (
                    <button
                      key={show.showId}
                      type="button"
                      onClick={() => {
                        setSelectedShowId(show.showId);
                        setShowHitlForm(false);
                        setVerificationSent(false);
                        setFeedback(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-disco-rose/10 transition cursor-pointer ${
                        selectedShowId === show.showId ? "bg-disco-rose/15" : ""
                      }`}
                    >
                      <img
                        src={show.coverArtUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover border border-disco-dark/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-['Lato'] text-xs sm:text-sm font-black text-disco-dark truncate">
                          {show.title}
                        </div>
                        <div className="font-['Lato'] text-[11px] text-disco-dark/65 truncate">
                          {show.hostName}
                          {show.maskedHostEmail ? ` · ${show.maskedHostEmail}` : " · no email on file"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {debouncedSearch.length >= 2 && searchResults && searchResults.length === 0 ? (
                <p className="font-['Lato'] text-xs text-disco-dark/60 px-1">No matching shows found.</p>
              ) : null}
            </div>

            {selectedShowPreview ? (
              <div className="w-full rounded-xl border border-disco-dark/15 bg-white/80 p-4 mb-4 text-left">
                <div className="flex items-start gap-3">
                  <img
                    src={selectedShowPreview.coverArtUrl}
                    alt={selectedShowPreview.title}
                    className="h-14 w-14 rounded-lg object-cover border border-disco-dark/10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-['Lato'] text-sm font-black text-disco-dark truncate">
                      {selectedShowPreview.title}
                    </h4>
                    {selectedShowPreview.hostName ? (
                      <p className="font-['Lato'] text-[11px] text-disco-dark/70">{selectedShowPreview.hostName}</p>
                    ) : null}
                    {selectedShowPreview.hasHostEmail && selectedShowPreview.maskedHostEmail ? (
                      <p className="font-['Lato'] text-[11px] text-disco-dark/80 mt-1 flex items-center gap-1">
                        <Mail className="h-3 w-3 text-disco-navy shrink-0" />
                        Verification will be sent to{" "}
                        <code className="font-mono text-[10px] bg-disco-dark/5 px-1 py-0.5 rounded">
                          {selectedShowPreview.maskedHostEmail}
                        </code>
                      </p>
                    ) : (
                      <p className="font-['Lato'] text-[11px] text-amber-800 mt-1">
                        No host email on file — use the alternate-email option below.
                      </p>
                    )}
                  </div>
                </div>

                {!showHitlForm ? (
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isRequestingAccess || !selectedShowPreview.hasHostEmail || verificationSent}
                      onClick={() => {
                        void handleRequestAccessOnFile();
                      }}
                      className="flex-1 rounded-xl bg-disco-navy hover:bg-disco-dark px-4 py-3 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isRequestingAccess ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : verificationSent ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      <span>{verificationSent ? "Email Sent — Check Inbox" : "Request Access"}</span>
                    </button>
                  </div>
                ) : null}

                {verificationSent && !showHitlForm ? (
                  <p className="mt-3 font-['Lato'] text-[11px] text-disco-dark/70 leading-relaxed">
                    Reply <strong>VERIFY</strong> from that inbox. This page will update automatically when your show is
                    verified.
                  </p>
                ) : null}

                {!showHitlForm ? (
                  <button
                    type="button"
                    onClick={() => setShowHitlForm(true)}
                    className="mt-3 font-['Lato'] text-[11px] font-bold text-disco-navy hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <UserRound className="h-3 w-3" />
                    Wrong email on file? Request human review with a different address
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      void handleSubmitAlternateEmail(e);
                    }}
                    className="mt-4 space-y-2 border-t border-disco-dark/10 pt-3"
                  >
                    <p className="font-['Lato'] text-[11px] text-disco-dark/75 text-left">
                      Tell us the correct email. A human admin will review and follow up — this is separate from our
                      staging email override.
                    </p>
                    <input
                      type="email"
                      required
                      value={alternateEmail}
                      onChange={(e) => setAlternateEmail(e.target.value)}
                      placeholder="your-correct-email@example.com"
                      className="w-full rounded-xl bg-white px-3.5 py-2.5 font-['Lato'] text-xs font-bold text-disco-dark border-2 border-disco-dark/20 focus:border-disco-navy focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      value={hitlNote}
                      onChange={(e) => setHitlNote(e.target.value)}
                      placeholder="Important: How can we verify that you are the host?"
                      className="w-full rounded-xl bg-white px-3.5 py-2.5 font-['Lato'] text-xs text-disco-dark border border-disco-dark/20 focus:border-disco-navy focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isRequestingAccess || !alternateEmail.trim()}
                        className="rounded-xl bg-disco-navy hover:bg-disco-dark text-white px-4 py-2.5 font-['Lato'] text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        Submit for Review
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHitlForm(false)}
                        className="rounded-xl bg-disco-dark/10 hover:bg-disco-dark/20 text-disco-dark px-3 py-2.5 font-['Lato'] text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}

            <div className="w-full pt-4 border-t border-disco-dark/10">
              <button
                type="button"
                onClick={() => setShowLegacyCodeEntry((prev) => !prev)}
                className="font-['Lato'] text-[10px] sm:text-xs font-bold uppercase tracking-wider text-disco-dark/50 hover:text-disco-navy cursor-pointer"
              >
                {showLegacyCodeEntry ? "Hide legacy claim code entry" : "Have a claim code from email?"}
              </button>

              {showLegacyCodeEntry ? (
                <form onSubmit={handleLookup} className="w-full flex flex-col sm:flex-row gap-2.5 mt-3">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. claim_tok_sidequest_77"
                    className="flex-1 rounded-xl bg-white px-4 py-3 font-mono text-xs sm:text-sm font-bold text-disco-dark border-2 border-disco-dark/20 focus:border-disco-navy focus:outline-none placeholder:text-disco-dark/40 placeholder:font-sans"
                  />
                  <button
                    type="submit"
                    disabled={isLookingUp}
                    className="rounded-xl bg-disco-dark/80 hover:bg-disco-dark px-6 py-3 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isLookingUp ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                        <span className="text-white font-bold">Checking...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white font-bold">Open with Code</span>
                        <ArrowRight className="h-4 w-4 text-white" />
                      </>
                    )}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Show Dashboard Mode */
        <div className="w-full flex-1 flex flex-col gap-4">
          {/* Show Overview Card */}
          <div className="w-full bg-white/70 border border-disco-dark/15 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
              src={activeData.show.coverArtUrl}
              alt={activeData.show.title}
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border-2 border-disco-dark/15 shrink-0 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-['Lato'] text-base sm:text-lg font-black text-disco-dark truncate">
                  {activeData.show.title}
                </h3>
              </div>
              <p className="font-['Lato'] text-xs text-disco-dark/80 line-clamp-2 mb-2 leading-relaxed">
                {activeData.show.description}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-['Lato'] text-[11px] font-bold text-disco-dark/65">
                {activeData.show.hostName && <span>Host: {activeData.show.hostName}</span>}
                {activeData.show.hostEmail && <span>Contact: {activeData.show.hostEmail}</span>}
                {activeData.show.websiteUrl && (
                  <a
                    href={activeData.show.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-disco-navy hover:underline"
                  >
                    Website ↗
                  </a>
                )}
                <div className="flex items-center gap-1.5 bg-disco-dark/5 px-2.5 py-1 rounded-lg text-disco-dark border border-disco-dark/10">
                  <KeyRound className="h-3 w-3 text-disco-navy shrink-0" />
                  <span className="text-[10px] uppercase font-bold text-disco-dark/60">Code:</span>
                  <span className="font-mono text-xs font-black text-disco-navy">{activeData.claim.token}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyCode(activeData.claim.token);
                    }}
                    className="ml-1 text-[10px] font-bold text-disco-navy hover:underline cursor-pointer"
                  >
                    {codeCopied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Claim Action Button (if not verified) */}
            {activeData.claim.claimStatus !== "verified" && !activeData.show.isClaimed && (
              <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    void handleClaimShow();
                  }}
                  disabled={isClaiming}
                  className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 font-['Lato'] text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isClaiming ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Verify &amp; Claim Show</span>
                </button>
              </div>
            )}
          </div>

          {/* 45-Second Reel Preview & Audio Player */}
          {primarySnippet && (
            <div className="w-full bg-disco-navy text-disco-cream rounded-2xl p-4 sm:p-5 shadow-lg border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-disco-rose/30 text-disco-rose flex items-center justify-center">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-['Lato'] text-[10px] font-black uppercase tracking-widest text-disco-rose block">
                      FEATURED 45-SECOND DISCO REEL
                    </span>
                    <h4 className="font-['Lato'] text-xs sm:text-sm font-extrabold text-disco-cream truncate max-w-md">
                      {primarySnippet.episodeTitle}
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTogglePlaySnippet(primarySnippet)}
                  className="rounded-full bg-disco-rose hover:bg-disco-rose/90 text-disco-dark h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center shadow transition hover:scale-110 active:scale-95 cursor-pointer shrink-0"
                >
                  {playingSnippetId === primarySnippet.snippetId && isPlaying ? (
                    <Pause className="h-4 w-4 fill-disco-dark" />
                  ) : (
                    <Play className="h-4 w-4 fill-disco-dark ml-0.5" />
                  )}
                </button>
              </div>

              {/* Hook text & Excerpt */}
              <div className="bg-black/25 rounded-xl p-3 border border-white/5 space-y-1.5">
                <p className="font-['Lato'] text-xs sm:text-sm font-bold text-disco-cream/95 leading-snug italic">
                  "{primarySnippet.hookText}"
                </p>
                <p className="font-['Lato'] text-[11px] text-disco-cream/70 leading-relaxed line-clamp-2">
                  {primarySnippet.transcriptExcerpt}
                </p>
              </div>
            </div>
          )}

          {/* IN-APP SHOW CONTROLS */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Control 1: Re-Slice 45-Second Highlight Reel */}
            <div className="rounded-2xl border-2 border-disco-dark/15 bg-white/70 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-disco-rose/20 text-disco-rose flex items-center justify-center">
                      <Scissors className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wide text-disco-dark">
                        Re-Slice Highlight Reel
                      </h4>
                      <span className="text-[10px] font-bold text-disco-dark/60 block">
                        Set start timestamp (45s window)
                      </span>
                    </div>
                  </div>
                  {primarySnippet && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-disco-dark/10 text-disco-dark">
                      {Math.floor(primarySnippet.startTime / 60)}:{(primarySnippet.startTime % 60).toString().padStart(2, "0")} – {Math.floor(primarySnippet.endTime / 60)}:{(primarySnippet.endTime % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                </div>

                <p className="font-['Lato'] text-xs text-disco-dark/75 leading-relaxed mb-3">
                  Choose where your 45-second preview starts in the episode. Listeners hear this highlight on the 3D globe.
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-['Lato'] text-xs font-bold text-disco-dark/70">Start:</span>
                  <div className="flex items-center gap-1 bg-white border border-disco-dark/20 rounded-xl px-2.5 py-1">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={reSliceMinutes}
                      onChange={(e) => setReSliceMinutes(e.target.value)}
                      className="w-10 text-center font-mono text-xs font-bold text-disco-dark focus:outline-none"
                    />
                    <span className="font-mono font-bold text-disco-dark/40">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={reSliceSeconds}
                      onChange={(e) => setReSliceSeconds(e.target.value)}
                      className="w-10 text-center font-mono text-xs font-bold text-disco-dark focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseInt(reSliceMinutes || "0", 10) * 60 + parseInt(reSliceSeconds || "0", 10);
                        const next = Math.max(0, cur - 15);
                        setReSliceMinutes(Math.floor(next / 60).toString());
                        setReSliceSeconds((next % 60).toString().padStart(2, "0"));
                      }}
                      className="px-2 py-1 rounded-lg bg-disco-dark/10 hover:bg-disco-dark/20 text-[10px] font-bold text-disco-dark cursor-pointer transition"
                    >
                      -15s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseInt(reSliceMinutes || "0", 10) * 60 + parseInt(reSliceSeconds || "0", 10);
                        const next = cur + 15;
                        setReSliceMinutes(Math.floor(next / 60).toString());
                        setReSliceSeconds((next % 60).toString().padStart(2, "0"));
                      }}
                      className="px-2 py-1 rounded-lg bg-disco-dark/10 hover:bg-disco-dark/20 text-[10px] font-bold text-disco-dark cursor-pointer transition"
                    >
                      +15s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReSliceMinutes("0");
                        setReSliceSeconds("30");
                      }}
                      className="px-2 py-1 rounded-lg bg-disco-dark/10 hover:bg-disco-dark/20 text-[10px] font-bold text-disco-dark cursor-pointer transition"
                    >
                      0:30
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReSliceMinutes("1");
                        setReSliceSeconds("00");
                      }}
                      className="px-2 py-1 rounded-lg bg-disco-dark/10 hover:bg-disco-dark/20 text-[10px] font-bold text-disco-dark cursor-pointer transition"
                    >
                      1:00
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-disco-dark/10">
                <button
                  type="button"
                  onClick={() => {
                    const m = parseInt(reSliceMinutes || "0", 10);
                    const s = parseInt(reSliceSeconds || "0", 10);
                    const t = Math.max(0, m * 60 + s);
                    if (audioRef.current && primarySnippet) {
                      audioRef.current.src = primarySnippet.audioUrl;
                      audioRef.current.currentTime = t;
                      audioRef.current.play().catch(() => {});
                      setIsPlaying(true);
                      setPlayingSnippetId(primarySnippet.snippetId);
                    }
                  }}
                  className="flex-1 rounded-xl bg-disco-navy/10 hover:bg-disco-navy/20 text-disco-navy py-2.5 px-3 font-['Lato'] text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveReSlice();
                  }}
                  disabled={isSavingReSlice}
                  className="flex-1 rounded-xl bg-disco-navy hover:bg-disco-dark text-white py-2.5 px-3 font-['Lato'] text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingReSlice ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Save Window</span>
                </button>
              </div>
            </div>

            {/* Control 2: Narrative Quote / Teaser Hook Editor */}
            <div className="rounded-2xl border-2 border-disco-dark/15 bg-white/70 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-disco-caramel/30 text-disco-caramel flex items-center justify-center">
                      <Quote className="h-4 w-4 text-disco-dark" />
                    </div>
                    <div>
                      <h4 className="font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wide text-disco-dark">
                        Featured Quote &amp; Hook
                      </h4>
                      <span className="text-[10px] font-bold text-disco-dark/60 block">
                        Customize your show's teaser
                      </span>
                    </div>
                  </div>
                </div>

                <p className="font-['Lato'] text-xs text-disco-dark/75 leading-relaxed mb-2">
                  This narrative teaser hook is featured on your 3D globe node and in the preview player.
                </p>

                <textarea
                  rows={2}
                  value={customHookQuote}
                  onChange={(e) => setCustomHookQuote(e.target.value)}
                  placeholder="Enter a compelling thesis quote from your show..."
                  className="w-full rounded-xl bg-white p-2.5 font-['Lato'] text-xs font-bold text-disco-dark border border-disco-dark/20 focus:border-disco-navy focus:outline-none resize-none mb-2 leading-snug"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-disco-dark/10">
                <span className="text-[10px] font-bold text-disco-dark/50">
                  {customHookQuote.length} characters
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveHook();
                  }}
                  disabled={isSavingHook || !customHookQuote.trim()}
                  className="rounded-xl bg-disco-navy hover:bg-disco-dark text-white py-2.5 px-4 font-['Lato'] text-xs font-black uppercase tracking-wider transition shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingHook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Save Quote</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Globe Positioning & Email Remote Reference */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-disco-dark/15 bg-white/50 p-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-disco-navy shrink-0" />
              <span className="font-['Lato'] text-xs text-disco-dark/80">
                Mapped at 3D coordinates ({activeData.show.coordinates.x.toFixed(2)}, {activeData.show.coordinates.y.toFixed(2)}, {activeData.show.coordinates.z.toFixed(2)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onLocateShowOnGlobe) {
                  onLocateShowOnGlobe(activeData.show.showId);
                }
                onClose();
              }}
              className="rounded-xl bg-disco-navy/10 hover:bg-disco-navy/20 text-disco-navy px-4 py-2 font-['Lato'] text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Locate on 3D Globe</span>
            </button>
          </div>

          {/* Helpful Remote Control Note */}
          <div className="w-full rounded-xl bg-disco-dark/5 p-2.5 text-center">
            <p className="font-['Lato'] text-[11px] text-disco-dark/70">
              💡 <strong>Remote Control:</strong> You can also update these anytime simply by replying to your notification emails with <code className="bg-white px-1 py-0.5 rounded font-mono text-[10px] text-disco-dark">Change snippet to MM:SS</code> or <code className="bg-white px-1 py-0.5 rounded font-mono text-[10px] text-disco-dark">Set hook to [quote]</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
