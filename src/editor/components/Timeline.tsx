import { Diamond, Flag, Scissors, Trash2, Copy, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { timecode } from "../format";
import { editorStore, useEditor } from "../store";
import { addMarker, duplicateSelectedClip, loadMarkers, removeMarker, snapTime, splitSelectedClip, type TimelineMarker } from "../phase7";
import { projectDuration, type Project } from "../types";
import { Playhead } from "./Playhead";
import { TRACK_HEIGHT, TimelineTrack } from "./TimelineTrack";

const GUTTER = 56;
const RULER_HEIGHT = 24;
function tickStep(pps: number) { const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]; return candidates.find((c) => c * pps >= 70) ?? 600; }
function Ruler({ pixelsPerSecond, width, markers }: { pixelsPerSecond: number; width: number; markers: TimelineMarker[] }) {
  const step = tickStep(pixelsPerSecond); const count = Math.ceil(width / (step * pixelsPerSecond)) + 1;
  return <div className="relative border-b border-border bg-panel-sunken" style={{ height: RULER_HEIGHT, width }}>
    {Array.from({ length: count }).map((_, i) => { const t = i * step; return <div key={i} className="absolute top-0 h-full" style={{ left: t * pixelsPerSecond }}><div className="h-2 w-px bg-grid" /><span className="tc absolute left-1 top-1.5 text-[10px] text-muted-foreground">{timecode(t)}</span></div>; })}
    {markers.map((marker) => <button key={marker.id} type="button" title={`${marker.name} — ${timecode(marker.time, true)}`} className="absolute top-0 z-30 -translate-x-1/2 text-primary" style={{ left: marker.time * pixelsPerSecond }} onClick={(e) => { e.stopPropagation(); editorStore.seek(marker.time); }} onDoubleClick={(e) => { e.stopPropagation(); removeMarker(marker.id); window.dispatchEvent(new Event("reelforge-markers-changed")); }}><Flag className="h-3 w-3 fill-current" /></button>)}
  </div>;
}
function KeyframeMarkers({ project, pixelsPerSecond }: { project: Project; pixelsPerSecond: number }) { const selected = useEditor((s) => s.selectedKeyframeIds); return <div className="pointer-events-none absolute left-0 top-0 z-20" style={{ width: "100%" }}>{project.tracks.map((track, trackIndex) => track.clips.flatMap((clip) => clip.keyframes.map((k) => { const x = (clip.timelineStart + k.time) * pixelsPerSecond; const y = RULER_HEIGHT + trackIndex * TRACK_HEIGHT + TRACK_HEIGHT / 2; const isSelected = selected.includes(k.id); return <button key={k.id} type="button" title={`${k.property}: ${k.value} at ${timecode(k.time, true)}`} aria-label="Keyframe" className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded p-0.5 transition-transform hover:scale-125 ${isSelected ? "text-primary" : "text-primary/80"}`} style={{ left: x, top: y }} onPointerDown={(e) => { e.stopPropagation(); editorStore.selectKeyframe(k.id, e.shiftKey); editorStore.seek(clip.timelineStart + k.time); }}><Diamond className={`h-3 w-3 ${isSelected ? "fill-current" : "fill-background"}`} /></button>; })))} </div>; }

export function Timeline() {
  const project = useEditor((s) => s.project); const pixelsPerSecond = useEditor((s) => s.pixelsPerSecond); const selectedClipId = useEditor((s) => s.selectedClipId); const currentTime = useEditor((s) => s.currentTime); const duration = projectDuration(project);
  const [markers, setMarkers] = useState<TimelineMarker[]>(() => loadMarkers()); const [snapping, setSnapping] = useState(true); const scrollRef = useRef<HTMLDivElement | null>(null); const scrubbing = useRef(false);
  const contentWidth = Math.max(1200, (duration + 30) * pixelsPerSecond);
  const refreshMarkers = useCallback(() => setMarkers(loadMarkers()), []);
  useEffect(() => { window.addEventListener("reelforge-markers-changed", refreshMarkers); return () => window.removeEventListener("reelforge-markers-changed", refreshMarkers); }, [refreshMarkers]);
  const seekFromEvent = useCallback((clientX: number, laneEl: HTMLElement) => { const rect = laneEl.getBoundingClientRect(); const raw = Math.max(0, (clientX - rect.left) / pixelsPerSecond); editorStore.seek(snapping ? snapTime(raw) : raw); }, [pixelsPerSecond, snapping]);
  useEffect(() => { const el = scrollRef.current; if (!el) return; const onWheel = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1); editorStore.setZoom(editorStore.getState().pixelsPerSecond * Math.exp(-dy * 0.0015)); }; el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel); }, []);
  const addCurrentMarker = () => { addMarker(currentTime, `Marker ${markers.length + 1}`); refreshMarkers(); };
  const split = () => { if (splitSelectedClip(currentTime)) { /* state updates through the store */ } };

  return <section className="flex h-[320px] shrink-0 flex-col border-t border-border bg-panel">
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Timeline</span>
      <div className="ml-2 flex items-center gap-1"><button type="button" aria-label="Zoom out" title="Zoom out (Ctrl + scroll)" onClick={() => editorStore.setZoom(pixelsPerSecond / 1.4)} className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-panel-raised hover:bg-accent"><ZoomOut className="h-3 w-3" /></button><span className="tc w-14 text-center text-[10px] text-muted-foreground">{Math.round(pixelsPerSecond)} px/s</span><button type="button" aria-label="Zoom in" title="Zoom in (Ctrl + scroll)" onClick={() => editorStore.setZoom(pixelsPerSecond * 1.4)} className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-panel-raised hover:bg-accent"><ZoomIn className="h-3 w-3" /></button></div>
      <button type="button" onClick={() => setSnapping((v) => !v)} className={`inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-[10px] ${snapping ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-panel-raised text-muted-foreground"}`} title="Snap playhead to clip edges and markers">Snap</button>
      <button type="button" onClick={addCurrentMarker} className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-panel-raised px-2 text-[10px] hover:bg-accent" title="Add marker at playhead"><Flag className="h-3 w-3" /> Marker</button>
      <button type="button" disabled={!selectedClipId} onClick={split} className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-panel-raised px-2 text-[10px] hover:bg-accent disabled:opacity-35" title="Split selected clip at playhead (Ctrl+B)"><Scissors className="h-3 w-3" /> Split</button>
      <button type="button" disabled={!selectedClipId} onClick={() => duplicateSelectedClip()} className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-panel-raised px-2 text-[10px] hover:bg-accent disabled:opacity-35" title="Duplicate selected clip"><Copy className="h-3 w-3" /> Duplicate</button>
      <button type="button" disabled={!selectedClipId} onClick={() => selectedClipId && editorStore.deleteClip(selectedClipId)} className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-panel-raised px-2 text-[11px] hover:bg-accent disabled:opacity-35"><Trash2 className="h-3 w-3" /> Delete clip</button>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Scissors className="h-3 w-3" /> drag clip edges to trim</span>
    </div>
    <div className="flex min-h-0 flex-1"><div className="shrink-0 border-r border-border bg-panel" style={{ width: GUTTER }}><div style={{ height: RULER_HEIGHT }} className="border-b border-border bg-panel-sunken" />{project.tracks.map((track) => <div key={track.id} style={{ height: TRACK_HEIGHT }} className="flex flex-col justify-center gap-0.5 border-b border-border px-2"><span className="tc text-xs font-semibold">{track.name}</span><span className="text-[9px] uppercase tracking-wide text-muted-foreground">{track.type}</span></div>)}</div>
      <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-auto"><div style={{ width: contentWidth }} className="relative"><div onPointerDown={(e) => { scrubbing.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seekFromEvent(e.clientX, e.currentTarget as HTMLElement); }} onPointerMove={(e) => { if (scrubbing.current) seekFromEvent(e.clientX, e.currentTarget as HTMLElement); }} onPointerUp={() => { scrubbing.current = false; }} className="cursor-ew-resize"><Ruler pixelsPerSecond={pixelsPerSecond} width={contentWidth} markers={markers} /></div>{markers.map((marker) => <div key={`line-${marker.id}`} className="pointer-events-none absolute top-0 z-10 h-full border-l border-primary/40 border-dashed" style={{ left: marker.time * pixelsPerSecond }} />)}{project.tracks.map((track) => <TimelineTrack key={track.id} track={track} pixelsPerSecond={pixelsPerSecond} selectedClipId={selectedClipId} contentWidth={contentWidth} />)}<KeyframeMarkers project={project} pixelsPerSecond={pixelsPerSecond} /><Playhead pixelsPerSecond={pixelsPerSecond} /></div></div></div>
  </section>;
}
