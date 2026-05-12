const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("rfidApp", {
  getConfig: () => ipcRenderer.invoke("app:get-config"),
  setConfig: (payload) => ipcRenderer.invoke("app:set-config", payload),
  searchReaders: (payload) => ipcRenderer.invoke("reader:search", payload),
  connectReader: (payload) => ipcRenderer.invoke("reader:connect", payload),
  listenReader: (payload) => ipcRenderer.invoke("reader:listen", payload),
  disconnectReader: () => ipcRenderer.invoke("reader:disconnect"),
  startScan: () => ipcRenderer.invoke("reader:start"),
  stopScan: () => ipcRenderer.invoke("reader:stop"),
  clearTags: () => ipcRenderer.invoke("reader:clear-tags"),
  getState: () => ipcRenderer.invoke("reader:state"),
  getUpdaterState: () => ipcRenderer.invoke("updater:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onStatus: (handler) => ipcRenderer.on("reader:status", (_e, payload) => handler(payload)),
  onAggregate: (handler) =>
    ipcRenderer.on("reader:aggregate", (_e, payload) => handler(payload)),
  onCounters: (handler) => ipcRenderer.on("reader:counters", (_e, payload) => handler(payload)),
  onUpdaterStatus: (handler) => ipcRenderer.on("updater:status", (_e, payload) => handler(payload))
})
