import { Heart, Trash2, Globe, ExternalLink, Compass } from "lucide-react";
import { useLikedShows, type LikedShowItem } from "./likedShowsStorage";

interface SavedPodcastsPanelProps {
  onLocateShowOnGlobe: (showId: string) => void;
  onClose: () => void;
  onStartDiscovery?: () => void;
}

export function SavedPodcastsPanel({
  onLocateShowOnGlobe,
  onClose,
  onStartDiscovery,
}: SavedPodcastsPanelProps) {
  const { likedShows, count, removeLiked, clearAll } = useLikedShows();

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1 select-none">
      {/* Header Banner */}
      <div className="border-b border-disco-dark/10 pb-5 mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3.5 py-1 font-['Lato'] text-[11px] sm:text-xs font-black uppercase tracking-wider text-rose-700 mb-2">
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
            Your Liked Collection
          </div>

          <h1 className="font-['Lato'] text-2xl sm:text-3xl font-black uppercase tracking-tight text-disco-dark">
            Liked Podcasts
          </h1>

          <p className="max-w-xl font-['Lato'] text-xs sm:text-sm font-semibold text-disco-dark/70 mt-1 leading-relaxed">
            Podcasts you loved while swiping in Discovery mode. Saved to your browser so you can jump back anytime.
          </p>
        </div>

        {/* Counter & Clear All Action */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="rounded-full bg-disco-dark/10 px-3 py-1 font-['Lato'] text-xs font-black uppercase tracking-wider text-disco-dark">
            {count} {count === 1 ? "Show" : "Shows"} Saved
          </span>
          {count > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear all your saved podcasts?")) {
                  clearAll();
                }
              }}
              className="inline-flex items-center gap-1 rounded-full bg-disco-dark/5 hover:bg-rose-500/10 text-disco-dark/60 hover:text-rose-600 border border-disco-dark/10 px-3 py-1 text-xs font-bold transition-all cursor-pointer"
              title="Clear all saved shows"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      {count === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl bg-white/40 border border-disco-dark/10 my-auto">
          <div className="h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 shadow-inner">
            <Heart className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h2 className="font-['Lato'] text-lg sm:text-xl font-black uppercase tracking-tight text-disco-dark mb-1">
            No Liked Podcasts Yet
          </h2>
          <p className="max-w-md font-['Lato'] text-xs sm:text-sm font-semibold text-disco-dark/70 mb-6 leading-relaxed">
            When you swipe right or tap &ldquo;Love It&rdquo; in Podcast Discovery, shows are automatically saved here so you never lose a great recommendation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onStartDiscovery ? (
              <button
                type="button"
                onClick={onStartDiscovery}
                className="inline-flex items-center gap-2 rounded-full bg-disco-rose hover:bg-disco-rose/90 text-disco-dark px-6 py-2.5 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Compass className="h-4 w-4" />
                <span>Explore Discovery Deck</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-disco-dark/10 hover:bg-disco-dark/20 text-disco-dark px-5 py-2.5 font-['Lato'] text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Back to Globe
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 pb-4">
          {likedShows.map((show: LikedShowItem) => (
            <div
              key={show.showId}
              className="group relative rounded-2xl bg-white/60 hover:bg-white/90 border border-disco-dark/10 p-4 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3.5 mb-2.5">
                  <img
                    src={show.coverArtUrl}
                    alt={show.title}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover shrink-0 shadow-md ring-1 ring-disco-dark/10"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {show.matchScore ? (
                        <span className="rounded-full bg-disco-rose/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-disco-rose border border-disco-rose/30">
                          {show.matchScore}% Match
                        </span>
                      ) : null}
                      {show.genre ? (
                        <span className="rounded-full bg-disco-dark/10 px-2 py-0.5 text-[9px] font-bold text-disco-dark/70">
                          {show.genre}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="font-['Lato'] text-sm sm:text-base font-black text-disco-dark leading-snug line-clamp-1">
                      {show.title}
                    </h3>
                    <p className="font-['Lato'] text-xs font-semibold text-disco-dark/60 mt-0.5 line-clamp-1">
                      {show.hostName || "Podcast Host"}
                    </p>
                  </div>
                </div>

                {show.whyYouWillLikeIt || show.recommendationReason ? (
                  <p className="font-['Lato'] text-[11px] font-medium text-disco-dark/75 bg-disco-dark/5 p-2 rounded-xl mb-3 line-clamp-2 leading-relaxed italic">
                    &ldquo;{show.whyYouWillLikeIt || show.recommendationReason}&rdquo;
                  </p>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-disco-dark/10 mt-1">
                <button
                  type="button"
                  onClick={() => onLocateShowOnGlobe(show.showId)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-disco-rose hover:bg-disco-rose/90 text-disco-dark px-3.5 py-1.5 font-['Lato'] text-[11px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Locate on Globe</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`/?show=${encodeURIComponent(show.showId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-disco-dark/10 hover:bg-disco-dark/20 text-disco-dark px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer"
                    title="Open Show Details in New Tab"
                  >
                    <span>Details</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => removeLiked(show.showId)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-disco-dark/40 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Remove from saved"
                    aria-label="Remove show"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
