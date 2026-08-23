import { Captions, Film, Music, Sparkles, Type, Wand2 } from "lucide-react";
import { useState } from "react";
import { MediaPanel } from "./MediaPanel";

const TABS = [
  { id: "media", label: "Media", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "text", label: "Text", icon: Type },
  { id: "captions", label: "Captions", icon: Captions },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "transitions", label: "Transitions", icon: Wand2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PHASE_NOTES: Record<Exclude<TabId, "media" | "audio">, string> = {
  text: "Text layers and typography controls are planned for a later phase. Nothing here is wired up yet.",
  captions: "Caption tracks and transcript editing are planned for a later phase.",
  effects: "Filters and effects are planned for a later phase.",
  transitions: "Clip transitions are planned for a later phase.",
};

export function LeftPanel({ onImport }: { onImport: () => void }) {
  const [tab, setTab] = useState<TabId>("media");

  return (
    <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-border bg-panel">
      <nav className="grid grid-cols-3 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 border-b-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === id
                ? "border-primary bg-panel-raised text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "media" ? (
        <MediaPanel onImport={onImport} />
      ) : tab === "audio" ? (
        <MediaPanel filter="audio" onImport={onImport} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="rounded-sm border border-border bg-panel-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Later phase
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">{PHASE_NOTES[tab]}</p>
        </div>
      )}
    </aside>
  );
}
