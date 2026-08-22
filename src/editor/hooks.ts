import { useEffect, useSyncExternalStore } from "react";
import { mediaManager } from "./media-manager";
import { editorStore } from "./store";
import { findClip, projectDuration, type MediaAsset } from "./types";

export function useMediaLibrary(): MediaAsset[] {
  return useSyncExternalStore(
    mediaManager.subscribe,
    mediaManager.getAssets,
    mediaManager.getAssets,
  );
}

/** Drives the playhead while playing. */
export function usePlaybackClock(playing: boolean) {
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const state = editorStore.getState();
      const total = projectDuration(state.project);
      const next = state.currentTime + dt;
      if (total <= 0 || next >= total) {
        editorStore.seek(total);
        editorStore.setPlaying(false);
        return;
      }
      editorStore.seek(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useKeyboardShortcuts(onSave: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const state = editorStore.getState();

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? editorStore.redo() : editorStore.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editorStore.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
        return;
      }
      if (mod) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          editorStore.togglePlay();
          break;
        case "Delete":
        case "Backspace":
          if (state.selectedClipId && findClip(state.project, state.selectedClipId)) {
            e.preventDefault();
            editorStore.deleteClip(state.selectedClipId);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          editorStore.seek(state.currentTime - (e.shiftKey ? 1 : 1 / 30));
          break;
        case "ArrowRight":
          e.preventDefault();
          editorStore.seek(state.currentTime + (e.shiftKey ? 1 : 1 / 30));
          break;
        case "Home":
          e.preventDefault();
          editorStore.seek(0);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);
}
