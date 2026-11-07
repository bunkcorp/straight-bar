const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('straightBar', {
  listLibrary: () => ipcRenderer.invoke('library:list'),
  openLibraryFile: (filePath) => ipcRenderer.invoke('library:open', filePath),
});
