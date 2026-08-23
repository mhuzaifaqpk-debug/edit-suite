import { useEditor } from "../store";

export function Playhead({ pixelsPerSecond }: { pixelsPerSecond: number }) {
  const currentTime = useEditor((s) => s.currentTime);
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-20 w-px bg-playhead"
      style={{ transform: `translateX(${currentTime * pixelsPerSecond}px)` }}
    >
      <div className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-b-sm bg-playhead" />
    </div>
  );
}
