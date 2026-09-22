import { useMemo, useRef, useState } from "react";

import type { SnippetResult } from "../types";

type WaveformPlayerProps = {
  snippet: SnippetResult | null;
};

export function WaveformPlayer({ snippet }: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  if (!snippet) {
    return (
      <section className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
        <h2 className="text-lg font-semibold">Waveform player</h2>
        <p className="mt-3 text-sm text-slate-400">
          Pick a snippet from search results to preview its hook timestamp.
        </p>
      </section>
    );
  }

  const bars = useMemo(() => buildWaveBars(snippet.snippetId, 60), [snippet.snippetId]);
  const snippetDuration =
    snippet.endTime > snippet.startTime ? snippet.endTime - snippet.startTime : 0;
  const progress =
    snippetDuration > 0
      ? Math.max(0, Math.min(1, (currentTime - snippet.startTime) / snippetDuration))
      : 0;

  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold">Waveform player</h2>
      <div className="mt-3 space-y-2">
        <p className="text-sm text-slate-200">{snippet.episodeTitle}</p>
        <p className="text-xs text-slate-400">
          Starts at {formatTimestamp(snippet.startTime)} · ends at{" "}
          {formatTimestamp(snippet.endTime)}
        </p>
        <div className="relative mt-2 h-20 overflow-hidden rounded-md border border-white/10 bg-black/40 p-2">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20" />
          <div className="relative flex h-full items-end gap-[2px]">
            {bars.map((height, index) => {
              const barProgress = index / bars.length;
              return (
                <span
                  key={`${snippet.snippetId}-${index}`}
                  className="w-full rounded-sm"
                  style={{
                    height: `${height}%`,
                    backgroundColor:
                      barProgress <= progress ? "rgb(34 211 238)" : "rgb(71 85 105)",
                  }}
                />
              );
            })}
          </div>
        </div>
        <audio
          ref={audioRef}
          className="w-full"
          controls
          preload="none"
          src={snippet.audioUrl}
          onTimeUpdate={() => {
            const current = audioRef.current?.currentTime;
            setCurrentTime(current ?? snippet.startTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = snippet.startTime;
              setCurrentTime(snippet.startTime);
            }
          }}
        />
      </div>
    </section>
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function buildWaveBars(seedText: string, size: number): number[] {
  let seed = [...seedText].reduce((acc, char) => acc + char.charCodeAt(0), 17);
  const bars: number[] = [];
  for (let index = 0; index < size; index += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483647;
    const value = 20 + (seed % 70);
    bars.push(value);
  }
  return bars;
}
