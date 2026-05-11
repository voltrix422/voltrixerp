/* eslint-disable no-console */
const path = require("node:path")
const net = require("node:net")
const fs = require("node:fs")
const { app, BrowserWindow, ipcMain } = require("electron")
const { ReaderService } = require("./reader-service")

const defaultConfig = {
  erpScanUrl: process.env.ERP_SCAN_URL || "https://voltrixbatteries.com/api/rfid/scanner/scan",
  readerPort: Number(process.env.DEFAULT_READER_PORT || 9090),
  subnet: process.env.DEFAULT_SUBNET || "192.168.18"
}
let config = { ...defaultConfig }

function configPath() {
  return path.join(app.getPath("userData"), "config.json")
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8")
    const parsed = JSON.parse(raw)
    config = { ...defaultConfig, ...parsed }
  } catch (_err) {
    config = { ...defaultConfig }
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8")
  } catch (err) {
    console.error("[config] save error:", err.message)
  }
}

let win = null
const state = {
  tags: [],
  counters: {
    unique: 0,
    reads: 0
  }
}

function broadcast(channel, payload) {
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

async function postTagToErp(tag) {
  const url = config.erpScanUrl
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epc: tag.epc,
        reader_ip: tag.readerIp,
        reader_port: tag.readerPort,
        protocol: "RFID_LOCAL_APP"
      })
    })
    return res.ok
  } catch (err) {
    console.error("[erp] post error:", err.message)
    return false
  }
}

const reader = new ReaderService(
  (status) => broadcast("reader:status", status),
  async (tag) => {
    state.tags.unshift(tag)
    if (state.tags.length > 300) state.tags = state.tags.slice(0, 300)
    state.counters.reads += 1
    state.counters.unique = new Set(state.tags.map((t) => t.epc)).size
    const synced = await postTagToErp(tag)
    broadcast("reader:tag", { ...tag, synced })
    broadcast("reader:counters", state.counters)
  }
)

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, "index.html"))
}

function probe(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      socket.destroy()
      resolve({ ip, port, reachable: ok, latency: Date.now() - start })
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
    socket.connect(port, ip)
  })
}

ipcMain.handle("app:get-config", async () => ({
  erpScanUrl: config.erpScanUrl,
  readerPort: config.readerPort,
  subnet: config.subnet
}))

ipcMain.handle("app:set-config", async (_event, payload) => {
  if (payload.erpScanUrl) config.erpScanUrl = String(payload.erpScanUrl)
  if (payload.readerPort) config.readerPort = Number(payload.readerPort)
  if (payload.subnet) config.subnet = String(payload.subnet)
  saveConfig()
  return true
})

ipcMain.handle("reader:search", async (_event, payload) => {
  const subnet = String(payload?.subnet || config.subnet)
  const port = Number(payload?.port || config.readerPort)
  const from = Number(process.env.DISCOVERY_FROM || 1)
  const to = Number(process.env.DISCOVERY_TO || 254)
  const timeoutMs = Number(process.env.DISCOVERY_TIMEOUT_MS || 220)

  const ips = []
  for (let i = from; i <= to; i += 1) ips.push(`${subnet}.${i}`)

  const results = []
  for (const ip of ips) {
    // Keep it simple/robust for now; can optimize with concurrency later.
    // eslint-disable-next-line no-await-in-loop
    const r = await probe(ip, port, timeoutMs)
    if (r.reachable) results.push(r)
  }
  return results.sort((a, b) => a.latency - b.latency)
})

ipcMain.handle("reader:connect", async (_event, payload) => {
  const ip = String(payload.ip || "")
  const port = Number(payload.port || config.readerPort)
  const status = await reader.connect(ip, port)
  return status
})

ipcMain.handle("reader:disconnect", async () => {
  reader.disconnect()
  return reader.status()
})

ipcMain.handle("reader:start", async () => {
  reader.startScan()
  return reader.status()
})

ipcMain.handle("reader:stop", async () => {
  reader.stopScan()
  return reader.status()
})

ipcMain.handle("reader:state", async () => ({
  status: reader.status(),
  counters: state.counters,
  tags: state.tags
}))

app.whenReady().then(() => {
  loadConfig()
  createWindow()
})
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
