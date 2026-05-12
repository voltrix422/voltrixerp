const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("wedgeApp", {
  copy: (text) => ipcRenderer.invoke("wedge:copy", text),
  postErp: (payload) => ipcRenderer.invoke("wedge:post-erp", payload),
  probeUsb: () => ipcRenderer.invoke("wedge:probe-usb"),
  setReaderCatch: (payload) => ipcRenderer.invoke("wedge:set-reader-catch", payload),
  onReaderLine: (cb) => {
    ipcRenderer.removeAllListeners("wedge:reader-line")
    ipcRenderer.on("wedge:reader-line", (_e, line) => cb(line))
  }
})
