import { Captions, Plus, Type } from "lucide-react";
import { useEditor, editorStore } from "../store";

function AddButton({ kind }: { kind: "text" | "caption" }) {
  const Icon = kind === "text" ? Type : Captions;
  return (
    <button
      type="button"
      onClick={() => editorStore.addTextClip(kind)}
      className="flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-panel-raised py-2 text-xs font-semibold hover:border-primary hover:bg-accent"
    >
      <Icon className="h-3.5 w-3.5" />
      <Plus className="h-3 w-3" />
      Add {kind === "text" ? "Text" : "Caption"}
    </button>
  );
}

export function TextPanel({ kind }: { kind: "text" | "caption" }) {
  const project = useEditor((s) => s.project);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const clips = project.tracks.filter((track) => track.type === kind).flatMap((track) => track.clips);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2"><AddButton kind={kind} /></div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {clips.length === 0 ? (
          <p className="px-1 pt-2 text-xs leading-relaxed text-muted-foreground">
            {kind === "text"
              ? "Add a text layer to place editable typography over your video."
              : "Add a caption, then edit its timing and style in Properties."}
          </p>
        ) : (
          clips.map((clip) => (
            <button
              key={clip.id}
              type="button"
              onClick={() => editorStore.select(clip.id)}
              className={`w-full rounded-sm border p-2 text-left ${selectedClipId === clip.id ? "border-primary bg-primary/10" : "border-border bg-panel-raised hover:border-primary/60"}`}
            >
              <div className="flex items-center gap-2">
                {kind === "text" ? <Type className="h-3.5 w-3.5" /> : <Captions className="h-3.5 w-3.5" />}
                <span className="truncate text-xs font-medium">{clip.text || "Untitled"}</span>
              </div>
              <div className="tc mt-1 text-[10px] text-muted-foreground">
                {clip.timelineStart.toFixed(2)}s · {clip.duration.toFixed(2)}s
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
