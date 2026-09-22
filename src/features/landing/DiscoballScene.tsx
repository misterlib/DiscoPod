import { DiscoballGlobe } from "../globe/DiscoballGlobe";
import type { GlobeShowNode } from "../types";

export interface DiscoballSceneProps {
  className?: string;
  shows?: GlobeShowNode[];
  selectedShowId?: string | null;
  onSelectShow?: (showId: string) => void;
  interactive?: boolean;
}

export function DiscoballScene({
  className = "",
  shows = [],
  selectedShowId = null,
  onSelectShow,
  interactive = true,
}: DiscoballSceneProps) {
  return (
    <div
      className={`relative select-none ${
        interactive ? "pointer-events-auto" : "pointer-events-none"
      } ${className}`}
    >
      <DiscoballGlobe
        shows={shows}
        selectedShowId={selectedShowId}
        onSelectShow={(showId) => {
          if (onSelectShow) {
            onSelectShow(showId);
          }
        }}
        enableControls={interactive}
        className="h-full w-full"
      />
    </div>
  );
}
