import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { renderProject, type ExportOptions } from "../export";
import { editorStore, useEditor } from "../store";
import { projectDuration } from "../types";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [resolution, setResolution] = useState<"480" | "720" | "1080" | "1440" | "2160">("1080");
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<ExportOptions["quality"]>("high");
  const [progress, setProgress] = useState(0);
  const [rendering, setRendering] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setRendering(false);
      setProgress(0);
    }
  }, [open]);

  if (!open) return null;

  const startExport = async () => {
    if (rendering) return;
    const width = Number(resolution);
    const height = Math.round(width * project.height / project.width);
    const controller = new AbortController();
    abortRef.current = controller;
    setRendering(true);
    setProgress(0);
    try {
      const blob = await renderProject(project, { width, height, fps, quality }, (p) => setProgress(Math.round(p.progress * 100)), controller.signal);
      if (format === "mp4" && !window.electronAPI?.isElectron) {
        throw new Error("MP4 export requires the Windows desktop build. WebM export is available in the browser.");
      }

      if (window.electronAPI?.isElectron) {
        const result = await window.electronAPI.saveExport(await blob.arrayBuffer(), format, project.name || "Edit Suite Export");
        if (!result.canceled) toast.success(`Exported ${result.filePath ?? "video"}`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name || "Edit Suite Export"}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Video exported");
      }
      editorStore.seek(0);
      onClose();
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      abortRef.current = null;
      setRendering(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setRendering(false);
  };

  const duration = projectDuration(project);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Export video">
      <div className="w-full max-w-md rounded-md border border-border bg-panel shadow-float">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div><div className="text-sm font-semibold">Export Video</div><div className="text-[11px] text-muted-foreground">{project.name} · {duration.toFixed(1)}s</div></div>
          <button type="button" disabled={rendering} onClick={onClose} className="rounded-sm p-1 hover:bg-accent disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-3 p-4">
          <label className="grid gap-1 text-xs">Format
            <select className="field-input" value={format} onChange={(e) => setFormat(e.target.value as "mp4" | "webm")} disabled={rendering}>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">Resolution
            <select className="field-input" value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} disabled={rendering}>
              <option value="480">480p</option><option value="720">720p</option><option value="1080">1080p</option><option value="1440">1440p</option><option value="2160">4K</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">Frame rate
            <select className="field-input" value={fps} onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)} disabled={rendering}>
              <option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">Quality
            <select className="field-input" value={quality} onChange={(e) => setQuality(e.target.value as ExportOptions["quality"])} disabled={rendering}>
              <option value="standard">Standard</option><option value="high">High</option><option value="maximum">Maximum</option>
            </select>
          </label>

          {rendering ? (
            <div className="mt-2 grid gap-2">
              <div className="flex justify-between text-[11px] text-muted-foreground"><span>Rendering video…</span><span>{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          {rendering ? <button type="button" onClick={cancel} className="h-8 rounded-sm border border-border px-3 text-xs hover:bg-accent">Cancel</button> : <button type="button" onClick={onClose} className="h-8 rounded-sm border border-border px-3 text-xs hover:bg-accent">Close</button>}
          <button type="button" disabled={rendering} onClick={() => void startExport()} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
            {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {rendering ? "Rendering…" : "Export Video"}
          </button>
        </div>
      </div>
    </div>
  );
}
