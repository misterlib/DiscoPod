/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { X, Search, Sparkles, CheckCircle2, AlertCircle, Loader2, Radio, Disc3, ArrowRight } from "lucide-react";
import { api } from "../../convexApi";
import type { Id } from "../../../convex/_generated/dataModel";

interface MapShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowMapped?: (showId: string) => void;
}

export function MapShowModal({ isOpen, onClose, onShowMapped }: MapShowModalProps) {
  const [query, setQuery] = useState("");
  const [activeJobId, setActiveJobId] = useState<Id<"ingestJobs"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startIngest = useAction(api.ingest.startIngest);
  const ingestJob = useQuery(
    api.ingest.getIngestJob,
    activeJobId ? { jobId: activeJobId } : "skip",
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isUrl = query.startsWith("http://") || query.startsWith("https://");
      const sourceType = isUrl
        ? query.includes("podcasts.apple.com")
          ? "apple"
          : "rss"
        : "title";

      const res = await startIngest({
        sourceType,
        sourceValue: query.trim(),
      });
      setActiveJobId(res.jobId);
    } catch (err: unknown) {
      console.error("Failed to start ingest:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to start show ingestion");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActiveJobId(null);
    setQuery("");
    setSubmitError(null);
  };

  const steps = [
    { key: "scraping_rss", label: "Scraping RSS", desc: "Resolving feed, media enclosures & contact info" },
    { key: "slicing_hook", label: "Slicing Hook", desc: "GPT-4o narrative hook detection (30–60s window)" },
    { key: "indexing_vector", label: "Indexing Vector", desc: "text-embedding-3-small 1536-dim coordinates" },
    { key: "completed", label: "Mapped", desc: "Ready for Disco Globe playback & AgentMail claim" },
  ];

  const getStepStatus = (stepKey: string) => {
    if (!ingestJob) return "waiting";
    if (ingestJob.status === "failed") return "failed";
    if (ingestJob.status === "completed") return "done";

    const stepOrder = ["pending", "scraping_rss", "slicing_hook", "indexing_vector", "completed"];
    const currentIndex = stepOrder.indexOf(ingestJob.status);
    const targetIndex = stepOrder.indexOf(stepKey);

    if (currentIndex > targetIndex) return "done";
    if (currentIndex === targetIndex) return "active";
    return "waiting";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-indigo-500/30 bg-gray-950/95 p-6 shadow-2xl shadow-indigo-500/10 text-white">
        {/* Glow Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
              <Disc3 className="w-5 h-5 animate-spin duration-3000" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Map a Podcast Feed
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Pipeline
                </span>
              </h2>
              <p className="text-xs text-gray-400">Stream multi-stage extraction and narrative hook detection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ingest Form */}
        {!activeJobId ? (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Show Title, Apple Podcast URL, or RSS Feed
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Acquired, All-In, or https://feeds.transistor.fm/..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Firecrawl Extraction + GPT-4o Hook + text-embedding-3-small
              </span>
              <button
                type="submit"
                disabled={!query.trim() || isSubmitting}
                className="px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Ingest
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Multi-Stage Real-Time Pipeline Visualizer */
          <div className="mt-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                <span className="text-sm font-medium text-gray-200 truncate">{query}</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                {ingestJob?.status || "pending"}
              </span>
            </div>

            {/* Steps Progress */}
            <div className="space-y-3">
              {steps.map((step, idx) => {
                const status = getStepStatus(step.key);
                return (
                  <div
                    key={step.key}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                      status === "active"
                        ? "bg-indigo-500/10 border border-indigo-500/30"
                        : status === "done"
                        ? "bg-emerald-500/5 border border-emerald-500/20"
                        : "bg-white/[0.02] border border-white/5 opacity-60"
                    }`}
                  >
                    <div className="mt-0.5">
                      {status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : status === "active" ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[10px] text-gray-500">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-semibold ${
                            status === "active"
                              ? "text-indigo-300"
                              : status === "done"
                              ? "text-emerald-300"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </h4>
                        {status === "active" && (
                          <span className="text-[10px] font-mono text-indigo-400 animate-pulse">Running</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Step Output / Status */}
            {ingestJob && (
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs font-mono text-gray-400">
                <span className="text-gray-500">&gt; </span>
                {ingestJob.stepDescription}
              </div>
            )}

            {ingestJob?.error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {ingestJob.error}
              </div>
            )}

            {/* Finished actions */}
            {ingestJob?.status === "completed" && (
              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Map Another Show
                </button>
                <button
                  onClick={() => {
                    if (ingestJob.showId && onShowMapped) {
                      onShowMapped(ingestJob.showId);
                    }
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  View on Disco Globe
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {ingestJob?.status === "failed" && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
