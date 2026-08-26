import { MonitorPlay, Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { timecode } from "../format";
import { mediaManager } from "../media-manager";
import { composeLayers, layerStyle, rgba, type Layer } from "../render/composition";
import { editorStore, useEditor } from "../store";
import { projectDuration } from "../types";
import { TransformControls } from "./TransformControls";

function MediaLayer({ layer, playing }: { layer: Layer; playing: boolean }) {
  const { clip, sourceTime, active, volume, transform } = layer;
  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const url = mediaManager.getUrl(clip.mediaId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    if (!active) {
      if (!el.paused) el.pause();
      return;
    }
    const tolerance = playing ? 0.3 : 0.04;
    if (Number.isFinite(sourceTime) && Math.abs(el.currentTime - sourceTime) > tolerance) {
      try { el.currentTime = sourceTime; } catch { /* metadata not ready */ }
    }
    if (playing && el.paused) void el.play().catch(() => {});
    if (!playing && !el.paused) el.pause();
  }, [active, playing, sourceTime, volume]);

  if (!url) return null;
  if (clip.type === "audio") return <audio ref={ref as React.Ref<HTMLAudioElement>} src={url} preload="auto" hidden />;
  if (clip.type === "image") return <img src={url} alt={clip.name} draggable={false} style={{ ...layerStyle(transform, layer.zIndex), display: active ? "block" : "none", objectFit: "fill" }} />;
  return <video ref={ref as React.Ref<HTMLVideoElement>} src={url} preload="auto" playsInline style={{ ...layerStyle(transform, layer.zIndex), display: active ? "block" : "none", objectFit: "fill" }} />;
}

function TextLayer({ layer }: { layer: Layer }) {
  const { clip, active, transform, zIndex } = layer;
  if (!active || !clip.style || !clip.text) return null;
  const s = clip.style;
  const color = rgba(s.color, s.colorOpacity);
  return (
    <div
      style={{
        ...layerStyle(transform, zIndex),
        display: "flex",
        alignItems: "center",
        justifyContent: s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
        boxSizing: "border-box",
        padding: s.padding,
        color,
        background: s.backgroundEnabled ? rgba(s.backgroundColor, s.backgroundOpacity) : "transparent",
        borderRadius: s.borderRadius,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.bold ? 700 : 400,
        fontStyle: s.italic ? "italic" : "normal",
        textDecoration: s.underline ? "underline" : "none",
        textAlign: s.align,
        WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : undefined,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        pointerEvents: "none",
      }}
    >
      {clip.text}
    </div>
  );
}

export function VideoPreview({ aspectLocked, onImport }: { aspectLocked: boolean; onImport: () => void }) {
  const project = useEditor((s) => s.project);
  const currentTime = useEditor((s) => s.currentTime);
  const playing = useEditor((s) => s.playing);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const duration = projectDuration(project);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(0.25);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setStageScale(Math.min((rect.width - 24) / project.width, (rect.height - 24) / project.height) || 0.25);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.width, project.height]);

  const layers = composeLayers(project, currentTime);
  const hasClips = layers.some((l) => l.clip.type !== "audio");
  const selected = layers.find((l) => l.clip.id === selectedClipId);
  const showControls = selected && selected.active && selected.clip.type !== "audio";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="panel-header justify-between"><span>Program monitor</span><span className="tc text-[10px] normal-case tracking-normal">{project.width}×{project.height} · {Math.round(stageScale * 100)}%</span></div>
      <div ref={frameRef} className="relative flex min-h-0 flex-1 items-center justify-center bg-stage p-3">
        {hasClips ? (
          <div className="relative overflow-hidden bg-black shadow-float" style={{ width: project.width, height: project.height, transform: `scale(${stageScale})`, transformOrigin: "center center", position: "absolute" }} onPointerDown={(e) => { if (e.target === e.currentTarget) editorStore.select(null); }}>
            {layers.map((layer) => layer.clip.type === "text" || layer.clip.type === "caption" ? <TextLayer key={layer.clip.id} layer={layer} /> : <MediaLayer key={layer.clip.id} layer={layer} playing={playing} />)}
            {showControls ? <TransformControls clip={selected.clip} stageScale={stageScale} aspectLocked={aspectLocked} /> : null}
          </div>
        ) : (
          <div className="max-w-sm text-center"><MonitorPlay className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">Create a new project</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Import your media to get started, then drag it onto the timeline.</p><button type="button" onClick={onImport} className="mt-4 inline-flex h-8 items-center rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110">Import Media</button></div>
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center gap-3 border-t border-border bg-panel px-3">
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => editorStore.togglePlay()} className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-panel-raised hover:bg-accent">{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</button>
        <span className="tc text-xs text-muted-foreground">{timecode(currentTime, true)} / {timecode(duration, true)}</span>
        <input type="range" min={0} max={Math.max(duration, 0.001)} step={0.01} value={Math.min(currentTime, duration)} onChange={(e) => editorStore.seek(Number(e.target.value))} aria-label="Seek" className="h-1 flex-1 accent-primary" />
      </div>
    </section>
  );
}
