import {
  Download,
  FolderInput,
  Pause,
  Play,
  Redo2,
  Save,
  SkipBack,
  SkipForward,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { timecode } from "../format";
import { editorStore, useEditor } from "../store";
import { projectDuration } from "../types";
import { ExportDialog } from "./ExportDialog";

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-panel-raised text-foreground hover:bg-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function Toolbar({ onImport, onSave }: { onImport: () => void; onSave: () => void }) {
  const name = useEditor((s) => s.project.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const playing = useEditor((s) => s.playing);
  const currentTime = useEditor((s) => s.currentTime);
  const duration = useEditor((s) => projectDuration(s.project));
  const dirty = useEditor((s) => s.dirty);
  const [editingName, setEditingName] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">
            Reel<span className="text-primary">Forge</span>
          </span>
          <span className="h-4 w-px bg-border" />
          {editingName ? (
            <input
              autoFocus
              defaultValue={name}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== name) editorStore.renameProject(value);
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="field-input max-w-52"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              title="Rename project"
              className="rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {name}
              {dirty ? <span className="ml-1 text-primary">•</span> : null}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => editorStore.undo()} disabled={!canUndo} />
          <ToolButton icon={Redo2} label="Redo (Ctrl+Y)" onClick={() => editorStore.redo()} disabled={!canRedo} />
        </div>

        <div className="mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ToolButton icon={SkipBack} label="Go to start" onClick={() => editorStore.seek(0)} />
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              title="Play / Pause (Space)"
              onClick={() => editorStore.togglePlay()}
              className="inline-flex h-7 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-colors hover:brightness-110"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <ToolButton icon={SkipForward} label="Go to end" onClick={() => editorStore.seek(duration)} />
          </div>
          <div className="tc rounded-sm border border-border bg-panel-sunken px-2 py-1 text-xs">
            <span className="text-foreground">{timecode(currentTime, true)}</span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="text-muted-foreground">{timecode(duration, true)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onImport} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-panel-raised px-2.5 text-xs font-medium hover:bg-accent">
            <FolderInput className="h-3.5 w-3.5" /> Import
          </button>
          <button type="button" onClick={onSave} title="Save project (Ctrl+S)" className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-panel-raised px-2.5 text-xs font-medium hover:bg-accent">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={duration <= 0}
            title="Export video"
            className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-primary/50 bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </header>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
