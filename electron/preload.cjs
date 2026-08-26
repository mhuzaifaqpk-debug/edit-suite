const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveExport: (buffer, format, suggestedName) =>
    ipcRenderer.invoke('save-export', { buffer, format, suggestedName }),
});
