export type MediaKind = "video" | "image" | "audio";
export type ClipType = MediaKind;
export type TrackType = "video" | "audio";

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
}

export interface Clip {
  id: string;
  type: ClipType;
  mediaId: string;
  name: string;
  /** position on the timeline, in seconds */
  timelineStart: number;
  /** visible length on the timeline, in seconds */
  duration: number;
  /** in-point inside the source media, in seconds */
  sourceStart: number;
  /** out-point inside the source media, in seconds */
  sourceEnd: number;
  transform: Transform;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  tracks: Track[];
  updatedAt: number;
}

/** Media descriptor. Binary data lives in IndexedDB, never in the project JSON. */
export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  thumbnail?: string | undefined;
  createdAt: number;
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  scale: 100,
  opacity: 100,
};

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function clipEnd(clip: Clip): number {
  return clip.timelineStart + clip.duration;
}

export function projectDuration(project: Project): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) end = Math.max(end, clipEnd(clip));
  }
  return end;
}

export function findClip(
  project: Project,
  clipId: string | null,
): { track: Track; clip: Clip } | null {
  if (!clipId) return null;
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}
