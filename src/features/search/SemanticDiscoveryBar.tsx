/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { useState } from "react";
import { useAction } from "convex/react";
import { Sparkles, Play, Compass, ArrowRight, Loader2 } from "lucide-react";
import { api } from "../../convexApi";
import type { DiscoReelClip } from "../player/DiscoReelPlayer";

interface SemanticDiscoveryBarProps {
  onPlayClip?: (clip: DiscoReelClip) => void;
  onSelectShow?: (showId: string) => void;
}

interface SemanticSearchResult {
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
}

const SAMPLE_PROMPTS = [
  "Autonomous AI agents & code synthesis",
  "Macroeconomic cycles & capital allocation",
  "Silicon Valley founder war stories",
  "Longevity, sleep & biological health",
];

export function SemanticDiscoveryBar({ onPlayClip, onSelectShow }: SemanticDiscoveryBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchSemantic = useAction(api.searchActions.searchSnippetsSemantic);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || isLoading) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await searchSemantic({
        query: searchQuery.trim(),
        limit: 8,
      });
      setResults(res.results as SemanticSearchResult[]);
    } catch (err) {
      console.error("Semantic search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSearch(query);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Search Input Box */}
      <form onSubmit={handleFormSubmit} className="relative group">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30 group-hover:opacity-60 transition duration-500 blur-sm pointer-events-none" />
        <div className="relative flex items-center bg-gray-950/90 border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl">
          <div className="pl-3 pr-2 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic, quote, or thesis (vector embedding query)..."
            className="w-full bg-transparent px-2 py-2 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Prompt Chips */}
      {!hasSearched && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-gray-500 font-medium">Try exploring:</span>
          {SAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQuery(prompt);
                void handleSearch(prompt);
              }}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Results Stream */}
      {hasSearched && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>
              Found <strong className="text-white">{results.length}</strong> matching audio snippets in 1536-dim vector space
            </span>
            <button
              onClick={() => {
                setHasSearched(false);
                setResults([]);
                setQuery("");
              }}
              className="hover:text-white underline transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {results.map((snippet) => {
              const isPlayingThis = activeSnippetId === snippet.snippetId;

              return (
                <div
                  key={snippet.snippetId}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl bg-gray-900/80 hover:bg-gray-900 border border-white/10 hover:border-indigo-500/40 shadow-xl transition-all"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={snippet.coverArtUrl || "https://placehold.co/100x100?text=DiscoPod"}
                      alt={snippet.showTitle}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {Math.round(snippet.similarityScore * 100)}% match
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {snippet.showTitle}
                      </h4>
                      <p className="text-xs text-gray-400 truncate">{snippet.episodeTitle}</p>
                    </div>
                  </div>

                  {/* Hook Quote */}
                  <div className="my-3 p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs text-gray-300 italic line-clamp-2">
                    "{snippet.hookText || snippet.transcriptExcerpt}"
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <button
                      onClick={() => {
                        setActiveSnippetId(snippet.snippetId);
                        if (onPlayClip) {
                          onPlayClip({
                            title: snippet.showTitle,
                            hostName: snippet.episodeTitle,
                            coverArtUrl: snippet.coverArtUrl,
                            audioUrl: snippet.audioUrl,
                            startTime: snippet.startTime,
                            endTime: snippet.endTime,
                            hookText: snippet.hookText,
                            transcriptExcerpt: snippet.transcriptExcerpt,
                            showId: snippet.showId,
                            ampScore: snippet.ampScore,
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors font-medium ${
                        isPlayingThis
                          ? "bg-indigo-600 text-white border-indigo-400"
                          : "bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-500/30 hover:text-white"
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isPlayingThis ? "Playing..." : "Play 45s Reel"}</span>
                    </button>

                    {onSelectShow && (
                      <button
                        onClick={() => onSelectShow(snippet.showId)}
                        className="px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
                      >
                        <Compass className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>Locate on Globe</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
