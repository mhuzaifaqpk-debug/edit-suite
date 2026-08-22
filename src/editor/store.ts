import { useSyncExternalStore } from "react";
import { LAST_PROJECT_KEY, projectStore } from "./db";
import {
  DEFAULT_TRANSFORM,
  clipEnd,
  findClip,
  makeId,
  projectDuration,
  type Clip,
  type MediaAsset,
  type Project,
  type Track,
  type Transform,
} from "./types";

export interface EditorState {
  project: Project;
  /** transient (non-undoable) UI/playback state */
  currentTime: number;
  playing: boolean;
  selectedClipId: string | null;
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
      { id: "V1", name: "V1", type: "video", clips: [] },
      { id: "V2", name: "V2", type: "video", clips: [] },
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
  setTransient(patch: Partial<Pick<EditorState, "currentTime" | "playing" | "selectedClipId" | "pixelsPerSecond">>) {
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
      project,
      past: [],
      future: [],
      currentTime: 0,
      playing: false,
      selectedClipId: null,
      dirty: false,
      savedAt: project.updatedAt,
    });
  }

  // ---- clips ----
  addMediaToTimeline(asset: MediaAsset, opts?: { trackId?: string; at?: number }) {
    const trackType = asset.kind === "audio" ? "audio" : "video";
    const track =
      this.state.project.tracks.find((t) => t.id === opts?.trackId && t.type === trackType) ??
      this.state.project.tracks.find((t) => t.type === trackType)!;
    const duration = Math.max(0.1, asset.kind === "image" ? 5 : asset.duration || 5);
    const start =
      opts?.at !== undefined
        ? Math.max(0, opts.at)
        : track.clips.reduce((end, c) => Math.max(end, clipEnd(c)), 0);
    const transform: Transform = {
      ...DEFAULT_TRANSFORM,
      width: asset.width || this.state.project.width,
      height: asset.height || this.state.project.height,
    };
    const clip: Clip = {
      id: makeId("c"),
      type: asset.kind,
      mediaId: asset.id,
      name: asset.name,
      timelineStart: start,
      duration,
      sourceStart: 0,
      sourceEnd: duration,
      transform,
    };
    this.edit((p) => {
      const t = p.tracks.find((x) => x.id === track.id)!;
      t.clips.push(clip);
      t.clips.sort((a, b) => a.timelineStart - b.timelineStart);
    });
    this.set({ selectedClipId: clip.id });
    return clip;
  }

  updateTransform(clipId: string, patch: Partial<Transform>, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      Object.assign(found.clip.transform, patch);
    };
    live ? this.editLive(apply) : this.edit(apply);
  }

  moveClip(clipId: string, timelineStart: number, targetTrackId?: string, live = false) {
    const apply = (p: Project) => {
      const found = findClip(p, clipId);
      if (!found) return;
      const clip = found.clip;
      clip.timelineStart = Math.max(0, timelineStart);
      if (targetTrackId && targetTrackId !== found.track.id) {
        const target = p.tracks.find((t) => t.id === targetTrackId);
        if (target && target.type === (clip.type === "audio" ? "audio" : "video")) {
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
   * media (Infinity for stills), used to clamp the out-point.
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
    if (this.state.selectedClipId === clipId) this.set({ selectedClipId: null });
  }

  select(clipId: string | null) {
    this.set({ selectedClipId: clipId });
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
