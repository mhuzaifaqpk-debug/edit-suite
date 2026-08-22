import { mediaStore } from "./db";
import { makeId, type MediaAsset, type MediaKind } from "./types";

/**
 * MediaManager owns binary media: persistence (IndexedDB) and object URLs.
 * The project model only ever references media by id, so media storage can be
 * swapped for a remote/asset-server implementation later.
 */
class MediaManager {
  private urls = new Map<string, string>();
  private assets = new Map<string, MediaAsset>();
  private listeners = new Set<() => void>();
  private snapshot: MediaAsset[] = [];
  private hydrated = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getAssets = (): MediaAsset[] => this.snapshot;

  private emit() {
    this.snapshot = [...this.assets.values()].sort((a, b) => a.createdAt - b.createdAt);
    this.listeners.forEach((l) => l());
  }

  getAsset(id: string): MediaAsset | undefined {
    return this.assets.get(id);
  }

  getUrl(id: string): string | undefined {
    return this.urls.get(id);
  }

  async hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const metas = await mediaStore.allMeta();
      for (const meta of metas) {
        const blob = await mediaStore.getBlob(meta.id);
        if (!blob) continue;
        this.assets.set(meta.id, meta);
        this.urls.set(meta.id, URL.createObjectURL(blob));
      }
      this.emit();
    } catch {
      /* storage unavailable: media import still works in-memory */
    }
  }

  async import(file: File): Promise<MediaAsset | null> {
    const kind = kindOf(file);
    if (!kind) return null;
    const id = makeId("m");
    const url = URL.createObjectURL(file);
    const probed = await probe(url, kind).catch(() => ({
      duration: kind === "image" ? 5 : 0,
      width: 0,
      height: 0,
    }));
    const asset: MediaAsset = {
      id,
      name: file.name,
      kind,
      mimeType: file.type,
      size: file.size,
      duration: probed.duration,
      width: probed.width,
      height: probed.height,
      thumbnail: kind === "audio" ? undefined : await thumbnail(url, kind).catch(() => undefined),
      createdAt: Date.now(),
    };
    this.urls.set(id, url);
    this.assets.set(id, asset);
    this.emit();
    try {
      await mediaStore.putBlob(id, file);
      await mediaStore.putMeta(asset);
    } catch {
      /* not persisted, still usable this session */
    }
    return asset;
  }

  async remove(id: string) {
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    this.assets.delete(id);
    this.emit();
    try {
      await mediaStore.deleteBlob(id);
      await mediaStore.deleteMeta(id);
    } catch {
      /* ignore */
    }
  }
}

function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext)) return "audio";
  return null;
}

function probe(url: string, kind: MediaKind) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    if (kind === "image") {
      const img = new Image();
      img.onload = () => resolve({ duration: 5, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
      return;
    }
    const el = document.createElement(kind === "video" ? "video" : "audio") as HTMLVideoElement;
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      resolve({
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      });
    el.onerror = reject;
    el.src = url;
  });
}

function thumbnail(url: string, kind: MediaKind) {
  return new Promise<string | undefined>((resolve, reject) => {
    const draw = (source: CanvasImageSource, w: number, h: number) => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 160 / Math.max(w || 1, 1));
      canvas.width = Math.max(1, Math.round((w || 160) * scale));
      canvas.height = Math.max(1, Math.round((h || 90) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(undefined);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    if (kind === "image") {
      const img = new Image();
      img.onload = () => draw(img, img.naturalWidth, img.naturalHeight);
      img.onerror = reject;
      img.src = url;
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.2, (video.duration || 1) / 4);
    };
    video.onseeked = () => draw(video, video.videoWidth, video.videoHeight);
    video.onerror = reject;
    video.src = url;
  });
}

export const mediaManager = new MediaManager();
