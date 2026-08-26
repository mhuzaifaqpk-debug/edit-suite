export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      saveExport: (
        buffer: ArrayBuffer,
        format: "mp4" | "webm",
        suggestedName: string,
      ) => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
