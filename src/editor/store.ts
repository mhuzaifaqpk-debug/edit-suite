import { useSyncExternalStore } from "react";
import { LAST_PROJECT_KEY, projectStore } from "./db";
import { keyframeAt, keyframesFor, staticValue, valueAt } from "./render/keyframes";
import {
  DEFAULT_AUDIO,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  clipEnd,
  findClip,
  isTextual,
  makeId,
  normalizeProject,
  projectDuration,
  trackTypeFor,
  type AnimatableProperty,
  type AudioProperties,
  type Clip,
  type Keyframe,
  type MediaAsset,
  type Project,
  type TextStyle,
  type Track,
  type Transform,
} from "./types";

export interface EditorState {
  project: Project;
  /** transient (non-undoable) UI/playback state */
  currentTime: number;
  playing: boolean;
  selectedClipId: string | null;
  /** selected keyframe ids (transient) */
  selectedKeyframeIds: string[];
  clipboardKeyframes: Keyframe[];
  /** pixels per second on the timeline */
  pixelsPerSecond: number;
  past: Project[];
  future: Project[];
  savedAt: number | null;
  dirty: boolean;
}

function emptyProject(): Project {
  return {
    id: makeId("p"),
    name: "Untitled Project",
    width: 1920,
    height: 1080,
    tracks: [
      { id: "V2", name: "V2", type: "video", clips: [] },
      { id: "V1", name: "V1", type: "video", clips: [] },
      { id: "T1", name: "TEXT", type: "text", clips: [] },
      { id: "C1", name: "CAPTION", type: "caption", clips: [] },
      { id: "A1", name: "A1", type: "audio", clips: [] },
    ],
    updatedAt: Date.now(),
  };
}

const MAX_HISTORY = 100;

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

class EditorStore {
  private state: EditorState = {
    project: emptyProject(),
    currentTime: 0,
    playing: false,
    selectedClipId: null,
    selectedKeyframeIds: [],
    clipboardKeyframes: [],
    pixelsPerSecond: 60,
    past: [],
    future: [],
    savedAt: null,
    dirty: false,
  };
  private listeners = new Set<() => void>();
  private batchSnapshot: Project | null = null;

  getState = (): EditorState => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<EditorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Non-undoable transient update. */
  setTransient(
    patch: Partial<
      Pick<EditorState, "currentTime" | "playing" | "selectedClipId" | "pixelsPerSecond">
    >,
  ) {
    this.set(patch);
  }

  /** Mutate the project and push an undo entry. */
  edit(recipe: (project: Project) => void) {
    const before = this.state.project;
    const next = clone(before);
    recipe(next);
    next.updatedAt = Date.now();
    this.set({
      project: next,
      past: [...this.state.past.slice(-MAX_HISTORY + 1), before],
      future: [],
      dirty: true,
    });
  }

  /**
   * Mutate the project without an undo entry. Used during drags; wrap the whole
   * gesture in beginBatch()/endBatch() so undo restores the pre-gesture state.
   */
  editLive(recipe: (project: Project) => void) {
    const next = clone(this.state.project);
    recipe(next);
    next.updatedAt = Date.now();
    this.set({ project: next, dirty: true });
  }

  beginBatch() {
    if (!this.batchSnapshot) this.batchSnapshot = this.state.project;
  }

  endBatch() {
    const snapshot = this.batchSnapshot;
    this.batchSnapshot = null;
    if (!snapshot || snapshot === this.state.project) return;
    this.set({
      past: [...this.state.past.slice(-MAX_HISTORY + 1), snapshot],
      future: [],
    });
  }

  undo() {
    const prev = this.state.past.at(-1);
    if (!prev) return;
    this.set({
      project: prev,
      past: this.state.past.slice(0, -1),
      future: [this.state.project, ...this.state.future],
      dirty: true,
      selectedClipId: findClip(prev, this.state.selectedClipId) ? this.state.selectedClipId : null,
    });
  }

  redo() {
    const next = this.state.future[0];
    if (!next) return;
    this.set({
      project: next,
      past: [...this.state.past, this.state.project],
      future: this.state.future.slice(1),
      dirty: true,
      selectedClipId: findClip(next, this.state.selectedClipId) ? this.state.selectedClipId : null,
    });
  }

  // ---- project level ----
  renameProject(name: string) {
    this.edit((p) => {
      p.name = name;
    });
  }

  async save() {
    await projectStore.save(clone(this.state.project));
    try {
      localStorage.setItem(LAST_PROJECT_KEY, this.state.project.id);
    } catch {
      /* ignore */
    }
    this.set({ savedAt: Date.now(), dirty: false });
  }

  loadProject(project: Project) {
    this.set({
      project: normalizeProject(project),
      past: [],
      future: [],
      currentTime: 0,
      playing: false,
      selectedClipId: null,
      selectedKeyframeIds: [],
      dirty: false,
      savedAt: project.updatedAt,
    });
  }

  // ---- clips ----
  private trackFor(type: Clip["type"], preferredId?: string | undefined): Track {
    const trackType = trackTypeFor(type);
    return (
      this.state.project.tracks.find((t) => t.id === preferredId && t.type === trackType) ??
      this.state.project.tracks.find((t) => t.type === trackType)!
    );
  }

  private appendEnd(track: Track): number {
    return track.clips.reduce((end, c) => Math.max(end, clipEnd(c)), 0);
  }

  private insert(clip: Clip, trackId: string) {
    this.edit((p) => {
      const t = p.tracks.find((x) => x.id === trackId)!;
      t.clips.push(clip);
      t.clips.sort((a, b) => a.timelineStart - b.timelineStart);
    });
    this.set({ selectedClipId: clip.id, selectedKeyframeIds: [] });
  }

  addMediaToTimeline(
    asset: MediaAsset,
    opts?: { trackId?: string | undefined; at?: number | undefined },
  ) {
    const track = this.trackFor(asset.kind, opts?.trackId);
    const duration = Math.max(0.1, asset.kind === "image" ? 5 : asset.duration || 5);
    const start = opts?.at !== undefined ? Math.max(0, opts.at) : this.appendEnd(track);
    const clip: Clip = {
      id: makeId("c"),
      type: asset.kind,
      mediaId: asset.id,
      name: asset.name,
      timelineStart: start,
      duration,
      sourceStart: 0,
      sourceEnd: duration,
      transform: {
        ...DEFAULT_TRANSFORM,
        width: asset.width || this.state.project.width,
        height: asset.height || this.state.project.height,
      },
      keyframes: [],
      audio: { ...DEFAULT_AUDIO },
    };
    this.insert(clip, track.id);
    return clip;
  }

  /** Creates a text or caption clip. Both use the same clip/transform/keyframe model. */
  addTextClip(
    kind: "text" | "caption",
    opts?: { text?: string; at?: number | undefined; duration?: number; trackId?: string },
  ) {
    const track = this.trackFor(kind, opts?.trackId);
    const project = this.state.project;
    const duration = Math.max(0.2, opts?.duration ?? 3);
    const at = opts?.at ?? this.state.currentTime;
    const text = opts?.text ?? (kind === "caption" ? "New caption" : "Your text here");
    const style: TextStyle = { ...(kind === "caption" ? DEFAULT_CAPTION_STYLE : DEFAULT_TEXT_STYLE) };
    const clip: Clip = {
      id: makeId(kind === "caption" ? "cap" : "txt"),
      type: kind,
      mediaId: "",
      name: text.slice(0, 24) || kind,
      timelineStart: Math.max(0, at),
      duration,
      sourceStart: 0,
      sourceEnd: duration,
      transform: {
        ...DEFAULT_TRANSFORM,
        width: Math.round(project.width * 0.8),
        height: Math.round(style.fontSize * 1.6),
        y: kind === "caption" ? Math.round(project.height * 0.35) : 0,
      },
      keyframes: [],
      audio: { ...DEFAULT_AUDIO },
      text,
      style,
    };
    this.insert(clip, track.id);
    return clip;
  }

  updateText(clipId: string, text: string) {
    this.edit((p) => {
      const found = findClip(p, clipId);
      if (!found || !isTextual(found.clip)) return;
      found.clip.text = text;
      found.clip.name = text.slice(0, 24) || found.clip.type;
    });
  }

  updateStyle(clipId: string, patch: Partial<TextStyle>, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found?.clip.style) return;
      Object.assign(found.clip.style, patch);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  updateAudio(clipId: string, patch: Partial<AudioProperties>, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      Object.assign(found.clip.audio, patch);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  /** Sets absolute start/end on the timeline (used by caption in/out fields). */
  setClipRange(clipId: string, start: number, end: number, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const s = Math.max(0, start);
      const e = Math.max(s + 0.1, end);
      found.clip.timelineStart = s;
      found.clip.duration = e - s;
      found.clip.sourceEnd = found.clip.sourceStart + found.clip.duration;
      for (const t of p.tracks) t.clips.sort((a, b) => a.timelineStart - b.timelineStart);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  updateTransform(clipId: string, patch: Partial<Transform>, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      Object.assign(found.clip.transform, patch);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  /**
   * Writes an animatable property. If the property already has keyframes the
   * value is written into (or created as) a keyframe at the playhead, so
   * editing a value never silently breaks an existing animation.
   */
  setAnimatable(clipId: string, property: AnimatableProperty, value: number, live = false) {
    const time = this.state.currentTime;
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const clip = found.clip;
      if (keyframesFor(clip, property).length > 0) {
        const local = time - clip.timelineStart;
        const existing = keyframeAt(clip, property, local);
        if (existing) existing.value = value;
        else
          clip.keyframes.push({
            id: makeId("k"),
            property,
            time: local,
            value,
            easing: "linear",
          });
        clip.keyframes.sort((a, b) => a.time - b.time);
        return;
      }
      if (property === "volume") clip.audio.volume = value;
      else clip.transform[property as keyof Transform] = value;
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  // ---- keyframes ----
  /** Adds a keyframe at the playhead, or removes the one already there. */
  toggleKeyframe(clipId: string, property: AnimatableProperty) {
    const found = findClip(this.state.project, clipId);
    if (!found) return;
    const local = this.state.currentTime - found.clip.timelineStart;
    const existing = keyframeAt(found.clip, property, local);
    if (existing) {
      this.deleteKeyframe(clipId, existing.id);
      return;
    }
    const value = valueAt(found.clip, property, local);
    const id = makeId("k");
    this.edit((p) => {
      const target = findClip(p, clipId);
      if (!target) return;
      target.clip.keyframes.push({ id, property, time: local, value, easing: "linear" });
      target.clip.keyframes.sort((a, b) => a.time - b.time);
    });
    this.set({ selectedKeyframeIds: [id] });
  }

  deleteKeyframe(clipId: string, keyframeId: string) {
    this.edit((p) => {
      const found = findClip(p, clipId);
      if (!found) return;
      found.clip.keyframes = found.clip.keyframes.filter((k) => k.id !== keyframeId);
    });
    this.set({
      selectedKeyframeIds: this.state.selectedKeyframeIds.filter((id) => id !== keyframeId),
    });
  }

  deleteSelectedKeyframes() {
    const ids = new Set(this.state.selectedKeyframeIds);
    if (ids.size === 0) return;
    this.edit((p) => {
      for (const t of p.tracks)
        for (const c of t.clips) c.keyframes = c.keyframes.filter((k) => !ids.has(k.id));
    });
    this.set({ selectedKeyframeIds: [] });
  }

  selectKeyframe(keyframeId: string | null, additive = false) {
    if (!keyframeId) return this.set({ selectedKeyframeIds: [] });
    const current = this.state.selectedKeyframeIds;
    if (!additive) return this.set({ selectedKeyframeIds: [keyframeId] });
    this.set({
      selectedKeyframeIds: current.includes(keyframeId)
        ? current.filter((id) => id !== keyframeId)
        : [...current, keyframeId],
    });
  }

  /** Moves every selected keyframe by `deltaSeconds` (drag on the timeline). */
  nudgeSelectedKeyframes(deltaSeconds: number, live = true) {
    const ids = new Set(this.state.selectedKeyframeIds);
    if (ids.size === 0) return;
    const apply = (p: Project) => {
      for (const t of p.tracks)
        for (const c of t.clips) {
          let changed = false;
          for (const k of c.keyframes)
            if (ids.has(k.id)) {
              k.time = Math.max(0, Math.min(c.duration, k.time + deltaSeconds));
              changed = true;
            }
          if (changed) c.keyframes.sort((a, b) => a.time - b.time);
        }
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  setKeyframeTime(clipId: string, keyframeId: string, localTime: number, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const k = found.clip.keyframes.find((x) => x.id === keyframeId);
      if (!k) return;
      k.time = Math.max(0, Math.min(found.clip.duration, localTime));
      found.clip.keyframes.sort((a, b) => a.time - b.time);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  setKeyframeValue(clipId: string, keyframeId: string, value: number, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const k = found.clip.keyframes.find((x) => x.id === keyframeId);
      if (k) k.value = value;
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  copySelectedKeyframes() {
    const ids = new Set(this.state.selectedKeyframeIds);
    const copied: Keyframe[] = [];
    for (const t of this.state.project.tracks)
      for (const c of t.clips) for (const k of c.keyframes) if (ids.has(k.id)) copied.push({ ...k });
    if (copied.length) this.set({ clipboardKeyframes: copied });
    return copied.length;
  }

  /** Pastes clipboard keyframes onto the selected clip at the playhead. */
  pasteKeyframes(clipId = this.state.selectedClipId) {
    const clips = this.state.clipboardKeyframes;
    if (!clipId || clips.length === 0) return 0;
    const found = findClip(this.state.project, clipId);
    if (!found) return 0;
    const base = Math.min(...clips.map((k) => k.time));
    const local = this.state.currentTime - found.clip.timelineStart;
    const created: Keyframe[] = clips.map((k) => ({
      ...k,
      id: makeId("k"),
      time: Math.max(0, local + (k.time - base)),
    }));
    this.edit((p) => {
      const target = findClip(p, clipId);
      if (!target) return;
      for (const k of created) {
        const dup = keyframeAt(target.clip, k.property, k.time);
        if (dup) dup.value = k.value;
        else target.clip.keyframes.push(k);
      }
      target.clip.keyframes.sort((a, b) => a.time - b.time);
    });
    this.set({ selectedKeyframeIds: created.map((k) => k.id) });
    return created.length;
  }

  /** Duplicates the selected keyframes 1s later on the same clip. */
  duplicateSelectedKeyframes(offset = 1) {
    const ids = new Set(this.state.selectedKeyframeIds);
    if (ids.size === 0) return 0;
    const created: string[] = [];
    this.edit((p) => {
      for (const t of p.tracks)
        for (const c of t.clips) {
          const dupes = c.keyframes
            .filter((k) => ids.has(k.id))
            .map((k) => {
              const id = makeId("k");
              created.push(id);
              return {
                ...k,
                id,
                time: Math.max(0, Math.min(c.duration, k.time + offset)),
              };
            });
          if (dupes.length) {
            c.keyframes.push(...dupes);
            c.keyframes.sort((a, b) => a.time - b.time);
          }
        }
    });
    this.set({ selectedKeyframeIds: created });
    return created.length;
  }

  /** Reads a property's current value at the playhead (keyframe-aware). */
  currentValue(clipId: string, property: AnimatableProperty): number {
    const found = findClip(this.state.project, clipId);
    if (!found) return 0;
    if (found.clip.keyframes.some((k) => k.property === property))
      return valueAt(found.clip, property, this.state.currentTime - found.clip.timelineStart);
    return staticValue(found.clip, property);
  }

  moveClip(clipId: string, timelineStart: number, targetTrackId?: string, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const clip = found.clip;
      clip.timelineStart = Math.max(0, timelineStart);
      if (targetTrackId && targetTrackId !== found.track.id) {
        const target = p.tracks.find((t) => t.id === targetTrackId);
        if (target && target.type === trackTypeFor(clip.type)) {
          found.track.clips = found.track.clips.filter((c) => c.id !== clipId);
          target.clips.push(clip);
        }
      }
      for (const t of p.tracks) t.clips.sort((a, b) => a.timelineStart - b.timelineStart);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  /**
   * Trim one edge of a clip. `sourceDuration` is the full length of the source
   * media (Infinity for stills/text), used to clamp the out-point.
   */
  trimClip(
    clipId: string,
    edge: "start" | "end",
    timelinePosition: number,
    sourceDuration = Infinity,
    live = false,
  ) {
    const MIN = 0.1;
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const clip = found.clip;
      if (edge === "start") {
        const lowerBound = Math.max(0, clip.timelineStart - clip.sourceStart);
        const upperBound = clip.timelineStart + clip.duration - MIN;
        const pos = Math.min(upperBound, Math.max(lowerBound, timelinePosition));
        const delta = pos - clip.timelineStart;
        clip.timelineStart = pos;
        clip.duration -= delta;
        clip.sourceStart += delta;
        clip.sourceEnd = clip.sourceStart + clip.duration;
        for (const k of clip.keyframes) k.time = Math.max(0, k.time - delta);
      } else {
        const maxEnd = clip.timelineStart + (sourceDuration - clip.sourceStart);
        const pos = Math.max(clip.timelineStart + MIN, Math.min(timelinePosition, maxEnd));
        clip.duration = pos - clip.timelineStart;
        clip.sourceEnd = clip.sourceStart + clip.duration;
      }
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  deleteClip(clipId: string) {
    this.edit((p) => {
      for (const t of p.tracks) t.clips = t.clips.filter((c) => c.id !== clipId);
    });
    if (this.state.selectedClipId === clipId)
      this.set({ selectedClipId: null, selectedKeyframeIds: [] });
  }

  select(clipId: string | null) {
    this.set({ selectedClipId: clipId, selectedKeyframeIds: [] });
  }

  seek(time: number) {
    const max = Math.max(projectDuration(this.state.project), 0);
    this.set({ currentTime: Math.min(Math.max(0, time), Math.max(max, 0)) });
  }

  setPlaying(playing: boolean) {
    this.set({ playing });
  }

  togglePlay() {
    this.set({ playing: !this.state.playing });
  }

  setZoom(pps: number) {
    this.set({ pixelsPerSecond: Math.min(400, Math.max(10, pps)) });
  }
}

export const editorStore = new EditorStore();

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useSyncExternalStore(
    editorStore.subscribe,
    () => selector(editorStore.getState()),
    () => selector(editorStore.getState()),
  );
}

export function useProject(): Project {
  return useEditor((s) => s.project);
}

export type { Track };
