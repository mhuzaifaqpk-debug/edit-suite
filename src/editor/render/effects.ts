import type { Effect, EffectType } from "../types";

export function effectFilter(effect: Effect): string {
  if (!effect.enabled) return "none";
  const p = effect.parameters;
  const a = p.amount ?? 0;
  switch (effect.type) {
    case "blur": return `blur(${Math.max(0, a)}px)`;
    case "pixelate": return `blur(${Math.max(0, a * 0.08)}px) contrast(${100 + a * 3}%)`;
    case "glow": return `drop-shadow(0 0 ${Math.max(0, a)}px rgba(255,255,255,.9))`;
    case "dropShadow": return `drop-shadow(${p.x ?? 6}px ${p.y ?? 6}px ${Math.max(0, a)}px rgba(0,0,0,.65))`;
    case "glitch": return `contrast(${100 + a * 1.2}%) saturate(${100 + a * 2}%) hue-rotate(${a * 2}deg)`;
    case "brightness": return `brightness(${Math.max(0, a)}%)`;
    case "contrast": return `contrast(${Math.max(0, a)}%)`;
    case "saturate": return `saturate(${Math.max(0, a)}%)`;
    case "hue": return `hue-rotate(${a}deg)`;
    case "grayscale": return `grayscale(${Math.max(0, Math.min(100, a))}%)`;
    case "sepia": return `sepia(${Math.max(0, Math.min(100, a))}%)`;
    case "invert": return `invert(${Math.max(0, Math.min(100, a))}%)`;
    case "opacity": return `opacity(${Math.max(0, Math.min(100, a))}%)`;
    case "sharpen": return `contrast(${100 + a * .5}%) saturate(${100 + a * .15}%)`;
    case "noise": return `contrast(${100 + a}%) saturate(${100 + a * .4}%)`;
    case "vignette": return `brightness(${100 - a * .15}%) contrast(${100 + a * .2}%)`;
    case "duotone": return `grayscale(${Math.min(100, a)}%) contrast(${100 + a * .3}%)`;
    case "posterize": return `contrast(${100 + a * 2}%) saturate(${100 + a}%)`;
    case "chromatic": return `hue-rotate(${a * 1.5}deg) saturate(${100 + a}%)`;
    case "scanlines": return `contrast(${100 + a * .5}%)`;
    case "rgbSplit": return `saturate(${100 + a * 2}%) hue-rotate(${a * 3}deg)`;
    default: return "none";
  }
}
export function combinedFilter(effects: Effect[] = []): string { return effects.filter((e) => e.enabled).map(effectFilter).filter((f) => f !== "none").join(" ") || "none"; }

type Preset = { type: EffectType; name: string; defaultAmount: number; min: number; max: number; unit: string };
const base: Preset[] = [
 ["blur","Blur",8,0,40,"px"],["pixelate","Pixel Blur",8,0,30,""],["glow","Glow",12,0,40,"px"],["dropShadow","Drop Shadow",8,0,40,"px"],["glitch","Glitch",25,0,100,""],["brightness","Brightness",110,0,200,"%"],["contrast","Contrast",115,0,200,"%"],["saturate","Saturation",125,0,250,"%"],["hue","Hue Shift",25,-180,180,"°"],["grayscale","Grayscale",100,0,100,"%"],["sepia","Sepia",60,0,100,"%"],["invert","Invert",100,0,100,"%"],["opacity","Opacity",80,0,100,"%"],["sharpen","Sharpen",40,0,100,""],["noise","Noise",20,0,100,""],["vignette","Vignette",35,0,100,""],["duotone","Duotone",55,0,100,""],["posterize","Posterize",25,0,100,""],["chromatic","Chromatic",30,0,100,""],["scanlines","Scanlines",35,0,100,""],["rgbSplit","RGB Split",25,0,100,""],
].map(([type,name,defaultAmount,min,max,unit]) => ({ type: type as EffectType, name: name as string, defaultAmount: defaultAmount as number, min: min as number, max: max as number, unit: unit as string }));
const variants = ["Soft","Strong","Dream","Night","Retro","Crisp","Film","Neon","Cyber","Old TV","VHS","Faded","Punchy","Soft Light","Hard Light","Electric","Frost","Heat","Mono","Dark","Bright","Deep","Pastel","Drama","Action","Comic","Digital","Analog","Mystic","Shadow","Clean","Epic","Warm","Cool","Urban","Vintage","Cinema","Flash","Twist","Distort"];
export const EFFECT_PRESETS: Preset[] = [...base, ...variants.map((name, i) => { const b = base[i % base.length]; return { ...b, name: `${name} ${b.name}`, defaultAmount: Math.max(b.min, Math.min(b.max, b.defaultAmount + ((i % 5) - 2) * 5)) }; })];
export const FILTER_PRESETS = [
 { name: "Warm Cinema", values: [{ type: "brightness" as const, amount: 105 }, { type: "contrast" as const, amount: 115 }, { type: "saturate" as const, amount: 120 }] },
 { name: "Cool Cinema", values: [{ type: "brightness" as const, amount: 102 }, { type: "contrast" as const, amount: 112 }, { type: "hue" as const, amount: -12 }] },
 { name: "Vintage Film", values: [{ type: "sepia" as const, amount: 35 }, { type: "contrast" as const, amount: 108 }, { type: "saturate" as const, amount: 85 }] },
 { name: "Black & White", values: [{ type: "grayscale" as const, amount: 100 }, { type: "contrast" as const, amount: 112 }] },
 { name: "Dream", values: [{ type: "blur" as const, amount: 2 }, { type: "brightness" as const, amount: 108 }, { type: "saturate" as const, amount: 115 }] },
 { name: "Cyber", values: [{ type: "glitch" as const, amount: 35 }, { type: "contrast" as const, amount: 125 }, { type: "hue" as const, amount: 35 }] },
];
