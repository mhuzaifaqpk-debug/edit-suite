export function timecode(seconds: number, withFrames = false): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const base = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  if (!withFrames) return base;
  const frames = Math.floor((s % 1) * 30);
  return `${base}:${String(frames).padStart(2, "0")}`;
}

export function shortDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  return timecode(seconds);
}
