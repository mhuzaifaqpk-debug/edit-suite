import { Film, Image as ImageIcon, Music, Plus, Trash2, Upload } from "lucide-react";
import { shortDuration } from "../format";
import { useMediaLibrary } from "../hooks";
import { mediaManager } from "../media-manager";
import { editorStore } from "../store";
import type { MediaAsset } from "../types";

const kindIcon = { video: Film, image: ImageIcon, audio: Music } as const;

function MediaItem({ asset }: { asset: MediaAsset }) {
  const Icon = kindIcon[asset.kind];
  return (
    <div
      className="group relative flex gap-2 rounded-sm border border-border bg-panel-raised p-1.5 hover:border-primary/60"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-reelforge-media", asset.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={() => editorStore.addMediaToTimeline(asset)}
      title={`${asset.name} — drag to timeline or double-click to append`}
    >
      <div className="checker relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-stage">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{asset.name}</div>
        <div className="tc mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Icon className="h-3 w-3" />
          {asset.kind === "image" ? "still" : shortDuration(asset.duration)}
          {asset.width ? <span>{`${asset.width}×${asset.height}`}</span> : null}
        </div>
      </div>
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          type="button"
          title="Add to timeline"
          onClick={() => editorStore.addMediaToTimeline(asset)}
          className="rounded-sm bg-primary p-1 text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Remove from media pool"
          onClick={() => mediaManager.remove(asset.id)}
          className="rounded-sm bg-panel-sunken p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function MediaPanel({
  filter,
  onImport,
}: {
  filter?: MediaAsset["kind"];
  onImport: () => void;
}) {
  const assets = useMediaLibrary();
  const list = filter ? assets.filter((a) => a.kind === filter) : assets;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2">
        <button
          type="button"
          onClick={onImport}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-border bg-panel-sunken py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" /> Import media
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {list.length === 0 ? (
          <p className="px-1 pt-2 text-xs leading-relaxed text-muted-foreground">
            No {filter ?? "media"} yet. Import video, image or audio files to get started.
          </p>
        ) : (
          list.map((asset) => <MediaItem key={asset.id} asset={asset} />)
        )}
      </div>
    </div>
  );
}
