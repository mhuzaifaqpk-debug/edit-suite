import { RotateCw } from "lucide-react";
import { useRef } from "react";
import { editorStore } from "../store";
import type { Clip } from "../types";

type Mode =
  | { kind: "move" }
  | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se" }
  | { kind: "rotate" };

/**
 * Interactive bounding box drawn in project (stage) coordinates.
 * Every gesture writes through the store, so the properties panel stays in sync.
 */
export function TransformControls({
  clip,
  stageScale,
  aspectLocked,
}: {
  clip: Clip;
  stageScale: number;
  aspectLocked: boolean;
}) {
  const gesture = useRef<{
    mode: Mode;
    startX: number;
    startY: number;
    origin: Clip["transform"];
    centerScreen: { x: number; y: number };
  } | null>(null);

  const t = clip.transform;

  const start = (e: React.PointerEvent, mode: Mode) => {
    e.stopPropagation();
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).closest("[data-transform-box]") as HTMLElement;
    const rect = box.getBoundingClientRect();
    gesture.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...clip.transform },
      centerScreen: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
    editorStore.beginBatch();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = (e.clientX - g.startX) / stageScale;
    const dy = (e.clientY - g.startY) / stageScale;

    if (g.mode.kind === "move") {
      editorStore.updateTransform(clip.id, { x: g.origin.x + dx, y: g.origin.y + dy }, true);
      return;
    }
    if (g.mode.kind === "rotate") {
      const angle =
        (Math.atan2(e.clientY - g.centerScreen.y, e.clientX - g.centerScreen.x) * 180) / Math.PI + 90;
      const snapped = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
      editorStore.updateTransform(clip.id, { rotation: snapped }, true);
      return;
    }

    const signX = g.mode.corner === "ne" || g.mode.corner === "se" ? 1 : -1;
    const signY = g.mode.corner === "sw" || g.mode.corner === "se" ? 1 : -1;
    let width = Math.max(20, g.origin.width + dx * signX * 2);
    let height = Math.max(20, g.origin.height + dy * signY * 2);
    if (aspectLocked) {
      const ratio = g.origin.width / g.origin.height || 1;
      if (Math.abs(dx) > Math.abs(dy)) height = width / ratio;
      else width = height * ratio;
    }
    editorStore.updateTransform(
      clip.id,
      { width: Math.round(width), height: Math.round(height) },
      true,
    );
  };

  const end = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    editorStore.endBatch();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleSize = Math.max(8, 10 / stageScale);
  const handleStyle = { width: handleSize, height: handleSize } as React.CSSProperties;
  const corners: Array<{ corner: "nw" | "ne" | "sw" | "se"; style: React.CSSProperties }> = [
    { corner: "nw", style: { left: -handleSize / 2, top: -handleSize / 2, cursor: "nwse-resize" } },
    { corner: "ne", style: { right: -handleSize / 2, top: -handleSize / 2, cursor: "nesw-resize" } },
    { corner: "sw", style: { left: -handleSize / 2, bottom: -handleSize / 2, cursor: "nesw-resize" } },
    { corner: "se", style: { right: -handleSize / 2, bottom: -handleSize / 2, cursor: "nwse-resize" } },
  ];

  return (
    <div
      data-transform-box
      className="absolute"
      style={{
        left: "50%",
        top: "50%",
        width: t.width,
        height: t.height,
        transform: `translate(-50%, -50%) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scale / 100})`,
        transformOrigin: "center center",
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute inset-0 cursor-move border border-primary"
        style={{ borderWidth: Math.max(1, 1.5 / stageScale) }}
        onPointerDown={(e) => start(e, { kind: "move" })}
      />
      {corners.map(({ corner, style }) => (
        <div
          key={corner}
          onPointerDown={(e) => start(e, { kind: "resize", corner })}
          className="absolute bg-primary"
          style={{ ...handleStyle, ...style }}
        />
      ))}
      <div
        onPointerDown={(e) => start(e, { kind: "rotate" })}
        className="absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground"
        style={{
          left: "50%",
          top: -handleSize * 3,
          width: handleSize * 1.8,
          height: handleSize * 1.8,
          marginLeft: -handleSize * 0.9,
          cursor: "grab",
        }}
      >
        <RotateCw style={{ width: handleSize, height: handleSize }} />
      </div>
    </div>
  );
}
