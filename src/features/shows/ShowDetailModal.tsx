import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { Disc3, RotateCcw, AlertCircle } from "lucide-react";
import { api } from "../../convexApi";
import type { Id } from "../../../convex/_generated/dataModel";

import type { GlobeShowNode } from "../types";
import logoLightSvg from "../../assets/logo-light.svg";

export interface ShowDetailData {
  showId: string;
  title: string;
  description: string;
  coverArtUrl?: string;
  websiteUrl?: string;
  hostName?: string;
  hostEmail?: string;
  isClaimed?: boolean;
  isAmped?: boolean;
  ampScore?: number;
  platformLinks?: {
    spotify?: string;
    apple?: string;
    youtube?: string;
  };
  socialProfiles?: {
    youtube?: string;
    twitter?: string;
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    newsletter?: string;
    spotify?: string;
    apple?: string;
  };
  topSnippets: Array<{
    snippetId: string;
    episodeId: string;
    episodeTitle?: string;
    audioUrl?: string;
    hookText: string;
    transcriptExcerpt: string;
    startTime: number;
    endTime: number;
    playCount: number;
    upvotes: number;
    whyYouWillLikeIt?: string;
  }>;
  latestEpisodes: Array<{
    episodeId: string;
    title: string;
    pubDate: number;
    durationSeconds: number;
    summary: string;
    audioUrl: string;
  }>;
}

interface ShowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  show: GlobeShowNode | null;
  detail: ShowDetailData | null;
  onPlaySnippet?: (snippet: {
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
    ampScore: number;
  }) => void;
  onRequestTakedown?: (show: { showId: string; title: string; rssUrl?: string }) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ApplePodcastsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.56.65-.99 1.7-0.88 2.72 1.01.08 2-.47 2.61-1.22z" />
    </svg>
  );
}

function SpotifyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.308-1.758-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.721 1.12.294.18.388.563.208.85zM17.81 13.7c-.226.367-.706.482-1.072.256-2.687-1.652-6.785-2.131-9.965-1.165-.413.125-.85-.11-.975-.523-.125-.413.11-.85.523-.975 3.627-1.1 8.143-.574 11.233 1.33.366.226.481.706.256 1.072zm.156-2.855c-3.223-1.914-8.54-2.09-11.618-1.156-.494.15-1.02-.128-1.17-.622-.15-.494.128-1.02.622-1.17 3.536-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.444-.838.59-1.282.327z" />
    </svg>
  );
}

function YouTubeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function ShowDetailModal({
  isOpen,
  onClose,
  show,
  detail,
  onPlaySnippet,
  onRequestTakedown: _onRequestTakedown,
}: ShowDetailModalProps) {
  const [playingSnippetId, setPlayingSnippetId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(30);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [lastListenedSnippetId, setLastListenedSnippetId] = useState<string | null>(null);

  const activeClipRef = useRef<{ snippetId: string; startTime: number; endTime: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordListenerEvent = useMutation(api.analytics.recordListenerEvent);

  const effectiveShowId = show?.showId || detail?.showId;

  function handleChannelClick(channelName: string) {
    if (effectiveShowId) {
      void recordListenerEvent({
        showId: effectiveShowId as Id<"shows">,
        snippetId: lastListenedSnippetId ? (lastListenedSnippetId as Id<"snippets">) : undefined,
        eventType: "channel_click",
        channelName,
        source: "modal",
      });
    }
  }

  function handleRecordListen(snippetId: string) {
    setLastListenedSnippetId(snippetId);
    if (effectiveShowId) {
      void recordListenerEvent({
        showId: effectiveShowId as Id<"shows">,
        snippetId: snippetId as Id<"snippets">,
        eventType: "listen",
        source: "modal",
      });
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isOpen, onClose]);

  // Stop audio on close or show change
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSnippetId(null);
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      activeClipRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen || (!show && !detail)) return null;

  const displayTitle = detail?.title || show?.title || "Podcast";
  const displayCover = detail?.coverArtUrl || show?.coverArtUrl || "";
  const displayHost = detail?.hostName || show?.hostName || "Featured Host";
  const displayDesc = detail?.description || show?.description || "";
  const isClaimed = detail?.isClaimed ?? show?.isClaimed;

  const appleUrl =
    detail?.platformLinks?.apple ||
    detail?.socialProfiles?.apple ||
    `https://podcasts.apple.com/search?term=${encodeURIComponent(displayTitle)}`;
  const spotifyUrl =
    detail?.platformLinks?.spotify ||
    detail?.socialProfiles?.spotify ||
    `https://open.spotify.com/search/${encodeURIComponent(displayTitle)}`;
  const youtubeUrl =
    detail?.platformLinks?.youtube ||
    detail?.socialProfiles?.youtube ||
    `https://www.youtube.com/results?search_query=${encodeURIComponent(displayTitle + " podcast")}`;

  const activeSnippet = detail?.topSnippets.find((s) => s.snippetId === playingSnippetId);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    const active = activeClipRef.current;
    if (!audio || !active) return;

    const relTime = audio.currentTime - active.startTime;
    setCurrentTime(Math.max(0, Math.min(clipDuration, relTime)));

    // Loop clip when reaching endTime
    if (audio.currentTime >= active.endTime) {
      audio.currentTime = active.startTime;
      setCurrentTime(0);
      audio.play().catch(() => setIsPlaying(false));
    }
  };

  const handleAudioError = () => {
    setIsBuffering(false);
    setIsPlaying(false);
    setPlaybackError("Unable to stream audio from source podcast host. Tap Apple Podcasts or Spotify above to listen.");
  };

  function handleToggleAudio(snippet: {
    snippetId: string;
    episodeId: string;
    episodeTitle?: string;
    audioUrl?: string;
    hookText: string;
    transcriptExcerpt: string;
    startTime: number;
    endTime: number;
    upvotes?: number;
  }) {
    setPlaybackError(null);
    const audio = audioRef.current;
    if (!audio) return;

    // Toggle pause/play if already active
    if (playingSnippetId === snippet.snippetId) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Audio play resume error:", err);
            setPlaybackError("Playback was interrupted. Tap Play again.");
          });
      }
      return;
    }

    // Resolve audio URL
    const fallbackEp = detail?.latestEpisodes.find((e) => e.episodeId === snippet.episodeId);
    const resolvedAudioUrl = snippet.audioUrl || fallbackEp?.audioUrl;

    if (!resolvedAudioUrl) {
      setPlaybackError("Audio preview not available for this episode.");
      return;
    }

    const duration = Math.max(1, snippet.endTime - snippet.startTime);
    setClipDuration(duration);
    setCurrentTime(0);
    setPlayingSnippetId(snippet.snippetId);
    setIsBuffering(true);
    activeClipRef.current = {
      snippetId: snippet.snippetId,
      startTime: snippet.startTime,
      endTime: snippet.endTime,
    };

    handleRecordListen(snippet.snippetId);

    // Call optional parent handler to update analytics/parent state
    if (onPlaySnippet) {
      onPlaySnippet({
        snippetId: snippet.snippetId,
        showId: effectiveShowId || "",
        episodeId: snippet.episodeId,
        showTitle: displayTitle,
        episodeTitle: snippet.episodeTitle || fallbackEp?.title || displayTitle,
        hookText: snippet.hookText,
        transcriptExcerpt: snippet.transcriptExcerpt,
        startTime: snippet.startTime,
        endTime: snippet.endTime,
        audioUrl: resolvedAudioUrl,
        coverArtUrl: displayCover,
        similarityScore: 1.0,
        ampScore: snippet.upvotes ?? 0,
      });
    }

    // Set source and seek
    audio.src = resolvedAudioUrl;
    audio.currentTime = snippet.startTime;
    audio
      .play()
      .then(() => {
        setIsBuffering(false);
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn("Audio play error:", err);
        setIsBuffering(false);
        setIsPlaying(false);
        setPlaybackError("Audio playback paused or blocked. Tap Play to start listening.");
      });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${displayTitle} details`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Hidden HTML5 Audio Element for Direct Mobile/Desktop Playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onError={handleAudioError}
      />

      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-disco-dark/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Modal Card */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col animate-spring-in min-w-0">
        {/* Top Header Bar */}
        <div className="relative mb-2 sm:mb-3 flex items-center justify-between px-1 sm:px-2 w-full">
          {/* Creator Verified Badge (only if claimed) */}
          <div className="flex items-center gap-2">
            {isClaimed ? (
              <span className="rounded-full bg-emerald-400 text-slate-950 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider shadow-md">
                ✓ Verified Creator
              </span>
            ) : null}
          </div>

          {/* Centered DISCOPOD logo */}
          <img
            src={logoLightSvg}
            alt="DISCOPOD"
            className="hidden sm:block absolute left-1/2 -translate-x-1/2 h-7 w-auto drop-shadow select-none"
          />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close show detail"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-md transition-transform hover:scale-110 active:scale-95 border border-disco-cream/20 cursor-pointer shrink-0"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Container: Cream Card with Caramel Border */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden rounded-3xl border-4 sm:border-8 border-disco-caramel bg-disco-cream p-4 sm:p-8 shadow-2xl text-disco-dark w-full max-w-full">
          <div className="grid gap-6 md:grid-cols-[200px_1fr] w-full min-w-0">
            {/* Left Column: Artwork, Listen Links, Host Info, Website */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-4 w-full min-w-0">
              <div className="relative group shrink-0">
                <img
                  src={displayCover || "https://placehold.co/240x240/png"}
                  alt={`${displayTitle} cover`}
                  className="h-40 w-40 sm:h-48 sm:w-48 max-w-full rounded-2xl object-cover shadow-xl border-2 border-disco-dark/20"
                />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-disco-caramel/40 pointer-events-none" />
              </div>

              <div className="w-full space-y-2">
                {/* Platform Streaming & Listen Links (Word-free icon buttons) */}
                <div className="rounded-xl bg-disco-dark/5 p-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={appleUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleChannelClick("apple")}
                      title={`Listen to ${displayTitle} on Apple Podcasts`}
                      aria-label="Apple Podcasts"
                      className="flex h-10 items-center justify-center rounded-xl bg-white/90 hover:bg-white shadow-xs border border-disco-dark/10 transition-all hover:scale-110 active:scale-95 group cursor-pointer"
                    >
                      <ApplePodcastsIcon className="h-5 w-5 text-slate-900 group-hover:scale-110 transition-transform" />
                    </a>
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleChannelClick("spotify")}
                      title={`Listen to ${displayTitle} on Spotify`}
                      aria-label="Spotify"
                      className="flex h-10 items-center justify-center rounded-xl bg-white/90 hover:bg-white shadow-xs border border-disco-dark/10 transition-all hover:scale-110 active:scale-95 group cursor-pointer"
                    >
                      <SpotifyIcon className="h-5 w-5 text-[#1DB954] group-hover:scale-110 transition-transform" />
                    </a>
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleChannelClick("youtube")}
                      title={`Watch ${displayTitle} on YouTube`}
                      aria-label="YouTube"
                      className="flex h-10 items-center justify-center rounded-xl bg-white/90 hover:bg-white shadow-xs border border-disco-dark/10 transition-all hover:scale-110 active:scale-95 group cursor-pointer"
                    >
                      <YouTubeIcon className="h-5 w-5 text-[#FF0000] group-hover:scale-110 transition-transform" />
                    </a>
                  </div>
                </div>

                {/* Host / Network */}
                <div className="rounded-xl bg-disco-dark/5 p-3 text-xs text-left">
                  <p className="text-[10px] font-black uppercase tracking-wider text-disco-dark/60">
                    Host / Network
                  </p>
                  <p className="mt-0.5 font-extrabold text-disco-dark break-words">{displayHost}</p>
                </div>

                {/* Blue Button at Bottom Left with Crisp White Text */}
                <a
                  href={detail?.websiteUrl || `https://www.google.com/search?q=${encodeURIComponent(displayTitle + " podcast official website")}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => handleChannelClick("website")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-disco-navy px-3 py-2.5 text-xs font-black text-white shadow-md hover:bg-disco-navy/90 hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  <span className="text-white font-extrabold tracking-wide">Visit Website</span>
                  <span className="text-white font-extrabold">&rarr;</span>
                </a>
              </div>
            </div>

            {/* Right Column: Title, Description, Audio Clips */}
            <div className="flex flex-col justify-between space-y-5 w-full min-w-0">
              <div className="w-full min-w-0">
                <h2 className="font-['Passion_One'] text-2xl sm:text-3xl font-black uppercase text-disco-dark tracking-wide leading-tight break-words">
                  {displayTitle}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-disco-dark/80 font-medium leading-relaxed max-h-32 overflow-y-auto pr-2 break-words">
                  {displayDesc}
                </p>
              </div>

              {/* Error Notice if any */}
              {playbackError && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-600/30 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <p className="flex-1 break-words">{playbackError}</p>
                </div>
              )}

              {/* Preview Clips / Top Snippets */}
              <div className="space-y-3 w-full min-w-0">
                <div className="flex items-center justify-between border-b border-disco-dark/10 pb-1.5 gap-2">
                  <h3 className="font-['Lato'] text-xs font-black uppercase tracking-widest text-disco-dark/70 shrink-0">
                    Preview Clips &amp; Hooks
                  </h3>
                  <span className="text-[10px] font-bold text-disco-dark/50 shrink-0">
                    {detail?.topSnippets.length || 0} clips available
                  </span>
                </div>

                {detail && detail.topSnippets.length > 0 ? (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 w-full min-w-0">
                    {detail.topSnippets.slice(0, 4).map((snippet, idx) => {
                      const isThisSnippet = playingSnippetId === snippet.snippetId;
                      const isThisPlaying = isThisSnippet && isPlaying;
                      const duration = Math.max(1, snippet.endTime - snippet.startTime);
                      const progressPercent = isThisSnippet
                        ? Math.min(100, (currentTime / clipDuration) * 100)
                        : 0;

                      return (
                        <div
                          key={snippet.snippetId}
                          className={`group flex flex-col gap-2 rounded-xl border p-3 transition shadow-sm w-full min-w-0 ${
                            isThisSnippet
                              ? "border-disco-caramel bg-disco-caramel/10 ring-2 ring-disco-caramel/40"
                              : "border-disco-dark/10 bg-white/70 hover:border-disco-caramel hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 w-full min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-disco-dark leading-snug line-clamp-2 break-words">
                                  &ldquo;{snippet.hookText}&rdquo;
                                </p>
                                {isThisPlaying && (
                                  <div className="flex items-end gap-0.5 ml-1 shrink-0 h-3">
                                    <span className="w-1 h-3 bg-disco-caramel rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-1 h-4 bg-disco-cyan rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-1 h-2 bg-disco-caramel rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                  </div>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-disco-dark/60 font-mono">
                                <span className="shrink-0">Clip #{idx + 1} &middot; {duration}s preview</span>
                                {snippet.episodeTitle ? (
                                  <span className="line-clamp-1 break-words font-medium text-disco-dark/80">
                                    &bull; {snippet.episodeTitle}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleAudio(snippet)}
                              aria-label={isThisPlaying ? "Pause clip preview" : "Play clip preview"}
                              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition cursor-pointer shadow-md ${
                                isThisPlaying
                                  ? "bg-disco-caramel text-disco-dark ring-2 ring-disco-caramel/80 scale-105"
                                  : isThisSnippet
                                    ? "bg-disco-dark text-disco-cream"
                                    : "bg-disco-navy text-disco-cream hover:bg-disco-dark hover:scale-105 active:scale-95"
                              }`}
                            >
                              {isThisSnippet && isBuffering ? (
                                <>
                                  <span className="animate-spin text-xs">⏳</span>
                                  <span>Loading</span>
                                </>
                              ) : isThisPlaying ? (
                                <>
                                  <span>Pause</span>
                                  <span>⏸</span>
                                </>
                              ) : isThisSnippet ? (
                                <>
                                  <span>Resume</span>
                                  <span>▶</span>
                                </>
                              ) : (
                                <>
                                  <span>Play</span>
                                  <span>▶</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Live Clip Progress Bar */}
                          {isThisSnippet && (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-disco-dark/70 font-semibold">
                                <span>{formatTime(currentTime)}</span>
                                <span className="text-disco-caramel font-black tracking-wider uppercase">
                                  {isThisPlaying ? "Now Playing Clip" : isBuffering ? "Buffering..." : "Paused"}
                                </span>
                                <span>{formatTime(clipDuration)}</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-disco-dark/15 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-disco-caramel to-disco-cyan transition-all duration-100"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-disco-dark/20 p-4 text-center text-xs text-disco-dark/60">
                    No preview audio clips extracted yet for this show.
                  </div>
                )}
              </div>

              {/* Sticky Now Playing Audio Bar */}
              {activeSnippet && (
                <div className="mt-2 rounded-2xl bg-disco-navy p-3 text-disco-cream shadow-xl border border-disco-cream/20 animate-fade-in w-full min-w-0">
                  <div className="flex items-center justify-between gap-3 w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-lg bg-disco-cream/10 text-disco-caramel shrink-0 ${isPlaying ? "animate-spin duration-3000" : ""}`}>
                        <Disc3 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-white leading-tight break-words">
                          {activeSnippet.hookText}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-disco-cream/70 mt-0.5">
                          <span>{formatTime(currentTime)} / {formatTime(clipDuration)}</span>
                          <span className="text-disco-caramel font-bold uppercase tracking-wider">
                            {isPlaying ? "Playing" : isBuffering ? "Buffering" : "Paused"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (audioRef.current && activeClipRef.current) {
                            audioRef.current.currentTime = activeClipRef.current.startTime;
                            setCurrentTime(0);
                            audioRef.current.play().then(() => setIsPlaying(true));
                          }
                        }}
                        title="Replay clip"
                        className="p-1.5 rounded-full hover:bg-white/10 text-disco-cream/80 hover:text-white transition cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAudio(activeSnippet)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-disco-caramel text-disco-dark font-black shadow hover:scale-105 active:scale-95 transition cursor-pointer text-xs"
                      >
                        {isPlaying ? "⏸" : "▶"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 h-1 w-full rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-disco-caramel transition-all duration-100"
                      style={{ width: `${Math.min(100, (currentTime / Math.max(1, clipDuration)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Admin Link */}
              <div className="pt-3 border-t border-disco-dark/10 flex items-center justify-between text-[11px] text-disco-dark/60">
                <span>Podcast Creator or Rights Holder?</span>
                <Link
                  to="/admin"
                  className="font-bold text-disco-navy hover:text-disco-caramel hover:underline cursor-pointer transition-colors"
                >
                  Admin Page &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
