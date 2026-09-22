import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Sparkles, Disc3 } from "lucide-react";

export interface DiscoReelClip {
  title: string;
  hostName: string;
  coverArtUrl: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration?: number;
  hookText: string;
  transcriptExcerpt: string;
  showId: string;
  isAmped?: boolean;
  ampScore?: number;
}

interface DiscoReelPlayerProps {
  clip: DiscoReelClip;
  onClose?: () => void;
  onAmpSuccess?: (newScore: number) => void;
}

export function DiscoReelPlayer({ clip, onClose }: DiscoReelPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipDuration = Math.max(1, clip.endTime - clip.startTime);

  // Sync audio start position
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = clip.startTime;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [clip.audioUrl, clip.startTime]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const relTime = audioRef.current.currentTime - clip.startTime;
    setCurrentTime(Math.max(0, Math.min(clipDuration, relTime)));

    // Loop or pause when hitting end of 45s window
    if (audioRef.current.currentTime >= clip.endTime) {
      audioRef.current.currentTime = clip.startTime;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.currentTime < clip.startTime || audioRef.current.currentTime >= clip.endTime) {
        audioRef.current.currentTime = clip.startTime;
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn("Audio playback failed:", err);
        setIsPlaying(false);
      });
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const progressPercent = Math.min(100, (currentTime / clipDuration) * 100);

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-3xl border border-indigo-500/40 bg-gradient-to-b from-gray-900 via-gray-950 to-black p-5 shadow-2xl shadow-indigo-500/20 text-white select-none">
      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={clip.audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Disc3 className={`w-4 h-4 ${isPlaying ? "animate-spin duration-2000" : ""}`} />
          </div>
          <span className="text-xs font-mono font-semibold tracking-widest text-indigo-300 uppercase">
            Disco Reel
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            45s Reel
          </span>
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cover Art Stage */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
        <img
          src={clip.coverArtUrl || "https://placehold.co/400x400?text=DiscoPod"}
          alt={clip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
          <h3 className="text-lg font-bold text-white leading-tight drop-shadow-md line-clamp-1">
            {clip.title}
          </h3>
          <p className="text-xs font-medium text-indigo-300 drop-shadow-sm line-clamp-1">
            {clip.hostName || "Featured Host"}
          </p>
        </div>

        {/* Big Center Play/Pause Trigger */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-white" />
          ) : (
            <Play className="w-6 h-6 fill-white translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Dynamic Animated Waveform */}
      <div className="mt-4 px-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-1.5">
          <span>0:{Math.floor(currentTime).toString().padStart(2, "0")}</span>
          <span className="text-indigo-400 font-semibold">45s DISCO CLIP</span>
          <span>0:{Math.floor(clipDuration).toString().padStart(2, "0")}</span>
        </div>

        {/* Bar Waveform */}
        <div className="h-10 flex items-end gap-[3px] py-1">
          {Array.from({ length: 32 }).map((_, i) => {
            const barProgress = (i / 32) * 100;
            const isPassed = barProgress <= progressPercent;
            // Waveform height algorithm based on index and playback pulse
            const baseHeight = 25 + Math.sin(i * 0.4) * 20 + Math.cos(i * 0.8) * 15;
            const liveHeight = isPlaying ? Math.min(100, baseHeight + Math.sin(Date.now() * 0.005 + i) * 20) : baseHeight;

            return (
              <div
                key={i}
                style={{ height: `${Math.max(15, liveHeight)}%` }}
                className={`flex-1 rounded-full transition-all duration-100 ${
                  isPassed
                    ? "bg-gradient-to-t from-indigo-500 to-fuchsia-400 shadow-sm shadow-fuchsia-500/50"
                    : "bg-white/10"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Synchronized Transcript Hook Quote */}
      <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 mb-1">
          <Sparkles className="w-3 h-3" />
          <span>Narrative Hook</span>
        </div>
        <p className="text-xs text-gray-300 italic leading-relaxed line-clamp-3">
          "{clip.hookText || clip.transcriptExcerpt}"
        </p>
      </div>

      {/* Bottom Actions: Play/Pause and Close */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex-1 py-3 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-indigo-500/30 active:scale-95 cursor-pointer"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>Pause Clip</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
              <span>Play 45s Highlight</span>
            </>
          )}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-sm font-medium"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
