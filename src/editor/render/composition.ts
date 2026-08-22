import { clipEnd, type Clip, type Project, type Track } from "../types";

export interface Layer {
  clip: Clip;
  track: Track;
  /** index for stacking: higher video track index renders on top */
  zIndex: number;
  /** playhead time mapped into the source media */
  sourceTime: number;
  active: boolean;
}

/**
 * Turns the project + playhead time into a flat, ordered list of layers.
 * This is the single compositing entry point — keyframes, effects, filters and
 * text layers can be resolved here later without touching the components.
 */
export function composeLayers(project: Project, time: number): Layer[] {
  const layers: Layer[] = [];
  project.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip) => {
      const active = time >= clip.timelineStart && time < clipEnd(clip);
      layers.push({
        clip,
        track,
        zIndex: trackIndex + 1,
        sourceTime: clip.sourceStart + Math.max(0, time - clip.timelineStart),
        active,
      });
    });
  });
  return layers.sort((a, b) => a.zIndex - b.zIndex);
}

/** Resolves a clip transform into CSS for the fixed-size project stage. */
export function layerStyle(clip: Clip): React.CSSProperties {
  const t = clip.transform;
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${t.width}px`,
    height: `${t.height}px`,
    opacity: t.opacity / 100,
    transform: `translate(-50%, -50%) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scale / 100})`,
    transformOrigin: "center center",
    willChange: "transform, opacity",
  };
}
