import { DiscoballGlobe } from "./DiscoballGlobe";
import type { GlobeShowNode } from "../types";

export type GlobeCanvasProps = {
  nodes: GlobeShowNode[];
  selectedShowId: GlobeShowNode["showId"] | null;
  onSelectShow: (showId: GlobeShowNode["showId"]) => void;
};

export function GlobeCanvas({
  nodes,
  selectedShowId,
  onSelectShow,
}: GlobeCanvasProps) {
  return (
    <div className="h-[24rem] w-full overflow-hidden rounded-2xl border border-white/10 bg-disco-dark/50 shadow-2xl backdrop-blur-sm">
      <DiscoballGlobe
        shows={nodes}
        selectedShowId={selectedShowId}
        onSelectShow={onSelectShow}
        className="h-full w-full"
      />
    </div>
  );
}
