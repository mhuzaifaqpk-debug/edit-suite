import { clipEnd, type Clip, type Project, type Track, type Transform } from "../types";
import { resolveTransform, resolveVolume } from "./keyframes";

export interface Layer {
  clip: Clip;
  track: Track;
  /** index for stacking: video < text < caption */
  zIndex: number;
  /** playhead time mapped into the source media */
  sourceTime: number;
  active: boolean;
  /** keyframe-resolved transform at the current time */
  transform: Transform;
  /** keyframe + fade resolved gain, 0..1 */
  volume: number;
}

/** Render order: media (video/image) → text → captions. */
const TRACK_ORDER: Record<Track["type"], number> = {
  video: 0,
  audio: 0,
  text: 1000,
  caption: 2000,
};

/**
 * Turns the project + playhead time into a flat, ordered list of layers.
 * All time-varying values (keyframes now, effects/filters later) resolve here,
 * so components stay dumb renderers driven by the master clock.
 */
export function composeLayers(project: Project, time: number): Layer[] {
  const layers: Layer[] = [];
  project.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip) => {
      const active = time >= clip.timelineStart && time < clipEnd(clip);
      layers.push({
        clip,
        track,
        zIndex: TRACK_ORDER[track.type] + trackIndex + 1,
        sourceTime: clip.sourceStart + Math.max(0, time - clip.timelineStart),
        active,
        transform: resolveTransform(clip, time),
        volume: resolveVolume(clip, time),
      });
    });
  });
  return layers.sort((a, b) => a.zIndex - b.zIndex);
}

/** Resolves a resolved transform into CSS for the fixed-size project stage. */
export function layerStyle(t: Transform, zIndex = 1): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${t.width}px`,
    height: `${t.height}px`,
    opacity: t.opacity / 100,
    zIndex,
    transform: `translate(-50%, -50%) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scale / 100})`,
    transformOrigin: "center center",
    willChange: "transform, opacity",
  };
}

export function rgba(hex: string, opacityPercent: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full || "000000", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPercent)) / 100})`;
}
