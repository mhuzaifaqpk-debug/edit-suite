import { editorStore } from "./store";
import { clipEnd, findClip, makeId, type Clip } from "./types";

export const PHASE7_MARKERS_KEY = "reelforge.timeline.markers";

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
}

export function loadMarkers(): TimelineMarker[] {
  try {
    const raw = localStorage.getItem(PHASE7_MARKERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TimelineMarker[];
    return Array.isArray(parsed) ? parsed.filter((m) => Number.isFinite(m.time)) : [];
  } catch {
    return [];
  }
}

export function saveMarkers(markers: TimelineMarker[]) {
  try {
    localStorage.setItem(PHASE7_MARKERS_KEY, JSON.stringify(markers));
  } catch {
    /* localStorage may be unavailable */
  }
}

export function addMarker(time: number, name = "Marker") {
  const markers = loadMarkers();
  const marker: TimelineMarker = { id: makeId("m"), time: Math.max(0, time), name };
  saveMarkers([...markers, marker].sort((a, b) => a.time - b.time));
  return marker;
}

export function removeMarker(id: string) {
  saveMarkers(loadMarkers().filter((marker) => marker.id !== id));
}

export function snapTime(time: number, threshold = 0.12): number {
  const state = editorStore.getState();
  const candidates = [0, state.currentTime, ...loadMarkers().map((m) => m.time)];
  for (const track of state.project.tracks) {
    for (const clip of track.clips) {
      candidates.push(clip.timelineStart, clipEnd(clip));
    }
  }
  let closest = time;
  let distance = threshold;
  for (const candidate of candidates) {
    const d = Math.abs(candidate - time);
    if (d < distance) {
      distance = d;
      closest = candidate;
    }
  }
  return Math.max(0, closest);
}

export function splitSelectedClip(at?: number) {
  const state = editorStore.getState();
  const clipId = state.selectedClipId;
  if (!clipId) return false;
  const found = findClip(state.project, clipId);
  if (!found) return false;
  const clip = found.clip;
  const time = at ?? state.currentTime;
  if (time <= clip.timelineStart + 0.1 || time >= clipEnd(clip) - 0.1) return false;

  const leftDuration = time - clip.timelineStart;
  const rightDuration = clip.duration - leftDuration;
  const right: Clip = structuredClone(clip);
  right.id = makeId("c");
  right.timelineStart = time;
  right.duration = rightDuration;
  right.sourceStart = clip.sourceStart + leftDuration;
  right.sourceEnd = right.sourceStart + rightDuration;
  right.keyframes = right.keyframes
    .filter((k) => k.time >= leftDuration)
    .map((k) => ({ ...k, id: makeId("k"), time: k.time - leftDuration }));

  editorStore.edit((project) => {
    const target = findClip(project, clipId);
    if (!target) return;
    target.clip.duration = leftDuration;
    target.clip.sourceEnd = target.clip.sourceStart + leftDuration;
    target.clip.keyframes = target.clip.keyframes.filter((k) => k.time <= leftDuration);
    target.track.clips.push(right);
    target.track.clips.sort((a, b) => a.timelineStart - b.timelineStart);
  });
  editorStore.select(right.id);
  return true;
}

export function duplicateSelectedClip() {
  const state = editorStore.getState();
  const clipId = state.selectedClipId;
  if (!clipId) return false;
  const found = findClip(state.project, clipId);
  if (!found) return false;
  const duplicate: Clip = structuredClone(found.clip);
  duplicate.id = makeId("c");
  duplicate.timelineStart = clipEnd(found.clip);
  duplicate.keyframes = duplicate.keyframes.map((k) => ({ ...k, id: makeId("k") }));
  editorStore.edit((project) => {
    const target = project.tracks.find((t) => t.id === found.track.id);
    if (!target) return;
    target.clips.push(duplicate);
    target.clips.sort((a, b) => a.timelineStart - b.timelineStart);
  });
  editorStore.select(duplicate.id);
  return true;
}
