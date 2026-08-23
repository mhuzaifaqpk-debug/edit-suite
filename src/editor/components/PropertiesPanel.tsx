import { Lock, LockOpen, MousePointerSquareDashed, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { timecode } from "../format";
import { editorStore, useEditor } from "../store";
import { DEFAULT_TRANSFORM, findClip, type Clip, type Transform } from "../types";

function NumberField({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => setDraft(String(Math.round(value))), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== Math.round(value)) onCommit(parsed);
    else setDraft(String(Math.round(value)));
  };

  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="relative flex-1">
        <input
          className="field-input"
          value={draft}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
              onCommit(Math.round(value) + step);
            }
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  clipId,
  field,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  clipId: string;
  field: keyof Transform;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="tc text-[11px]">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="h-1 w-full accent-primary"
        onPointerDown={() => editorStore.beginBatch()}
        onPointerUp={() => editorStore.endBatch()}
        onChange={(e) =>
          editorStore.updateTransform(clipId, { [field]: Number(e.target.value) }, true)
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-3 py-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function PropertiesPanel({
  aspectLocked,
  onToggleAspect,
}: {
  aspectLocked: boolean;
  onToggleAspect: () => void;
}) {
  const found = useEditor((s) => findClip(s.project, s.selectedClipId));

  if (!found) {
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-panel">
        <div className="panel-header">Properties</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <MousePointerSquareDashed className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Select a clip on the timeline to edit its properties.
          </p>
        </div>
      </aside>
    );
  }

  const { clip, track } = found;
  const t = clip.transform;
  const set = (patch: Partial<Transform>) => editorStore.updateTransform(clip.id, patch);

  const setWidth = (width: number) => {
    const next: Partial<Transform> = { width: Math.max(1, Math.round(width)) };
    if (aspectLocked && t.width > 0) next.height = Math.round((next.width! * t.height) / t.width);
    set(next);
  };
  const setHeight = (height: number) => {
    const next: Partial<Transform> = { height: Math.max(1, Math.round(height)) };
    if (aspectLocked && t.height > 0) next.width = Math.round((next.height! * t.width) / t.height);
    set(next);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel">
      <div className="panel-header justify-between">
        <span>Properties</span>
        <button
          type="button"
          title="Delete clip (Del)"
          onClick={() => editorStore.deleteClip(clip.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <div className="truncate text-xs font-semibold">{clip.name}</div>
        <div className="tc mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="uppercase">{clip.type}</span>
          <span>track {track.name}</span>
          <span>
            in {timecode(clip.timelineStart, true)} · out{" "}
            {timecode(clip.timelineStart + clip.duration, true)}
          </span>
          <span>len {timecode(clip.duration, true)}</span>
          <span>
            src {timecode(clip.sourceStart, true)}–{timecode(clip.sourceEnd, true)}
          </span>
        </div>
      </div>

      {clip.type === "audio" ? (
        <Section title="Audio">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Audio clips have no transform. Volume and audio effects arrive in a later phase — trim
            and reposition on the timeline works today.
          </p>
        </Section>
      ) : (
        <>
          <Section title="Position">
            <NumberField label="X" value={t.x} suffix="px" onCommit={(x) => set({ x })} />
            <NumberField label="Y" value={t.y} suffix="px" onCommit={(y) => set({ y })} />
          </Section>

          <Section title="Size">
            <NumberField label="Width" value={t.width} suffix="px" onCommit={setWidth} />
            <NumberField label="Height" value={t.height} suffix="px" onCommit={setHeight} />
            <button
              type="button"
              onClick={onToggleAspect}
              className={`flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-[11px] ${
                aspectLocked
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-panel-raised text-muted-foreground hover:text-foreground"
              }`}
            >
              {aspectLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              Lock aspect ratio
            </button>
          </Section>

          <Section title="Rotation">
            <SliderRow
              label="Angle"
              value={t.rotation}
              min={-180}
              max={180}
              suffix="°"
              clipId={clip.id}
              field="rotation"
            />
            <NumberField
              label="Angle"
              value={t.rotation}
              suffix="°"
              onCommit={(rotation) => set({ rotation })}
            />
          </Section>

          <Section title="Scale">
            <SliderRow
              label="Scale"
              value={t.scale}
              min={5}
              max={400}
              suffix="%"
              clipId={clip.id}
              field="scale"
            />
          </Section>

          <Section title="Opacity">
            <SliderRow
              label="Opacity"
              value={t.opacity}
              min={0}
              max={100}
              suffix="%"
              clipId={clip.id}
              field="opacity"
            />
          </Section>

          <div className="p-3">
            <button
              type="button"
              onClick={() => resetTransform(clip)}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-panel-raised py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset transform
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function resetTransform(clip: Clip) {
  editorStore.updateTransform(clip.id, {
    ...DEFAULT_TRANSFORM,
    width: clip.transform.width,
    height: clip.transform.height,
  });
}
