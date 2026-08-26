import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LAST_PROJECT_KEY, projectStore } from "../db";
import { useKeyboardShortcuts, usePlaybackClock } from "../hooks";
import { mediaManager } from "../media-manager";
import { editorStore, useEditor } from "../store";
import { LeftPanel } from "./LeftPanel";
import { InspectorPanel } from "./InspectorPanel";
import { Timeline } from "./Timeline";
import { Toolbar } from "./Toolbar";
import { VideoPreview } from "./VideoPreview";

export function Editor() {
  const playing = useEditor((s) => s.playing); const dirty = useEditor((s) => s.dirty); const [aspectLocked, setAspectLocked] = useState(true); const fileInput = useRef<HTMLInputElement | null>(null); usePlaybackClock(playing);
  const save = useCallback(async () => { try { await editorStore.save(); toast.success("Project saved"); } catch { toast.error("Could not save project locally"); } }, []); useKeyboardShortcuts(save);
  useEffect(() => { if (!dirty) return; const timer = window.setTimeout(() => { void editorStore.save(); }, 5000); return () => window.clearTimeout(timer); }, [dirty]);
  useEffect(() => { let cancelled=false; (async()=>{ await mediaManager.hydrate(); try { const lastId=localStorage.getItem(LAST_PROJECT_KEY); if(!lastId||cancelled)return; const project=await projectStore.load(lastId); if(project&&!cancelled)editorStore.loadProject(project); }catch{} })(); return()=>{cancelled=true}; },[]);
  const openImport=useCallback(()=>fileInput.current?.click(),[]);
  const handleFiles=useCallback(async(files:FileList|null)=>{if(!files?.length)return;let imported=0;for(const file of Array.from(files)){const asset=await mediaManager.import(file);if(asset)imported++;}if(imported)toast.success(`Imported ${imported} file${imported>1?"s":""}`);else toast.error("Unsupported file type")},[]);
  return <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground"><h1 className="sr-only">Edit Suite desktop video editor</h1><Toolbar onImport={openImport} onSave={save}/><div className="flex min-h-0 flex-1"><LeftPanel onImport={openImport}/><VideoPreview aspectLocked={aspectLocked} onImport={openImport}/><InspectorPanel aspectLocked={aspectLocked} onToggleAspect={()=>setAspectLocked(v=>!v)}/></div><Timeline/><input ref={fileInput} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={e=>{void handleFiles(e.target.files);e.target.value=""}}/></div>;
}
