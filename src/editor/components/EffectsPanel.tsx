import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { useEditor, editorStore } from "../store";
import { EFFECT_PRESETS, FILTER_PRESETS } from "../render/effects";
import { clipEnd, makeId, type Effect, type Transition, type TransitionType } from "../types";

const TRANSITIONS: Array<{ type: TransitionType; name: string }> = [
  { type: "fade", name: "Fade" }, { type: "dissolve", name: "Dissolve" }, { type: "wipe", name: "Wipe" },
  { type: "slide", name: "Slide" }, { type: "zoom", name: "Zoom" }, { type: "push", name: "Push" }, { type: "blur", name: "Blur" },
];

export function EffectsPanel({ mode = "effects" }: { mode?: "effects" | "transitions" }) {
  const project = useEditor((s) => s.project);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const found = useMemo(() => {
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return { track, clip };
    }
    return null;
  }, [project, selectedClipId]);

  if (!found || found.clip.type === "audio") return <div className="p-4 text-xs text-muted-foreground">Select a video or image clip first.</div>;

  const { clip, track } = found;
  const effects = clip.effects ?? [];
  const previous = track.clips.filter((c) => c.id !== clip.id).sort((a, b) => a.timelineStart - b.timelineStart).find((c) => Math.abs(clipEnd(c) - clip.timelineStart) < 0.05);

  if (mode === "transitions") {
    const current = clip.transitionIn;
    return (
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transitions</div>
        {!previous ? <div className="rounded border border-border bg-panel-sunken p-3 text-xs text-muted-foreground">Select a clip that has another clip directly before it.</div> : null}
        <div className="grid grid-cols-2 gap-2">
          {TRANSITIONS.map((item) => <button key={item.type} disabled={!previous} type="button" onClick={() => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) c.transitionIn = { id: makeId("tr"), type: item.type, duration: Math.min(1, Math.max(0.1, clip.timelineStart - previous!.timelineStart)) }; })} className={`rounded border p-2 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 ${current?.type === item.type ? "border-primary" : "border-border"}`}>{item.name}</button>)}
        </div>
        {current ? <div className="mt-4 rounded border border-border bg-panel-sunken p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>{current.type}</span><button type="button" onClick={() => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) delete c.transitionIn; })}><X className="h-3.5 w-3.5" /></button></div>
          <label className="text-[10px] text-muted-foreground">Duration: {current.duration.toFixed(1)}s</label>
          <Slider className="mt-2" min={0.1} max={Math.max(0.2, Math.min(5, clip.timelineStart - previous!.timelineStart))} step={0.1} value={[current.duration]} onValueChange={([v]) => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c?.transitionIn) c.transitionIn.duration = v; })} />
        </div> : null}
      </div>
    );
  }

  const addEffect = (type: (typeof EFFECT_PRESETS)[number]) => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) (c.effects ??= []).push({ id: makeId("fx"), type: type.type, name: type.name, enabled: true, parameters: { amount: type.defaultAmount } }); });
  const applyFilter = (preset: (typeof FILTER_PRESETS)[number]) => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) c.effects = preset.values.map((v) => ({ id: makeId("fx"), type: v.type, name: `${preset.name} ${v.type}`, enabled: true, parameters: { amount: v.amount } })); });

  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Effects</div>
      <div className="grid grid-cols-2 gap-2">{EFFECT_PRESETS.map((item) => <button key={item.type} type="button" onClick={() => addEffect(item)} className="rounded border border-border p-2 text-left text-xs hover:bg-accent"><Plus className="mb-1 h-3.5 w-3.5" />{item.name}</button>)}</div>
      <div className="mb-2 mt-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>Filters</span><span className="text-[9px] normal-case tracking-normal">presets replace effects</span></div>
      <div className="flex flex-wrap gap-1.5">{FILTER_PRESETS.map((preset) => <Button key={preset.name} size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => applyFilter(preset)}>{preset.name}</Button>)}<Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) c.effects = []; })}><RotateCcw className="mr-1 h-3 w-3" />Reset</Button></div>
      <div className="mt-5 space-y-2">{effects.map((effect: Effect) => { const preset = EFFECT_PRESETS.find((x) => x.type === effect.type)!; const value = effect.parameters.amount ?? preset.defaultAmount; return <div key={effect.id} className="rounded border border-border bg-panel-sunken p-2"><div className="flex items-center justify-between"><button type="button" onClick={() => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); const e = c?.effects?.find((x) => x.id === effect.id); if (e) e.enabled = !e.enabled; })} className={`flex items-center gap-1.5 text-xs font-semibold ${effect.enabled ? "text-foreground" : "text-muted-foreground"}`}>{effect.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{effect.name}</button><button type="button" onClick={() => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); if (c) c.effects = (c.effects ?? []).filter((x) => x.id !== effect.id); })}><Trash2 className="h-3 w-3 text-muted-foreground" /></button></div><Slider className="mt-2" min={preset.min} max={preset.max} step={1} value={[value]} onValueChange={([v]) => editorStore.edit((p) => { const c = p.tracks.find((t) => t.id === track.id)?.clips.find((x) => x.id === clip.id); const e = c?.effects?.find((x) => x.id === effect.id); if (e) e.parameters.amount = v; })} /><div className="mt-1 text-right text-[9px] text-muted-foreground">{value}{preset.unit}</div></div>; })}</div>
    </div>
  );
}
