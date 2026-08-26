import { composeLayers, type Layer } from "./render/composition";
import { mediaManager } from "./media-manager";
import type { Project } from "./types";

export interface ExportOptions {
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  quality: "standard" | "high" | "maximum";
}

export interface ExportProgress {
  phase: "rendering" | "encoding";
  progress: number;
  currentTime: number;
  duration: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mimeType() {
  const choices = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return choices.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function drawText(ctx: CanvasRenderingContext2D, layer: Layer, project: Project) {
  const clip = layer.clip;
  if (!clip.style || !clip.text || !layer.active) return;
  const s = clip.style;
  const t = layer.transform;
  ctx.save();
  ctx.translate(project.width / 2 + t.x, project.height / 2 + t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale / 100, t.scale / 100);
  ctx.globalAlpha = (t.opacity / 100) * layer.transitionOpacity;
  ctx.textAlign = s.align === "left" ? "left" : s.align === "right" ? "right" : "center";
  ctx.textBaseline = "middle";
  ctx.font = `${s.italic ? "italic " : ""}${s.bold ? "700" : "400"} ${s.fontSize}px ${s.fontFamily || "Arial"}`;

  const lines = clip.text.split("\n");
  const lineHeight = s.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  if (s.backgroundEnabled) {
    const maxWidth = Math.min(t.width, Math.max(...lines.map((line) => ctx.measureText(line).width)) + s.padding * 2);
    ctx.fillStyle = s.backgroundColor || "#000000";
    ctx.globalAlpha = (t.opacity / 100) * (s.backgroundOpacity / 100) * layer.transitionOpacity;
    ctx.beginPath();
    ctx.roundRect(-maxWidth / 2, -totalHeight / 2 - s.padding, maxWidth, totalHeight + s.padding * 2, s.borderRadius);
    ctx.fill();
    ctx.globalAlpha = (t.opacity / 100) * layer.transitionOpacity;
  }
  ctx.fillStyle = s.color || "#ffffff";
  lines.forEach((line, i) => {
    const y = i * lineHeight - (totalHeight - lineHeight) / 2;
    if (s.strokeWidth > 0) {
      ctx.lineWidth = s.strokeWidth * 2;
      ctx.strokeStyle = s.strokeColor || "#000000";
      ctx.strokeText(line, 0, y);
    }
    ctx.fillText(line, 0, y);
  });
  ctx.restore();
}

function drawMedia(ctx: CanvasRenderingContext2D, element: HTMLVideoElement | HTMLImageElement, layer: Layer, project: Project) {
  if (!layer.active) return;
  const t = layer.transform;
  ctx.save();
  ctx.translate(project.width / 2 + t.x, project.height / 2 + t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale / 100, t.scale / 100);
  ctx.globalAlpha = (t.opacity / 100) * layer.transitionOpacity;
  ctx.filter = layer.filter || "none";
  if (layer.transitionClipPath?.startsWith("inset(0 ")) {
    const match = layer.transitionClipPath.match(/inset\(0 ([\d.]+)% 0 0\)/);
    const right = match ? Number(match[1]) / 100 : 0;
    ctx.beginPath();
    ctx.rect(-t.width / 2, -t.height / 2, t.width * (1 - right), t.height);
    ctx.clip();
  }
  ctx.drawImage(element, -t.width / 2, -t.height / 2, t.width, t.height);
  ctx.restore();
}

export async function renderProject(
  project: Project,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const type = mimeType();
  if (!type) throw new Error("This system does not support WebM video recording.");

  const duration = Math.max(0.1, project.tracks.flatMap((t) => t.clips).reduce((m, c) => Math.max(m, c.timelineStart + c.duration), 0));
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create export canvas.");

  const mediaElements = new Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement>();
  const audioGains = new Map<string, GainNode>();
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();
  const audioNodes: AudioNode[] = [];

  try {
    const clips = project.tracks.flatMap((t) => t.clips).filter((c) => c.type === "video" || c.type === "audio" || c.type === "image");
    for (const clip of clips) {
      const url = mediaManager.getUrl(clip.mediaId);
      if (!url) continue;
      let el: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
      if (clip.type === "image") {
        const image = new Image();
        image.src = url;
        await image.decode();
        el = image;
      } else if (clip.type === "audio") {
        const audio = document.createElement("audio");
        audio.src = url;
        audio.preload = "auto";
        await new Promise<void>((resolve, reject) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => reject(new Error(`Could not load ${clip.name}`)); });
        el = audio;
      } else {
        const video = document.createElement("video");
        video.src = url;
        video.preload = "auto";
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(`Could not load ${clip.name}`)); });
        el = video;
      }
      mediaElements.set(clip.id, el);
      if (clip.type !== "image") {
        const source = audioContext.createMediaElementSource(el as HTMLMediaElement);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(audioDestination);
        audioNodes.push(source, gain);
        audioGains.set(clip.id, gain);
      }
    }

    const canvasStream = canvas.captureStream(options.fps);
    audioDestination.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    const bitrate = options.quality === "maximum" ? 16_000_000 : options.quality === "high" ? 10_000_000 : 5_000_000;
    const recorder = new MediaRecorder(canvasStream, { mimeType: type, videoBitsPerSecond: bitrate });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error("Export recording failed.")); });

    await audioContext.resume();
    recorder.start(250);
    const startedAt = performance.now();

    while (true) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const time = Math.min(duration, (performance.now() - startedAt) / 1000);
      const layers = composeLayers(project, time);
      ctx.clearRect(0, 0, project.width, project.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, project.width, project.height);

      for (const layer of layers) {
        const gain = audioGains.get(layer.clip.id);
        if (gain) gain.gain.value = layer.active ? Math.max(0, Math.min(1, layer.volume / 100)) : 0;
        const el = mediaElements.get(layer.clip.id);
        if (el && layer.clip.type === "audio") {
          const audio = el as HTMLAudioElement;
          if (Math.abs(audio.currentTime - layer.sourceTime) > 0.15) {
            try { audio.currentTime = layer.sourceTime; } catch { /* ignore seek race */ }
          }
          if (audio.paused && layer.active) await audio.play().catch(() => {});
          if (!layer.active && !audio.paused) audio.pause();
        } else if (el) {
          const sourceTime = layer.sourceTime;
          const media = el as HTMLVideoElement;
          if (media.readyState >= 2 && Math.abs(media.currentTime - sourceTime) > 0.12) {
            try { media.currentTime = sourceTime; } catch { /* ignore seek race */ }
          }
          if (media.paused && layer.active) await media.play().catch(() => {});
          if (!layer.active && !media.paused) media.pause();
          drawMedia(ctx, media as HTMLVideoElement, layer, project);
        } else if (layer.clip.type === "text" || layer.clip.type === "caption") {
          drawText(ctx, layer, project);
        }
      }

      onProgress?.({ phase: "rendering", progress: time / duration, currentTime: time, duration });
      if (time >= duration) break;
      await wait(Math.max(1, 1000 / options.fps));
    }

    for (const el of mediaElements.values()) if (el instanceof HTMLMediaElement) el.pause();
    recorder.stop();
    await stopped;
    onProgress?.({ phase: "encoding", progress: 1, currentTime: duration, duration });
    return new Blob(chunks, { type });
  } finally {
    audioNodes.forEach((node) => node.disconnect());
    await audioContext.close().catch(() => {});
  }
}
