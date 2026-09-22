import type { SnippetResult } from "../types";

type SnippetSearchPanelProps = {
  feedQuery: string;
  semanticQuery: string;
  onFeedQueryChange: (value: string) => void;
  onSemanticQueryChange: (value: string) => void;
  onRunSemanticSearch: () => Promise<void>;
  onClearSemantic: () => void;
  semanticMode: boolean;
  semanticLoading: boolean;
  semanticError: string | null;
  snippets: SnippetResult[];
  onPickSnippet: (snippet: SnippetResult) => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
};

export function SnippetSearchPanel({
  feedQuery,
  semanticQuery,
  onFeedQueryChange,
  onSemanticQueryChange,
  onRunSemanticSearch,
  onClearSemantic,
  semanticMode,
  semanticLoading,
  semanticError,
  snippets,
  onPickSnippet,
  canLoadMore,
  onLoadMore,
}: SnippetSearchPanelProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold">Semantic snippets</h2>
      <input
        className="mt-3 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
        placeholder="Filter current feed"
        value={feedQuery}
        onChange={(event) => onFeedQueryChange(event.target.value)}
      />
      <input
        className="mt-2 w-full rounded-md border border-cyan-400/30 bg-black/30 px-3 py-2 text-sm"
        placeholder="Semantic query (OpenAI embedding)"
        value={semanticQuery}
        onChange={(event) => onSemanticQueryChange(event.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-cyan-500 px-3 py-1 text-xs font-medium text-slate-900 disabled:opacity-50"
          disabled={semanticLoading || !semanticQuery.trim()}
          onClick={() => {
            void onRunSemanticSearch();
          }}
        >
          {semanticLoading ? "Running..." : "Run semantic search"}
        </button>
        {semanticMode ? (
          <button
            type="button"
            className="rounded border border-white/20 px-3 py-1 text-xs"
            onClick={onClearSemantic}
          >
            Back to feed
          </button>
        ) : null}
      </div>
      {semanticError ? <p className="mt-2 text-xs text-rose-300">{semanticError}</p> : null}
      <ul className="mt-3 space-y-3">
        {snippets.map((snippet) => (
          <li
            key={snippet.snippetId}
            className="rounded-md border border-white/10 bg-black/25 p-3"
          >
            <p className="text-sm font-semibold">{snippet.hookText}</p>
            <p className="mt-1 text-xs text-slate-300">{snippet.showTitle}</p>
            <button
              type="button"
              className="mt-2 rounded bg-cyan-500 px-3 py-1 text-xs font-medium text-slate-900"
              onClick={() => onPickSnippet(snippet)}
            >
              Play {formatTimestamp(snippet.startTime)}
            </button>
          </li>
        ))}
      </ul>
      {snippets.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          No snippets yet. Try ingesting a show or run the demo seed flow.
        </p>
      ) : null}
      {!semanticMode && canLoadMore ? (
        <button
          type="button"
          className="mt-3 rounded border border-white/20 px-3 py-1 text-xs"
          onClick={onLoadMore}
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
