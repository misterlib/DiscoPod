import { useState, useEffect, useRef, type FormEvent } from "react";
import type { DiscoveryPodcastItem } from "../types";

interface DiscoverySearchCardProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onLaunchDiscovery: (selectedPodcast: DiscoveryPodcastItem) => void;
  onSearchPodcasts: (
    query: string,
  ) => Promise<{ ingested: DiscoveryPodcastItem[]; external: DiscoveryPodcastItem[] }>;
  onFastIngest?: (podcast: DiscoveryPodcastItem) => Promise<DiscoveryPodcastItem>;
}

export function DiscoverySearchCard({
  isOpen,
  initialQuery = "",
  onClose,
  onLaunchDiscovery,
  onSearchPodcasts,
  onFastIngest,
}: DiscoverySearchCardProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedPodcast, setSelectedPodcast] = useState<DiscoveryPodcastItem | null>(null);
  const [ingestedResults, setIngestedResults] = useState<DiscoveryPodcastItem[]>([]);
  const [externalResults, setExternalResults] = useState<DiscoveryPodcastItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mustPickPrompt, setMustPickPrompt] = useState(false);

  const debounceTimerRef = useRef<number | null>(null);
  const lastSearchedQueryRef = useRef<string>("");
  const fastIngestPromiseRef = useRef<Promise<DiscoveryPodcastItem> | null>(null);

  // Debounced search when typing
  useEffect(() => {
    const trimmed = query.trim();
    if (selectedPodcast && selectedPodcast.title === query) {
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (trimmed.length >= 2) {
      debounceTimerRef.current = window.setTimeout(() => {
        void executeSearch(trimmed);
      }, 300);
    } else {
      setIngestedResults([]);
      setExternalResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, selectedPodcast]);

  async function executeSearch(searchTerm: string) {
    if (!searchTerm || isSearching) return;
    lastSearchedQueryRef.current = searchTerm;
    setIsSearching(true);
    setMustPickPrompt(false);

    try {
      const results = await onSearchPodcasts(searchTerm);
      setIngestedResults(results.ingested || []);
      setExternalResults(results.external || []);
      setShowDropdown(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setMustPickPrompt(false);
    if (selectedPodcast) {
      setSelectedPodcast(null);
    }
  }

  function handleSelectPodcast(podcast: DiscoveryPodcastItem) {
    setSelectedPodcast(podcast);
    setQuery(podcast.title);
    setShowDropdown(false);
    setMustPickPrompt(false);

    // If selected podcast has not been ingested yet, trigger fast ingestion immediately
    if (!podcast.isIngested && onFastIngest) {
      setIsIngesting(true);
      const ingestPromise = onFastIngest(podcast)
        .then((ingestedItem) => {
          setSelectedPodcast(ingestedItem);
          return ingestedItem;
        })
        .catch((err) => {
          console.warn("Fast ingestion error:", err);
          return podcast;
        })
        .finally(() => {
          setIsIngesting(false);
        });

      fastIngestPromiseRef.current = ingestPromise;
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitDiscovery();
  }

  async function submitDiscovery() {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (!selectedPodcast) {
      // User tapped button before selecting a podcast: perform Search and prompt selection
      void executeSearch(trimmed);
      setShowDropdown(true);
      setMustPickPrompt(true);
    } else {
      // If fast-ingestion is currently in flight, await it before opening the deck
      let podcastToLaunch = selectedPodcast;
      if (isIngesting && fastIngestPromiseRef.current) {
        try {
          podcastToLaunch = await fastIngestPromiseRef.current;
        } catch {
          // Fall back to selectedPodcast if error
        }
      }
      onLaunchDiscovery(podcastToLaunch);
    }
  }

  function handleClearSelection() {
    setSelectedPodcast(null);
    setQuery("");
    setIngestedResults([]);
    setExternalResults([]);
    setShowDropdown(false);
  }

  if (!isOpen) return null;

  const totalResultsCount = ingestedResults.length + externalResults.length;
  const hasMinChars = query.trim().length >= 2;

  return (
    <div className="relative z-30 w-full max-w-2xl sm:max-w-3xl md:max-w-4xl animate-spring-in">
      {/* Main Search Panel (Slate Navy #354156) */}
      <div className="relative rounded-3xl bg-disco-navy p-5 sm:p-8 md:p-10 shadow-2xl border border-white/10 backdrop-blur-md">
        {/* Top Header inside Modal: Connected X control & Discovery Mode */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-disco-rose animate-pulse" />
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-disco-cream/80">
              Discovery Mode
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-disco-dark/50 text-disco-cream/80 border border-disco-cream/20 shadow transition-all hover:scale-110 hover:text-disco-cream hover:bg-disco-dark hover:border-disco-cream/40 active:scale-95 cursor-pointer"
          >
            <svg
              className="h-3.5 w-3.5 sm:h-4 sm:w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 sm:gap-8 md:gap-10 sm:grid-cols-[1fr_auto] items-start">
          {/* Left: Search input, action button, and categorized results */}
          <div className="space-y-4">
            <h3 className="font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-widest text-disco-cream/90">
              Find me something similar to
            </h3>

            <form onSubmit={handleFormSubmit} className="relative">
              <div className="relative flex items-center border-b-2 border-disco-cream/70 pb-1.5 sm:pb-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (totalResultsCount > 0 && !selectedPodcast) {
                      setShowDropdown(true);
                    }
                  }}
                  placeholder="Show name, host, or topic"
                  autoFocus
                  className="w-full min-w-0 bg-transparent font-['Lato'] text-base sm:text-xl md:text-2xl font-bold text-disco-cream outline-none placeholder:text-xs sm:placeholder:text-base md:placeholder:text-lg placeholder:font-medium placeholder:text-disco-cream/40"
                />

                {/* Clear input button if typed */}
                {query ? (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="mr-2 shrink-0 text-disco-cream/40 hover:text-disco-cream text-lg cursor-pointer leading-none"
                    aria-label="Clear input"
                  >
                    &times;
                  </button>
                ) : null}

                {/* Smart Action Button: "Search" when no selection, "Go" when selected */}
                <button
                  type="submit"
                  aria-label={selectedPodcast ? "Find similar podcasts" : "Search podcasts"}
                  className={`ml-2 sm:ml-3 shrink-0 rounded-full px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider shadow transition-all cursor-pointer ${
                    selectedPodcast
                      ? "bg-disco-rose text-disco-dark hover:scale-105 active:scale-95 ring-2 ring-disco-cream/40 animate-pulse"
                      : "bg-disco-caramel text-disco-dark hover:scale-105 active:scale-95"
                  }`}
                >
                  {isSearching ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-disco-dark animate-ping" />
                      ...
                    </span>
                  ) : selectedPodcast ? (
                    "Go →"
                  ) : (
                    "Search"
                  )}
                </button>
              </div>

              {/* Guidance Prompt if user clicked Search without picking a podcast */}
              {mustPickPrompt && !selectedPodcast ? (
                <div className="mt-2 text-xs font-bold text-disco-caramel animate-slide-up flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Select a podcast below as your similarity starting point:</span>
                </div>
              ) : null}

              {/* Dropdown Results: Ingested shows first, then directory podcasts */}
              {showDropdown && hasMinChars && (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl bg-disco-caramel shadow-2xl border border-disco-caramel/90 animate-slide-up">
                  {isSearching && totalResultsCount === 0 ? (
                    <div className="px-4 py-4 text-center font-['Lato'] text-xs font-bold uppercase tracking-wider text-disco-dark/70">
                      Searching podcast database &amp; directory...
                    </div>
                  ) : totalResultsCount === 0 ? (
                    <div className="px-4 py-4 text-center font-['Lato'] text-xs font-bold text-disco-dark/70">
                      No podcasts found for &ldquo;{query}&rdquo;.
                    </div>
                  ) : (
                    <div className="divide-y divide-disco-dark/15">
                      {/* Section 1: Ingested Podcasts (In DiscoPod) */}
                      {ingestedResults.length > 0 ? (
                        <div>
                          <div className="bg-disco-dark/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-disco-dark/80 flex items-center justify-between">
                            <span>In DiscoPod (Ready to Explore)</span>
                            <span className="rounded-full bg-disco-dark/20 px-1.5 py-0.2 text-[9px]">
                              {ingestedResults.length}
                            </span>
                          </div>
                          {ingestedResults.map((item) => (
                            <button
                              key={`ingested_${item.id}`}
                              type="button"
                              onClick={() => handleSelectPodcast(item)}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-disco-dark/10 cursor-pointer"
                            >
                              <img
                                src={item.coverArtUrl}
                                alt={item.title}
                                className="h-10 w-10 shrink-0 rounded-lg object-cover shadow ring-1 ring-disco-dark/20"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-['Lato'] text-sm font-extrabold text-disco-dark line-clamp-1">
                                    {item.title}
                                  </span>
                                  <span className="shrink-0 rounded bg-disco-dark text-disco-cream px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                    Ready
                                  </span>
                                </div>
                                <p className="text-xs text-disco-dark/75 line-clamp-1">
                                  {item.hostName}
                                </p>
                              </div>
                              <svg
                                className="h-4 w-4 shrink-0 text-disco-dark/40"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.5"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Section 2: External Podcast Directory */}
                      {externalResults.length > 0 ? (
                        <div>
                          <div className="bg-disco-dark/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-disco-dark/80 flex items-center justify-between">
                            <span>
                              {ingestedResults.length > 0 ? "More Podcasts" : "Podcast Directory"}
                            </span>
                            <span className="rounded-full bg-disco-dark/20 px-1.5 py-0.2 text-[9px]">
                              {externalResults.length}
                            </span>
                          </div>
                          {externalResults.map((item) => (
                            <button
                              key={`ext_${item.id}`}
                              type="button"
                              onClick={() => handleSelectPodcast(item)}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-disco-dark/10 cursor-pointer"
                            >
                              <img
                                src={item.coverArtUrl}
                                alt={item.title}
                                className="h-10 w-10 shrink-0 rounded-lg object-cover shadow ring-1 ring-disco-dark/20"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-['Lato'] text-sm font-bold text-disco-dark line-clamp-1">
                                  {item.title}
                                </span>
                                <p className="text-xs text-disco-dark/75 line-clamp-1">
                                  {item.hostName} {item.genre ? `• ${item.genre}` : ""}
                                </p>
                              </div>
                              <svg
                                className="h-4 w-4 shrink-0 text-disco-dark/40"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.5"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Right: Dynamic Preview Square (Empty state hidden on mobile for clean focused search) */}
          {selectedPodcast ? (
            <div className="flex flex-col items-center sm:items-end mt-2 sm:mt-0">
              <div className="relative h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl ring-2 ring-disco-rose/70 group">
                <img
                  src={selectedPodcast.coverArtUrl}
                  alt={selectedPodcast.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-disco-dark/95 via-disco-dark/30 to-transparent flex flex-col justify-end p-2.5 sm:p-3 text-left">
                  <p className="text-xs sm:text-sm font-bold text-disco-cream line-clamp-2">
                    {selectedPodcast.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-disco-cream/70 line-clamp-1 mt-0.5">
                    {selectedPodcast.hostName}
                  </p>
                  {isIngesting ? (
                    <div className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-disco-caramel animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-disco-caramel animate-ping" />
                      <span>Ingesting show...</span>
                    </div>
                  ) : selectedPodcast.isIngested ? (
                    <div className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                      <span>✓ In DiscoPod</span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute top-2 right-2 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-disco-dark/80 text-disco-cream text-xs font-black hover:scale-110 active:scale-95 transition cursor-pointer"
                  title="Deselect podcast"
                >
                  &times;
                </button>
              </div>
              <span className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-disco-cream/50">
                {isIngesting ? (
                  <span className="text-disco-caramel animate-pulse">Syncing...</span>
                ) : (
                  "Starting Point"
                )}
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex flex-col items-center">
              <div className="h-36 w-36 md:h-40 md:w-40 rounded-3xl bg-gradient-to-br from-disco-rose/60 via-disco-rose/40 to-disco-dark/60 p-4 sm:p-5 shadow-xl ring-2 ring-disco-cream/15 flex flex-col justify-end">
                <div className="h-2 w-14 rounded-full bg-disco-cream/50 mb-2" />
                <div className="h-2 w-20 rounded-full bg-disco-cream/25" />
              </div>
              <span className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-disco-cream/40">
                Preview
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
