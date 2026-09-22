import { useState, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convexApi";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SimilarRecommendation, RecommendationClip } from "../types";
import { addLikedShow, removeLikedShow } from "./likedShowsStorage";

function ApplePodcastsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.56.65-.99 1.7-0.88 2.72 1.01.08 2-.47 2.61-1.22z" />
    </svg>
  );
}

function SpotifyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.308-1.758-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.721 1.12.294.18.388.563.208.85zM17.81 13.7c-.226.367-.706.482-1.072.256-2.687-1.652-6.785-2.131-9.965-1.165-.413.125-.85-.11-.975-.523-.125-.413.11-.85.523-.975 3.627-1.1 8.143-.574 11.233 1.33.366.226.481.706.256 1.072zm.156-2.855c-3.223-1.914-8.54-2.09-11.618-1.156-.494.15-1.02-.128-1.17-.622-.15-.494.128-1.02.622-1.17 3.536-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.444-.838.59-1.282.327z" />
    </svg>
  );
}

function YouTubeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface TinderDiscoveryDeckProps {
  seedTitle: string;
  seedCoverArtUrl?: string;
  recommendations: SimilarRecommendation[];
  onClose: () => void;
  onExploreOnGlobe: (showId: string) => void;
  onResetSearch: () => void;
}

export function TinderDiscoveryDeck({
  seedTitle,
  seedCoverArtUrl,
  recommendations,
  onClose,
  onExploreOnGlobe,
  onResetSearch,
}: TinderDiscoveryDeckProps) {
  const recordListenerEvent = useMutation(api.analytics.recordListenerEvent);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedShowIds, setLikedShowIds] = useState<string[]>([]);

  // Drag & gesture state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const dragStartTimeRef = useRef(0);
  const pointerActiveRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    target: HTMLElement | null;
    captured: boolean;
    isScroll: boolean;
  } | null>(null);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isTransitioningClip, setIsTransitioningClip] = useState(false);
  const [transitionNotice, setTransitionNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentShow = recommendations[currentIndex];
  const activeClip: RecommendationClip | undefined =
    currentShow?.clips?.[activeClipIndex] || currentShow?.clips?.[0];
  const clipStart = activeClip?.startTime ?? 0;
  const clipDuration = activeClip?.duration || 30;
  const clipEnd =
    activeClip?.endTime && activeClip.endTime > clipStart
      ? activeClip.endTime
      : clipStart + clipDuration;

  // Pause audio and reset clip when switching cards
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = clipStart;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveClipIndex(0);
    setShowTranscript(false);
    setIsTransitioningClip(false);
    setTransitionNotice(null);

    // Track recommendation view in listener analytics
    if (currentShow) {
      void recordListenerEvent({
        showId: currentShow.showId as Id<"shows">,
        snippetId: activeClip?.snippetId ? (activeClip.snippetId as Id<"snippets">) : undefined,
        eventType: "recommendation_view",
        source: "deck",
      });
    }
  }, [currentIndex, currentShow?.showId]);

  // Sync position when switching clips within the same show card
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = clipStart;
    }
    setCurrentTime(0);
  }, [activeClipIndex, clipStart]);

  // Audio time update handler & automatic clip transition
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleClipTransition() {
      if (!audio) return;
      audio.pause();
      setIsPlaying(false);

      const clips = currentShow?.clips;
      if (clips && clips.length > 1) {
        const nextIndex = (activeClipIndex + 1) % clips.length;
        const nextClip = clips[nextIndex];
        const nextStart = nextClip?.startTime ?? 0;
        setIsTransitioningClip(true);
        setTransitionNotice(`Playing Clip ${nextIndex + 1} of ${clips.length}`);

        setTimeout(() => {
          setActiveClipIndex(nextIndex);
          setCurrentTime(0);
          setIsTransitioningClip(false);
          setTransitionNotice(null);

          if (audioRef.current) {
            audioRef.current.currentTime = nextStart;
            audioRef.current
              .play()
              .then(() => setIsPlaying(true))
              .catch((err) => {
                console.warn("Autoplay next clip blocked or failed:", err);
                setIsPlaying(false);
              });
          }
        }, 850);
      } else {
        audio.currentTime = clipStart;
        setCurrentTime(0);
        setIsPlaying(false);
      }
    }

    function handleTimeUpdate() {
      if (!audio) return;
      const relTime = audio.currentTime - clipStart;
      if (audio.currentTime >= clipEnd || relTime >= clipDuration) {
        handleClipTransition();
      } else {
        setCurrentTime(Math.max(0, Math.min(clipDuration, relTime)));
      }
    }

    function handleEnded() {
      handleClipTransition();
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [activeClip, activeClipIndex, clipStart, clipEnd, clipDuration, currentShow?.clips]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.currentTime < clipStart || audioRef.current.currentTime >= clipEnd) {
        audioRef.current.currentTime = clipStart;
      }
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          if (currentShow) {
            void recordListenerEvent({
              showId: currentShow.showId as Id<"shows">,
              snippetId: activeClip?.snippetId ? (activeClip.snippetId as Id<"snippets">) : undefined,
              eventType: "listen",
              source: "deck",
            });
          }
        })
        .catch((err) => {
          console.warn("Audio play blocked or failed:", err);
          setIsPlaying(false);
        });
    }
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const relSeconds = parseFloat(e.target.value);
    setCurrentTime(relSeconds);
    if (audioRef.current) {
      audioRef.current.currentTime = clipStart + relSeconds;
    }
  }

  // Fast forward 45s to skip past dynamic sponsor ads
  function handleSkipAdNudge() {
    if (!audioRef.current) return;
    const newPos = audioRef.current.currentTime + 45;
    audioRef.current.currentTime = newPos;
    const relTime = Math.max(0, Math.min(clipDuration, newPos - clipStart));
    setCurrentTime(relTime);
  }

  // Swipe Action Triggers
  function swipeLeft() {
    if (!currentShow || exitDirection) return;
    setExitDirection("left");
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    if (currentShow) {
      void recordListenerEvent({
        showId: currentShow.showId as Id<"shows">,
        snippetId: activeClip?.snippetId ? (activeClip.snippetId as Id<"snippets">) : undefined,
        eventType: "skip",
        source: "deck",
      });
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
    }, 280);
  }

  function swipeRight() {
    if (!currentShow || exitDirection) return;
    setExitDirection("right");
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    if (currentShow) {
      void recordListenerEvent({
        showId: currentShow.showId as Id<"shows">,
        snippetId: activeClip?.snippetId ? (activeClip.snippetId as Id<"snippets">) : undefined,
        eventType: "like",
        source: "deck",
      });
    }

    setTimeout(() => {
      setLikedShowIds((prev) => [...prev, currentShow.showId]);
      addLikedShow({
        showId: currentShow.showId,
        title: currentShow.title,
        hostName: currentShow.hostName,
        coverArtUrl: currentShow.coverArtUrl,
        genre: currentShow.genre,
        matchScore: currentShow.matchScore,
        whyYouWillLikeIt: currentShow.whyYouWillLikeIt,
      });
      setCurrentIndex((prev) => prev + 1);
      setDragOffset({ x: 0, y: 0 });
      setExitDirection(null);
    }, 280);
  }

  function handleRewind() {
    if (currentIndex === 0) return;
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    const prevShow = recommendations[currentIndex - 1];
    if (prevShow) {
      setLikedShowIds((prev) => prev.filter((id) => id !== prevShow.showId));
      removeLikedShow(prevShow.showId);
    }
    setCurrentIndex((prev) => prev - 1);
  }

  function handleChannelClick(channelName: string) {
    if (currentShow) {
      void recordListenerEvent({
        showId: currentShow.showId as Id<"shows">,
        snippetId: activeClip?.snippetId ? (activeClip.snippetId as Id<"snippets">) : undefined,
        eventType: "channel_click",
        channelName,
        source: "deck",
      });
    }
  }

  // Pointer Gesture Handlers (Touch-pan-y friendly with directional lock)
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest(".no-drag")
    ) {
      return;
    }
    // Only drag with primary pointer
    if (e.pointerType === "mouse" && e.button !== 0) return;

    pointerActiveRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      target: e.currentTarget,
      captured: false,
      isScroll: false,
    };
    dragStartTimeRef.current = Date.now();
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const active = pointerActiveRef.current;
    if (!active || active.id !== e.pointerId || active.isScroll) return;

    const deltaX = e.clientX - active.startX;
    const deltaY = e.clientY - active.startY;

    // Detect gesture intention: if moving vertically faster or first, let the browser scroll!
    if (!active.captured) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
        active.isScroll = true;
        return;
      }
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        try {
          active.target?.setPointerCapture(active.id);
          active.captured = true;
        } catch {
          // ignore
        }
        setIsDragging(true);
      } else {
        return;
      }
    }

    if (isDragging || active.captured) {
      setDragOffset({ x: deltaX, y: deltaY * 0.25 });
    }
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const active = pointerActiveRef.current;
    pointerActiveRef.current = null;
    if (!active || active.id !== e.pointerId) return;

    if (active.captured) {
      try {
        active.target?.releasePointerCapture(active.id);
      } catch {
        // ignore
      }
    }

    if (!isDragging && !active.captured) {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    setIsDragging(false);

    const deltaX = e.clientX - active.startX;
    const elapsed = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocity = deltaX / elapsed; // px per millisecond

    // Snappy, forgiving swipe thresholds:
    // 1. Distance threshold: reduced from 90px down to 48px
    // 2. Flick velocity threshold: fast swipe (> 0.28 px/ms) commits with as little as 24px movement
    const isFlickRight = velocity > 0.28 && deltaX > 24;
    const isFlickLeft = velocity < -0.28 && deltaX < -24;
    const isDistanceRight = deltaX > 48;
    const isDistanceLeft = deltaX < -48;

    if (isFlickRight || isDistanceRight) {
      swipeRight();
    } else if (isFlickLeft || isDistanceLeft) {
      swipeLeft();
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  }

  // Generate 24 decorative audio visualizer bars
  const waveformBars = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const base = 25 + Math.sin(i * 0.5) * 20 + ((i * 7) % 35);
      return Math.max(15, Math.min(85, Math.round(base)));
    });
  }, []);

  const progressRatio = clipDuration > 0 ? Math.min(1, currentTime / clipDuration) : 0;

  // Deck finished view
  const isDeckFinished = currentIndex >= recommendations.length;
  const likedShows = recommendations.filter((show) => likedShowIds.includes(show.showId));

  if (isDeckFinished) {
    return (
      <div className="relative z-30 w-full max-w-xl animate-spring-in px-4">
        <div className="rounded-3xl bg-disco-navy p-6 sm:p-8 shadow-2xl border border-white/10 text-center space-y-6 backdrop-blur-md">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-disco-rose/20 text-disco-rose border border-disco-rose/40 shadow-inner">
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>

          <div>
            <h3 className="font-['Passion_One'] text-2xl sm:text-3xl font-black uppercase text-disco-cream tracking-wide">
              Discovery Complete!
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-disco-cream/70">
              You reviewed {recommendations.length} podcasts similar to{" "}
              <span className="font-bold text-disco-rose">&ldquo;{seedTitle}&rdquo;</span>.
            </p>
          </div>

          {likedShows.length > 0 ? (
            <div className="space-y-3 text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-disco-caramel block">
                Shows You Saved ({likedShows.length}):
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {likedShows.map((show) => (
                  <div
                    key={show.showId}
                    className="flex items-center justify-between rounded-xl bg-disco-dark/50 p-2.5 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={show.coverArtUrl}
                        alt={show.title}
                        className="h-10 w-10 rounded-lg object-cover shadow"
                      />
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-disco-cream line-clamp-1">
                          {show.title}
                        </h4>
                        <p className="text-[11px] text-disco-cream/60">{show.hostName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onExploreOnGlobe(show.showId)}
                      className="rounded-full bg-disco-rose px-3 py-1 text-[10px] font-black uppercase tracking-wider text-disco-dark shadow hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      Globe →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-disco-cream/50 italic">
              You didn&apos;t save any shows this round. Try exploring another seed podcast!
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onResetSearch}
              className="w-full sm:w-auto rounded-full bg-disco-caramel px-6 py-2.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              Search Another Show
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-full bg-disco-navy px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-disco-cream border border-disco-cream/20 shadow hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              Back to DiscoPod
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate card transform based on drag or exit
  const dragRotation = dragOffset.x * 0.08;
  let cardTransform = `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragRotation}deg)`;
  if (exitDirection === "left") {
    cardTransform = "translate3d(-150%, 20px, 0) rotate(-22deg)";
  } else if (exitDirection === "right") {
    cardTransform = "translate3d(150%, 20px, 0) rotate(22deg)";
  }

  const passOpacity = exitDirection === "left" ? 1 : Math.min(1, Math.max(0, -dragOffset.x / 45));
  const likeOpacity = exitDirection === "right" ? 1 : Math.min(1, Math.max(0, dragOffset.x / 45));

  // Behind card reveal interpolation: as top card drags/exits, behind card scales up to 100%
  const swipeProgress = exitDirection
    ? 1
    : Math.min(1, Math.max(0, Math.abs(dragOffset.x) / 120));
  const nextCardScale = 0.94 + swipeProgress * 0.06;
  const nextCardTranslateY = 16 * (1 - swipeProgress);
  const nextCardOpacity = 0.5 + swipeProgress * 0.5;

  const nextShow = recommendations[currentIndex + 1];

  return (
    <div className="relative z-30 w-full max-w-lg animate-spring-in px-4 select-none">
      {/* Hidden HTML5 Audio Element */}
      {activeClip?.audioUrl ? (
        <audio
          ref={audioRef}
          src={activeClip.audioUrl}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = clipStart;
            }
          }}
        />
      ) : null}

      {/* Top Header Bar - 100% Solid & Non-Transparent */}
      <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-2xl bg-disco-dark border border-white/15 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-disco-cream/90">
            SIMILAR TO:
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-disco-navy px-3 py-1 text-xs font-black text-disco-caramel border border-disco-caramel/60 shadow-md truncate max-w-[200px] sm:max-w-[270px]">
            {seedCoverArtUrl ? (
              <img src={seedCoverArtUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-disco-caramel/40" />
            ) : null}
            <span className="truncate">{seedTitle}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-bold text-disco-cream/80 bg-disco-navy px-2.5 py-0.5 rounded-full border border-white/10">
            {currentIndex + 1} / {recommendations.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close discovery"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-disco-navy hover:bg-disco-rose hover:text-disco-dark text-disco-cream border border-disco-cream/20 shadow hover:scale-110 active:scale-95 transition cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stacked Card Deck Container */}
      <div className="relative min-h-[480px] sm:min-h-[580px] w-full">
        {/* Next Card in Stack (Peek Preview Behind, Scaling Up as Top Card Swipes) */}
        {nextShow ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl bg-disco-navy/95 border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden"
            style={{
              transform: `scale(${nextCardScale}) translateY(${nextCardTranslateY}px)`,
              opacity: nextCardOpacity,
              zIndex: 10,
              transition: exitDirection ? "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease-out" : "none",
            }}
          >
            {/* Show Header & Cover Art */}
            <div className="flex items-start gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-white/10">
              <div className="relative h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-2xl overflow-hidden shadow-xl ring-2 ring-disco-cream/20">
                <img
                  src={nextShow.coverArtUrl}
                  alt={nextShow.title}
                  className="h-full w-full object-cover select-none"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="rounded-full bg-disco-rose/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-rose border border-disco-rose/30">
                    {nextShow.matchScore}% Vibe Match
                  </span>
                  <span className="rounded-full bg-disco-cream/10 px-2 py-0.5 text-[10px] font-bold text-disco-cream/70">
                    {nextShow.genre}
                  </span>
                </div>

                <h3 className="font-['Lato'] text-base sm:text-xl font-extrabold text-disco-cream leading-tight line-clamp-2">
                  {nextShow.title}
                </h3>
                <p className="text-xs text-disco-cream/60 mt-0.5 line-clamp-1">
                  Hosted by {nextShow.hostName}
                </p>
              </div>
            </div>

            {/* Why you might like it Teaser */}
            <div className="my-2.5 sm:my-3.5 rounded-2xl bg-disco-dark/50 p-3 sm:p-4 border border-disco-caramel/30 space-y-1.5 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-disco-caramel">
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Why you might like this
                </span>
              </div>
              <p className="text-xs sm:text-sm text-disco-cream/90 leading-relaxed font-medium line-clamp-2 sm:line-clamp-3">
                {nextShow.whyYouWillLikeIt}
              </p>
            </div>

            {/* Audio preview placeholder */}
            <div className="h-16 sm:h-20 rounded-2xl bg-black/30 border border-white/5 flex items-center justify-center text-xs font-bold text-disco-cream/40">
              Listen to Clips
            </div>
          </div>
        ) : null}

        {/* Current Active Tinder Card */}
        {currentShow ? (
          <div
            key={currentShow.showId}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className={`relative z-20 w-full rounded-3xl bg-disco-navy p-4 sm:p-6 shadow-2xl border border-white/10 backdrop-blur-md cursor-grab active:cursor-grabbing touch-pan-y select-none ${
              exitDirection
                ? "transition-all duration-300 ease-out pointer-events-none"
                : isDragging
                  ? ""
                  : "transition-transform duration-200 ease-out"
            }`}
            style={{ transform: cardTransform }}
          >
            {/* Visual Swipe Stamps - Solid, Non-See-Through & Ultra-Legible */}
            <div
              className="pointer-events-none absolute top-8 right-8 z-40 rounded-2xl bg-rose-600 px-5 py-2 text-xl font-black uppercase tracking-widest text-white shadow-2xl border-2 border-white rotate-12 transition-transform duration-100 select-none"
              style={{
                opacity: passOpacity,
                transform: `rotate(12deg) scale(${passOpacity > 0 ? 0.9 + passOpacity * 0.15 : 0.8})`,
              }}
            >
              PASS
            </div>
            <div
              className="pointer-events-none absolute top-8 left-8 z-40 rounded-2xl bg-emerald-600 px-5 py-2 text-xl font-black uppercase tracking-widest text-white shadow-2xl border-2 border-white -rotate-12 transition-transform duration-100 select-none"
              style={{
                opacity: likeOpacity,
                transform: `rotate(-12deg) scale(${likeOpacity > 0 ? 0.9 + likeOpacity * 0.15 : 0.8})`,
              }}
            >
              LOVE IT
            </div>

            {/* Show Header & Cover Art */}
            <div className="flex items-start gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-white/10">
              <div className="relative h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-2xl overflow-hidden shadow-xl ring-2 ring-disco-cream/20">
                <img
                  src={currentShow.coverArtUrl}
                  alt={currentShow.title}
                  className="h-full w-full object-cover select-none"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="rounded-full bg-disco-rose/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-disco-rose border border-disco-rose/30">
                    {currentShow.matchScore}% Vibe Match
                  </span>
                  <span className="rounded-full bg-disco-cream/10 px-2 py-0.5 text-[10px] font-bold text-disco-cream/70">
                    {currentShow.genre}
                  </span>
                </div>

                <h3 className="font-['Lato'] text-base sm:text-xl font-extrabold text-disco-cream leading-tight line-clamp-2">
                  {currentShow.title}
                </h3>
                <p className="text-xs text-disco-cream/60 mt-0.5 line-clamp-1">
                  Hosted by {currentShow.hostName}
                </p>
              </div>
            </div>

            {/* "Why you might like it" Recommendation Rationale */}
            <div className="my-2.5 sm:my-3.5 rounded-2xl bg-disco-dark/50 p-3 sm:p-4 border border-disco-caramel/30 space-y-1 sm:space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-disco-caramel">
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Why you might like this
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/?show=${encodeURIComponent(currentShow.showId)}`, "_blank");
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-disco-navy/90 hover:bg-disco-navy px-2.5 py-1 text-[10px] font-bold text-disco-cream hover:text-white border border-white/10 shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer no-drag"
                  title="View Details"
                >
                  <span>View Details</span>
                  <svg className="h-2.5 w-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-disco-cream/90 leading-relaxed font-medium line-clamp-2 sm:line-clamp-none">
                {currentShow.whyYouWillLikeIt}
              </p>
            </div>

            {/* "Listen to clips" Section (HERO FEATURE) */}
            <div className="relative overflow-hidden rounded-2xl bg-black/40 p-3 sm:p-4 border border-white/10 space-y-2.5 sm:space-y-3 no-drag">
              {/* Transition to Next Clip Animation Overlay */}
              {isTransitioningClip && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-disco-dark/95 backdrop-blur-md border border-disco-rose/50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 text-disco-rose font-black text-xs sm:text-sm">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-disco-rose opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-disco-rose"></span>
                    </span>
                    <span>{transitionNotice || "Next clip starting..."}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-disco-rose via-disco-caramel to-emerald-400 animate-pulse w-full" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Immediate Inline Play/Pause Button for Zero-Scroll Playback */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause audio clip" : "Play audio clip"}
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-disco-rose text-disco-dark shadow-md hover:scale-105 active:scale-95 transition cursor-pointer shrink-0"
                    title={isPlaying ? "Pause audio" : "Play audio"}
                  >
                    {isPlaying ? (
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <div className="flex items-center gap-1 text-disco-rose">
                    <svg className="h-3.5 w-3.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">
                      {isPlaying ? "Playing Clip" : "Listen to Clip"} ({clipDuration}s)
                    </span>
                  </div>
                </div>

                {/* Multiple clips tabs if available */}
                {currentShow.clips && currentShow.clips.length > 1 ? (
                  <div className="flex items-center gap-1">
                    {currentShow.clips.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setActiveClipIndex(idx);
                          setIsPlaying(false);
                          setCurrentTime(0);
                        }}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase transition cursor-pointer ${
                          activeClipIndex === idx
                            ? "bg-disco-rose text-disco-dark"
                            : "bg-white/10 text-disco-cream/60 hover:text-disco-cream"
                        }`}
                      >
                        Clip {idx + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Hook Text */}
              {activeClip?.hookText ? (
                <p className="text-xs sm:text-sm font-bold text-disco-cream italic line-clamp-2">
                  &ldquo;{activeClip.hookText}&rdquo;
                </p>
              ) : null}

              {/* Animated Waveform Visualization - Clickable to Play/Pause */}
              <div
                onClick={togglePlay}
                role="button"
                tabIndex={0}
                aria-label={isPlaying ? "Pause audio clip" : "Play audio clip"}
                title={isPlaying ? "Click to pause" : "Click to play"}
                className="relative h-11 sm:h-14 w-full overflow-hidden rounded-xl bg-disco-dark/70 px-2 py-2 flex items-end gap-1 border border-white/5 cursor-pointer hover:border-disco-rose/40 transition group"
              >
                {waveformBars.map((height, i) => {
                  const barFraction = i / waveformBars.length;
                  const isPlayed = barFraction <= progressRatio;
                  return (
                    <span
                      key={i}
                      className="flex-1 rounded-sm transition-all duration-150 group-hover:opacity-90"
                      style={{
                        height: isPlaying ? `${Math.min(100, height * (0.8 + Math.random() * 0.4))}%` : `${height}%`,
                        backgroundColor: isPlayed ? "#b97179" : "#354156",
                      }}
                    />
                  );
                })}
              </div>

              {/* Play / Pause & Scrubber Bar */}
              <div className="space-y-1 sm:space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-disco-cream/60">
                  <span>{formatTime(currentTime)}</span>
                  <button
                    type="button"
                    onClick={handleSkipAdNudge}
                    title="If audio is an ad, click to skip forward 45 seconds"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300 hover:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 transition hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <span>⚡ Skip Ad (+45s)</span>
                  </button>
                  <span>{formatTime(clipDuration)}</span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={clipDuration}
                  step={0.1}
                  value={currentTime}
                  onChange={handleScrub}
                  aria-label="Audio scrubber"
                  className="w-full accent-disco-rose h-1.5 rounded-lg bg-disco-navy/80 cursor-pointer"
                />
              </div>

              {/* Transcript Dropdown Toggle */}
              {activeClip?.transcriptExcerpt ? (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="text-[10px] font-bold text-disco-cream/60 hover:text-disco-cream flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>{showTranscript ? "Hide spoken excerpt" : "Read spoken excerpt"}</span>
                    <span className="text-[8px]">{showTranscript ? "▲" : "▼"}</span>
                  </button>
                  {showTranscript ? (
                    <p className="mt-1.5 text-xs text-disco-cream/80 italic border-l-2 border-disco-rose/40 pl-2.5 line-clamp-3">
                      &ldquo;{activeClip.transcriptExcerpt}&rdquo;
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Quick Link Streaming Platform Buttons */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-disco-cream/60">
                  Full show on:
                </span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={
                      currentShow.spotifyUrl ||
                      `https://open.spotify.com/search/${encodeURIComponent(currentShow.title)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleChannelClick("Spotify")}
                    title={`Listen to ${currentShow.title} on Spotify`}
                    aria-label="Spotify"
                    className="flex h-7 items-center gap-1 rounded-lg bg-white/10 hover:bg-[#1DB954]/20 hover:text-[#1DB954] text-disco-cream px-2 text-[10px] font-bold border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <SpotifyIcon className="h-3.5 w-3.5 text-[#1DB954]" />
                    <span>Spotify</span>
                  </a>
                  <a
                    href={
                      currentShow.appleUrl ||
                      `https://podcasts.apple.com/search?term=${encodeURIComponent(currentShow.title)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleChannelClick("Apple Podcasts")}
                    title={`Listen to ${currentShow.title} on Apple Podcasts`}
                    aria-label="Apple Podcasts"
                    className="flex h-7 items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 text-disco-cream px-2 text-[10px] font-bold border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ApplePodcastsIcon className="h-3.5 w-3.5 text-white" />
                    <span>Apple</span>
                  </a>
                  <a
                    href={
                      currentShow.youtubeUrl ||
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(currentShow.title + " podcast")}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleChannelClick("YouTube")}
                    title={`Watch ${currentShow.title} on YouTube`}
                    aria-label="YouTube"
                    className="flex h-7 items-center gap-1 rounded-lg bg-white/10 hover:bg-[#FF0000]/20 hover:text-[#FF0000] text-disco-cream px-2 text-[10px] font-bold border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <YouTubeIcon className="h-3.5 w-3.5 text-[#FF0000]" />
                    <span>YouTube</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Tinder Control Buttons */}
            <div className="mt-3 sm:mt-4 flex items-center justify-between pt-2 border-t border-white/10 no-drag">
              {/* Rewind / Undo */}
              <button
                type="button"
                onClick={handleRewind}
                disabled={currentIndex === 0}
                aria-label="Previous recommendation"
                className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-disco-dark/60 text-disco-cream border border-white/10 shadow transition hover:scale-105 active:scale-95 cursor-pointer ${
                  currentIndex === 0 ? "opacity-30 cursor-not-allowed" : ""
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>

              {/* Pass Button (Red / Rose) */}
              <button
                type="button"
                onClick={swipeLeft}
                aria-label="Pass on this show"
                className="flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-disco-dark text-disco-rose border-2 border-disco-rose/50 shadow-xl transition-transform hover:scale-110 active:scale-90 cursor-pointer"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Main Play / Pause Hero Button */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause audio clip" : "Play audio clip"}
                className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-disco-rose text-disco-dark shadow-2xl transition-transform hover:scale-110 active:scale-90 cursor-pointer"
              >
                {isPlaying ? (
                  <svg className="h-5 w-5 sm:h-6 sm:w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 sm:h-6 sm:w-6 fill-current translate-x-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Love / Save Button (Emerald / Green) */}
              <button
                type="button"
                onClick={swipeRight}
                aria-label="Love this show"
                className="flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-disco-dark text-emerald-400 border-2 border-emerald-400/50 shadow-xl transition-transform hover:scale-110 active:scale-90 cursor-pointer"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>

              {/* View Details */}
              <button
                type="button"
                onClick={() => {
                  window.open(`/?show=${encodeURIComponent(currentShow.showId)}`, "_blank");
                }}
                aria-label="View Details"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-disco-navy text-disco-caramel border border-disco-caramel/40 shadow transition hover:scale-105 active:scale-95 cursor-pointer"
                title="View Details"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <path strokeWidth="2" d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Help hint: Swipe like Tinder */}
      <div className="mt-3 sm:mt-4 flex items-center justify-center pointer-events-none">
        <div className="inline-flex items-center gap-2 rounded-full bg-disco-dark/85 border border-white/15 px-4 py-1.5 text-xs font-bold text-disco-cream/80 shadow-2xl backdrop-blur-md">
          <svg
            className="h-3.5 w-3.5 text-disco-rose shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>You can swipe like Tinder</span>
          <svg
            className="h-3.5 w-3.5 text-emerald-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
