import { mediaManager } from "../media-manager";
import { editorStore } from "../store";
import type { Track } from "../types";
import { TimelineClip } from "./TimelineClip";

export const TRACK_HEIGHT = 56;

export function TimelineTrack({
  track,
  pixelsPerSecond,
  selectedClipId,
  contentWidth,
}: {
  track: Track;
  pixelsPerSecond: number;
  selectedClipId: string | null;
  contentWidth: number;
}) {
  return (
    <div
      data-track-id={track.id}
      data-track-type={track.type}
      data-lane
      className="relative border-b border-border bg-track odd:bg-track-alt"
      style={{ height: TRACK_HEIGHT, width: contentWidth }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-reelforge-media")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("application/x-reelforge-media");
        const asset = id ? mediaManager.getAsset(id) : undefined;
        if (!asset) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const at = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
        const trackType = asset.kind === "audio" ? "audio" : "video";
        editorStore.addMediaToTimeline(asset, {
          trackId: track.type === trackType ? track.id : undefined,
          at,
        });
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) editorStore.select(null);
      }}
    >
      {track.clips.map((clip) => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          track={track}
          pixelsPerSecond={pixelsPerSecond}
          selected={clip.id === selectedClipId}
        />
      ))}
    </div>
  );
}
