import { Captions, Film, Music, Sparkles, Type, Wand2 } from "lucide-react";
import { useState } from "react";
import { MediaPanel } from "./MediaPanel";
import { TextPanel } from "./TextPanel";
import { EffectsPanel } from "./EffectsPanel";

const TABS = [
  { id: "media", label: "Media", icon: Film }, { id: "audio", label: "Audio", icon: Music },
  { id: "text", label: "Text", icon: Type }, { id: "captions", label: "Captions", icon: Captions },
  { id: "effects", label: "Effects", icon: Sparkles }, { id: "transitions", label: "Transitions", icon: Wand2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LeftPanel({ onImport }: { onImport: () => void }) {
  const [tab, setTab] = useState<TabId>("media");
  return <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-border bg-panel">
    <nav className="grid grid-cols-3 border-b border-border">{TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 border-b-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${tab === id ? "border-primary bg-panel-raised text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {tab === "media" ? <MediaPanel onImport={onImport} /> : null}
    {tab === "audio" ? <MediaPanel filter="audio" onImport={onImport} /> : null}
    {tab === "text" ? <TextPanel kind="text" /> : null}
    {tab === "captions" ? <TextPanel kind="caption" /> : null}
    {tab === "effects" ? <EffectsPanel mode="effects" /> : null}
    {tab === "transitions" ? <EffectsPanel mode="transitions" /> : null}
  </aside>;
}
