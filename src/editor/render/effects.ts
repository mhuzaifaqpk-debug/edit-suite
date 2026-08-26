import type { Effect } from "../types";

export function effectFilter(effect: Effect): string {
  if (!effect.enabled) return "none";
  const p = effect.parameters;
  switch (effect.type) {
    case "blur": return `blur(${Math.max(0, p.amount ?? 0)}px)`;
    case "brightness": return `brightness(${Math.max(0, p.amount ?? 100)}%)`;
    case "contrast": return `contrast(${Math.max(0, p.amount ?? 100)}%)`;
    case "saturate": return `saturate(${Math.max(0, p.amount ?? 100)}%)`;
    case "hue": return `hue-rotate(${p.amount ?? 0}deg)`;
    case "grayscale": return `grayscale(${Math.max(0, Math.min(100, p.amount ?? 0))}%)`;
    case "sepia": return `sepia(${Math.max(0, Math.min(100, p.amount ?? 0))}%)`;
    default: return "none";
  }
}

export function combinedFilter(effects: Effect[] = []): string {
  return effects.filter((e) => e.enabled).map(effectFilter).filter((f) => f !== "none").join(" ") || "none";
}

export const EFFECT_PRESETS: Array<{
  type: Effect["type"];
  name: string;
  defaultAmount: number;
  min: number;
  max: number;
  unit: string;
}> = [
  { type: "blur", name: "Blur", defaultAmount: 4, min: 0, max: 30, unit: "px" },
  { type: "brightness", name: "Brightness", defaultAmount: 110, min: 0, max: 200, unit: "%" },
  { type: "contrast", name: "Contrast", defaultAmount: 110, min: 0, max: 200, unit: "%" },
  { type: "saturate", name: "Saturation", defaultAmount: 120, min: 0, max: 200, unit: "%" },
  { type: "hue", name: "Hue", defaultAmount: 30, min: -180, max: 180, unit: "°" },
  { type: "grayscale", name: "Grayscale", defaultAmount: 100, min: 0, max: 100, unit: "%" },
  { type: "sepia", name: "Sepia", defaultAmount: 100, min: 0, max: 100, unit: "%" },
];

export const FILTER_PRESETS = [
  { name: "Warm", values: [{ type: "brightness" as const, amount: 105 }, { type: "saturate" as const, amount: 125 }, { type: "hue" as const, amount: 8 }] },
  { name: "Cool", values: [{ type: "brightness" as const, amount: 102 }, { type: "saturate" as const, amount: 112 }, { type: "hue" as const, amount: -12 }] },
  { name: "Vintage", values: [{ type: "sepia" as const, amount: 35 }, { type: "contrast" as const, amount: 92 }, { type: "saturate" as const, amount: 85 }] },
  { name: "Cinematic", values: [{ type: "contrast" as const, amount: 118 }, { type: "saturate" as const, amount: 108 }, { type: "brightness" as const, amount: 96 }] },
  { name: "Black & White", values: [{ type: "grayscale" as const, amount: 100 }, { type: "contrast" as const, amount: 112 }] },
];
