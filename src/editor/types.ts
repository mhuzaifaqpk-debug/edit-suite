export type MediaKind = "video" | "image" | "audio";
export type ClipType = MediaKind | "text" | "caption" | "shape";
export type TrackType = "video" | "audio" | "text" | "caption" | "shape";
export interface Transform { x: number; y: number; width: number; height: number; rotation: number; scale: number; opacity: number; }
export type AnimatableProperty = "x" | "y" | "width" | "height" | "rotation" | "scale" | "opacity" | "volume";
export type Easing = "linear" | "hold";
export interface Keyframe { id: string; property: AnimatableProperty; time: number; value: number; easing: Easing; }
export type TextAlign = "left" | "center" | "right";
export interface TextStyle { fontFamily: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean; align: TextAlign; color: string; colorOpacity: number; backgroundEnabled: boolean; backgroundColor: string; backgroundOpacity: number; padding: number; borderRadius: number; strokeWidth: number; strokeColor: string; }
export interface AudioProperties { volume: number; fadeIn: number; fadeOut: number; muted: boolean; }
export type EffectType = "blur" | "pixelate" | "glow" | "dropShadow" | "glitch" | "brightness" | "contrast" | "saturate" | "hue" | "grayscale" | "sepia" | "invert" | "opacity" | "sharpen" | "noise" | "vignette" | "duotone" | "posterize" | "chromatic" | "scanlines" | "rgbSplit";
export interface Effect { id: string; type: EffectType; name: string; enabled: boolean; parameters: Record<string, number>; keyframes?: Keyframe[]; }
export type TransitionType = "fade" | "dissolve" | "wipe" | "slide" | "zoom" | "push" | "blur";
export interface Transition { id: string; type: TransitionType; duration: number; }
export type ShapeKind = "rectangle" | "circle" | "triangle" | "line" | "star" | "arrow";
export interface ShapeStyle { kind: ShapeKind; fill: string; fillOpacity: number; stroke: string; strokeWidth: number; radius: number; }
export interface Clip { id: string; type: ClipType; mediaId: string; name: string; timelineStart: number; duration: number; sourceStart: number; sourceEnd: number; transform: Transform; keyframes: Keyframe[]; audio: AudioProperties; text?: string; style?: TextStyle; shape?: ShapeStyle; effects?: Effect[]; transitionIn?: Transition; }
export interface Track { id: string; name: string; type: TrackType; clips: Clip[]; }
export interface Project { id: string; name: string; width: number; height: number; tracks: Track[]; updatedAt: number; }
export interface MediaAsset { id: string; name: string; kind: MediaKind; mimeType: string; size: number; duration: number; width: number; height: number; thumbnail?: string | undefined; waveform?: number[] | undefined; createdAt: number; }
export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scale: 100, opacity: 100 };
export const DEFAULT_AUDIO: AudioProperties = { volume: 100, fadeIn: 0, fadeOut: 0, muted: false };
export const DEFAULT_TEXT_STYLE: TextStyle = { fontFamily: "Barlow, sans-serif", fontSize: 96, bold: true, italic: false, underline: false, align: "center", color: "#ffffff", colorOpacity: 100, backgroundEnabled: false, backgroundColor: "#000000", backgroundOpacity: 60, padding: 24, borderRadius: 8, strokeWidth: 0, strokeColor: "#000000" };
export const DEFAULT_CAPTION_STYLE: TextStyle = { ...DEFAULT_TEXT_STYLE, fontSize: 56, bold: false, backgroundEnabled: true, backgroundOpacity: 70, padding: 14, strokeWidth: 2 };
export const FONT_FAMILIES = ["Barlow, sans-serif", "Georgia, serif", "Impact, sans-serif", "'Courier New', monospace", "'JetBrains Mono', monospace", "'Trebuchet MS', sans-serif", "Verdana, sans-serif"] as const;
export function makeId(prefix: string): string { return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`; }
export function clipEnd(clip: Clip): number { return clip.timelineStart + clip.duration; }
export function projectDuration(project: Project): number { let end = 0; for (const track of project.tracks) for (const clip of track.clips) end = Math.max(end, clipEnd(clip)); return end; }
export function findClip(project: Project, clipId: string | null): { track: Track; clip: Clip } | null { if (!clipId) return null; for (const track of project.tracks) { const clip = track.clips.find((c) => c.id === clipId); if (clip) return { track, clip }; } return null; }
export function isTextual(clip: Clip): boolean { return clip.type === "text" || clip.type === "caption"; }
export function hasVisual(clip: Clip): boolean { return clip.type !== "audio"; }
export function trackTypeFor(clipType: ClipType): TrackType { if (clipType === "audio") return "audio"; if (clipType === "text") return "text"; if (clipType === "caption") return "caption"; if (clipType === "shape") return "shape"; return "video"; }
export function normalizeProject(project: Project): Project { const tracks=project.tracks.map(track=>({...track,clips:track.clips.map(clip=>({...clip,keyframes:clip.keyframes??[],audio:{...DEFAULT_AUDIO,...(clip.audio??{})},transform:{...DEFAULT_TRANSFORM,...clip.transform},effects:clip.effects??[],...(isTextual(clip)?{text:clip.text??"Text",style:{...(clip.type==="caption"?DEFAULT_CAPTION_STYLE:DEFAULT_TEXT_STYLE),...(clip.style??{})}}:{}),...(clip.type==="shape"?{shape:{kind:"rectangle" as ShapeKind,fill:"#ffffff",fillOpacity:100,stroke:"#000000",strokeWidth:0,radius:0,...(clip.shape??{})}}:{})}))}));const ensure=(id:string,name:string,type:TrackType)=>tracks.some(t=>t.type===type)?null:{id,name,type,clips:[]};const extra=[ensure("V1","VIDEO","video"),ensure("A1","AUDIO","audio"),ensure("T1","TEXT","text"),ensure("S1","SHAPES","shape"),ensure("C1","CAPTIONS","caption")].filter((t):t is Track=>t!==null);return{...project,tracks:[...tracks,...extra]};}
