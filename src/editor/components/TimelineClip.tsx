import { Film, Image as ImageIcon, Music } from "lucide-react";
import { useRef } from "react";
import { timecode } from "../format";
import { mediaManager } from "../media-manager";
import { editorStore } from "../store";
import type { Clip, Track } from "../types";

const ICONS = { video: Film, image: ImageIcon, audio: Music } as const;

const CLIP_CLASSES: Record<Clip["type"], string> = {
  video: "bg-clip-video text-clip-video-fg",
  image: "bg-clip-image text-clip-image-fg",
  audio: "bg-clip-audio text-clip-audio-fg",
};

type Gesture =
  | { kind: "move"; startX: number; startTime: number; fromTrack: string }
  | { kind: "trim"; edge: "start" | "end" };

export function TimelineClip({
  clip,
  track,
  pixelsPerSecond,
  selected,
}: {
  clip: Clip;
  track: Track;
  pixelsPerSecond: number;
  selected: boolean;
}) {
  const gesture = useRef<Gesture | null>(null);
  const Icon = ICONS[clip.type];
  const asset = mediaManager.getAsset(clip.mediaId);
  const sourceDuration = clip.type === "image" ? Infinity : (asset?.duration ?? Infinity);

  const timeAt = (clientX: number, el: HTMLElement) => {
    const lane = el.closest("[data-lane]") as HTMLElement | null;
    const laneRect = lane?.getBoundingClientRect();
    console.log("TRIM", { clientX, lane: !!lane, left: laneRect?.left, t: laneRect ? (clientX - laneRect.left) / pixelsPerSecond : null });
    return laneRect ? (clientX - laneRect.left) / pixelsPerSecond : 0;
  };

  const startGesture = (e: React.PointerEvent, g: Gesture) => {
    e.stopPropagation();
    editorStore.select(clip.id);
    gesture.current = g;
    editorStore.beginBatch();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const el = e.currentTarget as HTMLElement;
    if (g.kind === "move") {
      const delta = (e.clientX - g.startX) / pixelsPerSecond;
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-track-id]") as HTMLElement | null;
      const targetTrack = target?.dataset["trackId"];
      const targetType = target?.dataset["trackType"];
      const compatible =
        targetTrack && targetType === (clip.type === "audio" ? "audio" : "video")
          ? targetTrack
          : undefined;
      editorStore.moveClip(clip.id, Math.max(0, g.startTime + delta), compatible, true);
    } else {
      editorStore.trimClip(clip.id, g.edge, timeAt(e.clientX, el), sourceDuration, true);
      console.log("AFTER TRIM", sourceDuration, JSON.stringify(editorStore.getState().project.tracks[0]?.clips[0]));
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    editorStore.endBatch();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const width = Math.max(6, clip.duration * pixelsPerSecond);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${clip.name} clip`}
      className={`no-select absolute top-1 bottom-1 overflow-hidden rounded-sm border ${
        CLIP_CLASSES[clip.type]
      } ${selected ? "border-primary ring-1 ring-primary" : "border-black/30"}`}
      style={{ left: clip.timelineStart * pixelsPerSecond, width }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        startGesture(e, {
          kind: "move",
          startX: e.clientX,
          startTime: clip.timelineStart,
          fromTrack: track.id,
        });
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={(e) => {
        if (e.key === "Enter") editorStore.select(clip.id);
      }}
    >
      <div className="flex h-4 items-center gap-1 bg-black/25 px-1 text-[10px] font-medium">
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{clip.name}</span>
        <span className="tc ml-auto shrink-0 opacity-70">{timecode(clip.duration)}</span>
      </div>
      {clip.type !== "audio" && asset?.thumbnail ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 top-4 opacity-40"
          style={{
            backgroundImage: `url(${asset.thumbnail})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
          }}
        />
      ) : null}
      {clip.type === "audio" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 top-5 flex items-end gap-px px-1 opacity-50">
          {Array.from({ length: Math.max(2, Math.floor(width / 4)) }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-current"
              style={{ height: `${28 + Math.abs(Math.sin(i * 0.7) * 60)}%` }}
            />
          ))}
        </div>
      ) : null}

      <div
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/40 hover:bg-primary"
        onPointerDown={(e) => startGesture(e, { kind: "trim", edge: "start" })}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      />
      <div
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/40 hover:bg-primary"
        onPointerDown={(e) => startGesture(e, { kind: "trim", edge: "end" })}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      />
    </div>
  );
}
