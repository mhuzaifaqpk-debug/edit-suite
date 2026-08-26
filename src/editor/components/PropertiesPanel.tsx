import { Diamond, Lock, LockOpen, MousePointerSquareDashed, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { timecode } from "../format";
import { editorStore, useEditor } from "../store";
import { keyframeAt, keyframesFor, PROPERTY_LABELS, valueAt } from "../render/keyframes";
import { DEFAULT_TRANSFORM, findClip, FONT_FAMILIES, type AnimatableProperty, type Clip, type TextAlign, type TextStyle, type Transform } from "../types";

function NumberField({ label, value, suffix, onCommit }: { label: string; value: number; suffix?: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);
  const commit = () => { const parsed = Number(draft); if (Number.isFinite(parsed)) onCommit(parsed); else setDraft(String(Math.round(value))); };
  return <label className="flex items-center gap-2"><span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span><span className="relative flex-1"><input className="field-input" value={draft} inputMode="numeric" onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />{suffix ? <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span> : null}</span></label>;
}

function SliderRow({ label, value, min, max, suffix, clipId, property }: { label: string; value: number; min: number; max: number; suffix: string; clipId: string; property: AnimatableProperty }) {
  const time = useEditor((s) => s.currentTime); const project = useEditor((s) => s.project); const clip = findClip(project, clipId)?.clip;
  const local = clip ? time - clip.timelineStart : 0; const animated = !!clip && keyframesFor(clip, property).length > 0; const atHere = !!clip && !!keyframeAt(clip, property, local);
  return <div className="space-y-1"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{label}</span><div className="flex items-center gap-1"><span className="tc text-[11px]">{Math.round(value)}{suffix}</span><button type="button" title={atHere ? "Remove keyframe" : "Add keyframe"} onClick={() => editorStore.toggleKeyframe(clipId, property)} className={`rounded p-0.5 ${atHere ? "text-primary" : animated ? "text-primary/70" : "text-muted-foreground hover:text-foreground"}`}><Diamond className={`h-3 w-3 ${atHere ? "fill-current" : ""}`} /></button></div></div><input type="range" min={min} max={max} value={value} aria-label={label} className="h-1 w-full accent-primary" onPointerDown={() => editorStore.beginBatch()} onPointerUp={() => editorStore.endBatch()} onChange={(e) => editorStore.setAnimatable(clipId, property, Number(e.target.value), true)} /></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border-b border-border px-3 py-3"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3><div className="space-y-2">{children}</div></div>; }

function KeyframeSection({ clip }: { clip: Clip }) {
  const currentTime = useEditor((s) => s.currentTime); const selectedIds = useEditor((s) => s.selectedKeyframeIds); const local = currentTime - clip.timelineStart; const keys = [...clip.keyframes].sort((a, b) => a.time - b.time);
  return <Section title="Keyframes"><div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{keys.length} keyframe{keys.length === 1 ? "" : "s"}</span><span className="tc">{timecode(Math.max(0, local), true)}</span></div>{keys.length === 0 ? <p className="text-[10px] leading-relaxed text-muted-foreground">Click a diamond beside an animatable property to add a keyframe.</p> : <div className="max-h-40 space-y-1 overflow-y-auto">{keys.map((k) => { const selected = selectedIds.includes(k.id); return <button key={k.id} type="button" onClick={() => { editorStore.selectKeyframe(k.id); editorStore.seek(Math.max(0, clip.timelineStart + k.time)); }} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[10px] ${selected ? "bg-primary/15 text-foreground" : "bg-panel-raised text-muted-foreground hover:text-foreground"}`}><Diamond className={`h-2.5 w-2.5 ${selected ? "fill-current text-primary" : "text-primary"}`} /><span className="flex-1">{PROPERTY_LABELS[k.property]}</span><span className="tc">{timecode(k.time, true)}</span><span className="tc w-12 text-right">{Math.round(k.value)}</span></button>; })}</div>}{keys.length > 0 ? <button type="button" onClick={() => editorStore.deleteSelectedKeyframes()} className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-border py-1 text-[10px] text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /> Delete selected</button> : null}</Section>;
}

function TextProperties({ clip }: { clip: Clip }) {
  const style = clip.style!; const currentTime = useEditor((s) => s.currentTime); const local = currentTime - clip.timelineStart;
  const setStyle = (patch: Partial<TextStyle>) => editorStore.updateStyle(clip.id, patch);
  const textAnimatedProperties: AnimatableProperty[] = ["x", "y", "width", "height", "rotation", "scale", "opacity"];
  const addTextKeyframe = () => {
    const found = findClip(editorStore.getState().project, clip.id);
    if (!found) return;
    const allAtPlayhead = textAnimatedProperties.every((property) => !!keyframeAt(found.clip, property, local));
    for (const property of textAnimatedProperties) {
      const has = !!keyframeAt(found.clip, property, local);
      if (allAtPlayhead ? has : !has) editorStore.toggleKeyframe(clip.id, property);
    }
  };
  const foundNow = findClip(editorStore.getState().project, clip.id)?.clip;
  const allTextKeysAtPlayhead = !!foundNow && textAnimatedProperties.every((property) => !!keyframeAt(foundNow, property, local));
  return <>
    <Section title="Content"><textarea className="field-input min-h-16 resize-y" value={clip.text ?? ""} onChange={(e) => editorStore.updateText(clip.id, e.target.value)} /></Section>
    <Section title="Typography">
      <select className="field-input w-full" value={style.fontFamily} onChange={(e) => setStyle({ fontFamily: e.target.value })}>{FONT_FAMILIES.map((font) => <option key={font} value={font}>{font.split(",")[0]}</option>)}</select>
      <NumberField label="Size" value={style.fontSize} suffix="px" onCommit={(v) => setStyle({ fontSize: Math.max(8, Math.min(500, v)) })} />
      <div className="grid grid-cols-3 gap-1"><button type="button" onClick={() => setStyle({ bold: !style.bold })} className={`rounded border py-1 text-[11px] ${style.bold ? "border-primary bg-primary/15" : "border-border"}`}>Bold</button><button type="button" onClick={() => setStyle({ italic: !style.italic })} className={`rounded border py-1 text-[11px] ${style.italic ? "border-primary bg-primary/15" : "border-border"}`}>Italic</button><button type="button" onClick={() => setStyle({ underline: !style.underline })} className={`rounded border py-1 text-[11px] ${style.underline ? "border-primary bg-primary/15" : "border-border"}`}>Underline</button></div>
      <div className="grid grid-cols-3 gap-1">{(["left", "center", "right"] as TextAlign[]).map((align) => <button key={align} type="button" onClick={() => setStyle({ align })} className={`rounded border py-1 text-[11px] capitalize ${style.align === align ? "border-primary bg-primary/15" : "border-border"}`}>{align}</button>)}</div>
      <label className="flex items-center justify-between text-[11px] text-muted-foreground">Text color<input type="color" value={style.color} onChange={(e) => setStyle({ color: e.target.value })} className="h-7 w-12 cursor-pointer border-0 bg-transparent p-0" /></label>
      <label className="flex items-center justify-between text-[11px] text-muted-foreground">Color opacity<input type="range" min="0" max="100" value={style.colorOpacity} onChange={(e) => setStyle({ colorOpacity: Number(e.target.value) })} className="w-28 accent-primary" /></label>
    </Section>
    <Section title="Animation"><button type="button" onClick={addTextKeyframe} className={`flex w-full items-center justify-center gap-2 rounded-sm border py-1.5 text-[11px] ${allTextKeysAtPlayhead ? "border-primary bg-primary/15 text-primary" : "border-border bg-panel-raised hover:bg-accent"}`}><Diamond className={`h-3.5 w-3.5 ${allTextKeysAtPlayhead ? "fill-current" : ""}`} />{allTextKeysAtPlayhead ? "Remove keyframe" : "Add keyframe"}</button><p className="text-[10px] text-muted-foreground">Animates position, size, rotation, scale and opacity at the playhead.</p></Section>
    <Section title="Background"><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={style.backgroundEnabled} onChange={(e) => setStyle({ backgroundEnabled: e.target.checked })} /> Enable background</label><label className="flex items-center justify-between text-[11px] text-muted-foreground">Color<input type="color" value={style.backgroundColor} onChange={(e) => setStyle({ backgroundColor: e.target.value })} className="h-7 w-12 cursor-pointer border-0 bg-transparent p-0" /></label><NumberField label="Opacity" value={style.backgroundOpacity} suffix="%" onCommit={(v) => setStyle({ backgroundOpacity: Math.max(0, Math.min(100, v)) })} /><NumberField label="Padding" value={style.padding} suffix="px" onCommit={(v) => setStyle({ padding: Math.max(0, v) })} /><NumberField label="Radius" value={style.borderRadius} suffix="px" onCommit={(v) => setStyle({ borderRadius: Math.max(0, v) })} /></Section>
    {clip.type === "caption" ? <Section title="Caption timing"><NumberField label="Start" value={clip.timelineStart} suffix="s" onCommit={(v) => editorStore.setClipRange(clip.id, Math.max(0, v), clip.timelineStart + clip.duration)} /><NumberField label="End" value={clip.timelineStart + clip.duration} suffix="s" onCommit={(v) => editorStore.setClipRange(clip.id, clip.timelineStart, Math.max(clip.timelineStart + 0.1, v))} /></Section> : null}
    <KeyframeSection clip={clip} />
  </>;
}

function AudioProperties({ clip }: { clip: Clip }) {
  const audio = clip.audio;
  return <><Section title="Audio"><SliderRow label="Volume" value={valueAt(clip, "volume", 0)} min={0} max={200} suffix="%" clipId={clip.id} property="volume" /><NumberField label="Exact" value={valueAt(clip, "volume", 0)} suffix="%" onCommit={(v) => editorStore.setAnimatable(clip.id, "volume", Math.max(0, Math.min(200, v)))} /><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={audio.muted} onChange={(e) => editorStore.updateAudio(clip.id, { muted: e.target.checked })} /> Mute</label><NumberField label="Fade in" value={audio.fadeIn} suffix="s" onCommit={(v) => editorStore.updateAudio(clip.id, { fadeIn: Math.max(0, Math.min(clip.duration, v)) })} /><NumberField label="Fade out" value={audio.fadeOut} suffix="s" onCommit={(v) => editorStore.updateAudio(clip.id, { fadeOut: Math.max(0, Math.min(clip.duration, v)) })} /></Section><KeyframeSection clip={clip} /> </>;
}

export function PropertiesPanel({ aspectLocked, onToggleAspect }: { aspectLocked: boolean; onToggleAspect: () => void }) {
  const project = useEditor((s) => s.project); const selectedClipId = useEditor((s) => s.selectedClipId); const currentTime = useEditor((s) => s.currentTime); const found = findClip(project, selectedClipId);
  if (!found) return <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-panel"><div className="panel-header">Properties</div><div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center"><MousePointerSquareDashed className="h-6 w-6 text-muted-foreground" /><p className="text-xs text-muted-foreground">Select a clip on the timeline to edit its properties.</p></div></aside>;
  const { clip, track } = found; const local = currentTime - clip.timelineStart; const resolved = (property: AnimatableProperty) => valueAt(clip, property, local); const set = (property: AnimatableProperty, value: number) => editorStore.setAnimatable(clip.id, property, value); const t = clip.transform;
  const setWidth = (width: number) => { const next = Math.max(1, Math.round(width)); if (aspectLocked && t.width > 0) set("height", Math.round((next * t.height) / t.width)); set("width", next); };
  const setHeight = (height: number) => { const next = Math.max(1, Math.round(height)); if (aspectLocked && t.height > 0) set("width", Math.round((next * t.width) / t.height)); set("height", next); };
  const isText = clip.type === "text" || clip.type === "caption";
  return <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel"><div className="panel-header justify-between"><span>Properties</span><button type="button" title="Delete clip (Del)" onClick={() => editorStore.deleteClip(clip.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="border-b border-border px-3 py-2.5"><div className="truncate text-xs font-semibold">{clip.name}</div><div className="tc mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground"><span className="uppercase">{clip.type}</span><span>track {track.name}</span><span>in {timecode(clip.timelineStart, true)} · out {timecode(clip.timelineStart + clip.duration, true)}</span><span>len {timecode(clip.duration, true)}</span></div></div>
    {clip.type === "audio" ? <AudioProperties clip={clip} /> : <>
      {isText ? <TextProperties clip={clip} /> : null}
      <Section title="Position"><NumberField label="X" value={resolved("x")} suffix="px" onCommit={(x) => set("x", x)} /><NumberField label="Y" value={resolved("y")} suffix="px" onCommit={(y) => set("y", y)} /></Section>
      <Section title="Size"><NumberField label="Width" value={resolved("width")} suffix="px" onCommit={setWidth} /><NumberField label="Height" value={resolved("height")} suffix="px" onCommit={setHeight} /><button type="button" onClick={onToggleAspect} className={`flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-[11px] ${aspectLocked ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-panel-raised text-muted-foreground hover:text-foreground"}`}>{aspectLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}Lock aspect ratio</button></Section>
      <Section title="Rotation"><SliderRow label="Angle" value={resolved("rotation")} min={-180} max={180} suffix="°" clipId={clip.id} property="rotation" /><NumberField label="Exact" value={resolved("rotation")} suffix="°" onCommit={(v) => set("rotation", v)} /></Section>
      <Section title="Scale"><SliderRow label="Scale" value={resolved("scale")} min={5} max={400} suffix="%" clipId={clip.id} property="scale" /></Section>
      <Section title="Opacity"><SliderRow label="Opacity" value={resolved("opacity")} min={0} max={100} suffix="%" clipId={clip.id} property="opacity" /></Section>
      {!isText ? <KeyframeSection clip={clip} /> : null}
      <div className="p-3"><button type="button" onClick={() => resetTransform(clip)} className="flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-panel-raised py-1.5 text-[11px] text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Reset transform</button></div>
    </>}
  </aside>;
}
function resetTransform(clip: Clip) { editorStore.updateTransform(clip.id, { ...DEFAULT_TRANSFORM, width: clip.transform.width, height: clip.transform.height }); }
