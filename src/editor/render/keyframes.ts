import type { AnimatableProperty, Clip, Keyframe, Transform } from "../types";

export const ANIMATABLE: readonly AnimatableProperty[] = [
  "x",
  "y",
  "width",
  "height",
  "scale",
  "rotation",
  "opacity",
  "volume",
] as const;

export const PROPERTY_LABELS: Record<AnimatableProperty, string> = {
  x: "Position X",
  y: "Position Y",
  width: "Width",
  height: "Height",
  scale: "Scale",
  rotation: "Rotation",
  opacity: "Opacity",
  volume: "Volume",
};

/** Time tolerance for "the playhead sits on this keyframe". */
export const KF_EPSILON = 1 / 60;

/** Clip-local time (seconds from the clip's start on the timeline). */
export function localTime(clip: Clip, timelineTime: number): number {
  return timelineTime - clip.timelineStart;
}

export function keyframesFor(clip: Clip, property: AnimatableProperty): Keyframe[] {
  return clip.keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);
}

export function animatedProperties(clip: Clip): AnimatableProperty[] {
  const set = new Set<AnimatableProperty>();
  for (const k of clip.keyframes) set.add(k.property);
  return ANIMATABLE.filter((p) => set.has(p));
}

export function keyframeAt(
  clip: Clip,
  property: AnimatableProperty,
  local: number,
  epsilon = KF_EPSILON,
): Keyframe | undefined {
  return clip.keyframes.find(
    (k) => k.property === property && Math.abs(k.time - local) <= epsilon,
  );
}

function ease(easing: Keyframe["easing"], t: number): number {
  return easing === "hold" ? 0 : t;
}

/** Static (non-animated) value of a property on a clip. */
export function staticValue(clip: Clip, property: AnimatableProperty): number {
  if (property === "volume") return clip.audio.volume;
  return clip.transform[property as keyof Transform];
}

/**
 * Value of `property` at a clip-local time. Falls back to the clip's static
 * value when no keyframes exist. Interpolation is linear; the `easing` field
 * makes room for curves without touching call sites.
 */
export function valueAt(clip: Clip, property: AnimatableProperty, local: number): number {
  const keys = keyframesFor(clip, property);
  if (keys.length === 0) return staticValue(clip, property);
  const first = keys[0]!;
  if (local <= first.time) return first.value;
  const last = keys[keys.length - 1]!;
  if (local >= last.time) return last.value;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (local >= a.time && local <= b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 1 : (local - a.time) / span;
      return a.value + (b.value - a.value) * ease(a.easing, t);
    }
  }
  return last.value;
}

/** Fully resolved transform for a clip at a timeline time. */
export function resolveTransform(clip: Clip, timelineTime: number): Transform {
  const local = localTime(clip, timelineTime);
  const t = clip.transform;
  return {
    x: valueAt(clip, "x", local),
    y: valueAt(clip, "y", local),
    width: valueAt(clip, "width", local),
    height: valueAt(clip, "height", local),
    rotation: valueAt(clip, "rotation", local),
    scale: valueAt(clip, "scale", local),
    opacity: valueAt(clip, "opacity", local),
    ...(t.width === undefined ? {} : {}),
  };
}

/** Effective gain 0..1 including keyframes, fades and mute. */
export function resolveVolume(clip: Clip, timelineTime: number): number {
  if (clip.audio.muted) return 0;
  const local = localTime(clip, timelineTime);
  let gain = valueAt(clip, "volume", local) / 100;
  const { fadeIn, fadeOut } = clip.audio;
  if (fadeIn > 0 && local < fadeIn) gain *= Math.max(0, local / fadeIn);
  const fromEnd = clip.duration - local;
  if (fadeOut > 0 && fromEnd < fadeOut) gain *= Math.max(0, fromEnd / fadeOut);
  return Math.min(1, Math.max(0, gain));
}
