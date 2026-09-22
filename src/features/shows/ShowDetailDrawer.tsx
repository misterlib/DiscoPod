import { Link } from "react-router-dom";
import type { GlobeShowNode } from "../types";

type ShowDetailDrawerProps = {
  show: GlobeShowNode | null;
  detail: {
    description: string;
    topSnippets: Array<{
      snippetId: string;
      hookText: string;
    }>;
    latestEpisodes: Array<{
      episodeId: string;
      title: string;
    }>;
  } | null;
};

export function ShowDetailDrawer({ show, detail }: ShowDetailDrawerProps) {
  return (
    <aside className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="text-lg font-semibold">Show detail</h2>
      {!show ? (
        <p className="mt-3 text-sm text-slate-400">
          Select a globe node to inspect show details and clips.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-semibold">{show.title}</p>
          <p className="text-slate-300">Creator: {show.hostName || "Host"}</p>
          <p className="text-slate-300">
            Status: {show.isClaimed ? "✓ Verified Creator" : "Active Show"}
          </p>
          <img
            src={show.coverArtUrl}
            alt={`${show.title} cover art`}
            className="h-24 w-24 rounded-md object-cover"
          />
          {detail ? (
            <>
              <p className="pt-2 text-xs text-slate-400">{detail.description}</p>
              <p className="pt-2 text-xs uppercase tracking-widest text-slate-500">
                Top snippets
              </p>
              <ul className="space-y-1 text-xs text-slate-300">
                {detail.topSnippets.slice(0, 3).map((snippet) => (
                  <li key={snippet.snippetId}>{snippet.hookText}</li>
                ))}
              </ul>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <Link
                  to="/admin"
                  className="font-bold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                >
                  Admin Page &rarr;
                </Link>
              </div>
            </>
          ) : null}
        </div>
      )}
    </aside>
  );
}
