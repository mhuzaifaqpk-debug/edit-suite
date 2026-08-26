import { Circle, Plus, RectangleHorizontal, Star, Triangle } from "lucide-react";
import { editorStore, useEditor } from "../store";
import { DEFAULT_AUDIO, DEFAULT_TRANSFORM, makeId, type ShapeKind } from "../types";

const SHAPES: Array<{ kind: ShapeKind; name: string; Icon: typeof Circle }> = [
  { kind: "rectangle", name: "Rectangle", Icon: RectangleHorizontal },
  { kind: "circle", name: "Circle", Icon: Circle },
  { kind: "triangle", name: "Triangle", Icon: Triangle },
  { kind: "star", name: "Star", Icon: Star },
  { kind: "line", name: "Line", Icon: RectangleHorizontal },
  { kind: "arrow", name: "Arrow", Icon: RectangleHorizontal },
];

export function ShapePanel() {
  const project = useEditor((s) => s.project);
  const selected = useEditor((s) => s.selectedClipId);
  const add = (kind: ShapeKind) => {
    const track = project.tracks.find((t) => t.type === "shape") ?? project.tracks.find((t) => t.type === "video");
    if (!track) return;
    const clip = { id: makeId("shape"), type: "shape" as const, mediaId: "", name: kind[0].toUpperCase() + kind.slice(1), timelineStart: editorStore.getState().currentTime, duration: 3, sourceStart: 0, sourceEnd: 3, transform: { ...DEFAULT_TRANSFORM, width: 500, height: 300 }, keyframes: [], audio: { ...DEFAULT_AUDIO }, shape: { kind, fill: "#ffffff", fillOpacity: 100, stroke: "#000000", strokeWidth: 0, radius: 0 }, effects: [] };
    editorStore.edit((p) => { const t = p.tracks.find((x) => x.id === track.id)!; t.clips.push(clip); t.clips.sort((a, b) => a.timelineStart - b.timelineStart); });
    editorStore.select(clip.id);
  };
  return <div className="flex min-h-0 flex-1 flex-col"><div className="border-b border-border p-2 text-[10px] text-muted-foreground">Shapes are independent timeline layers. Add effects to the selected shape.</div><div className="grid grid-cols-2 gap-2 overflow-y-auto p-2">{SHAPES.map(({ kind, name, Icon }) => <button key={kind} type="button" onClick={() => add(kind)} className={`rounded border p-3 text-left hover:border-primary ${selected ? "border-border" : "border-border"}`}><Icon className="mb-2 h-5 w-5" /><div className="text-xs font-semibold">{name}</div><div className="text-[9px] text-muted-foreground">Add to Shapes layer</div><Plus className="mt-1 h-3 w-3" /></button>)}</div></div>;
}
