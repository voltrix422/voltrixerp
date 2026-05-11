/* eslint-disable no-console */
const path = require("node:path")
const net = require("node:net")
const fs = require("node:fs")
const os = require("node:os")
const { app, BrowserWindow, ipcMain } = require("electron")
const { autoUpdater } = require("electron-updater")
const { ReaderService } = require("./reader-service")

const defaultConfig = {
  erpScanUrl: process.env.ERP_SCAN_URL || "https://voltrixbatteries.com/api/rfid/scanner/scan",
  readerPort: Number(process.env.DEFAULT_READER_PORT || 9090),
  subnet: process.env.DEFAULT_SUBNET || "192.168.18",
  lastReaderIp: "",
  updateFeedUrl: process.env.APP_UPDATE_URL || ""
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
let updaterState = {
  stage: "idle",
  message: "Updater idle",
  updateAvailable: false,
  downloaded: false,
  currentVersion: app.getVersion(),
  latestVersion: null,
  progressPercent: 0
}

function broadcast(channel, payload) {
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

function setUpdaterState(patch) {
  updaterState = { ...updaterState, ...patch }
  broadcast("updater:status", updaterState)
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

/** Subnet field: "192.168.18" scans .1–.254; "192.168.18.104" scans that host only. */
function buildDiscoveryIpList(subnetRaw, quick) {
  const trimmed = String(subnetRaw || "").trim().replace(/\.+$/g, "")
  const fullIp = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(trimmed)
  if (fullIp) return { ips: [trimmed], singleHost: true }

  const threeOct = /^(\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(trimmed)
  const base = threeOct ? threeOct[1] : trimmed || "192.168.18"

  const from = Number(process.env.DISCOVERY_FROM || 1)
  const to = Number(process.env.DISCOVERY_TO || 254)
  const ips = []
  if (quick) {
    for (let i = 100; i <= 130; i += 1) ips.push(`${base}.${i}`)
    ;[10, 50, 80, 90, 99, 104, 112].forEach((h) => ips.push(`${base}.${h}`))
  } else {
    for (let i = from; i <= to; i += 1) ips.push(`${base}.${i}`)
  }
  return { ips: [...new Set(ips)], singleHost: false }
}

function detectLocalSubnet() {
  const interfaces = os.networkInterfaces()
  for (const rows of Object.values(interfaces)) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (!row || row.family !== "IPv4" || row.internal) continue
      const parts = String(row.address || "").split(".")
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`
    }
  }
  return config.subnet
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("checking-for-update", () => {
    setUpdaterState({ stage: "checking", message: "Checking for updates..." })
  })
  autoUpdater.on("update-available", (info) => {
    setUpdaterState({
      stage: "available",
      message: `Update available: ${info.version}`,
      updateAvailable: true,
      downloaded: false,
      latestVersion: info.version
    })
  })
  autoUpdater.on("update-not-available", (info) => {
    setUpdaterState({
      stage: "up-to-date",
      message: "You are already on latest version",
      updateAvailable: false,
      downloaded: false,
      latestVersion: info?.version || null,
      progressPercent: 0
    })
  })
  autoUpdater.on("download-progress", (progressObj) => {
    setUpdaterState({
      stage: "downloading",
      message: `Downloading update... ${Math.round(progressObj.percent)}%`,
      progressPercent: Number(progressObj.percent || 0)
    })
  })
  autoUpdater.on("update-downloaded", (info) => {
    setUpdaterState({
      stage: "downloaded",
      message: `Update ${info.version} ready. Click Install Update.`,
      downloaded: true,
      progressPercent: 100
    })
  })
  autoUpdater.on("error", (err) => {
    setUpdaterState({
      stage: "error",
      message: `Updater error: ${err.message || "Unknown error"}`
    })
  })
}

ipcMain.handle("app:get-config", async () => ({
  erpScanUrl: config.erpScanUrl,
  readerPort: config.readerPort,
  subnet: config.subnet,
  lastReaderIp: config.lastReaderIp || "",
  localSubnet: detectLocalSubnet(),
  updateFeedUrl: config.updateFeedUrl
}))

ipcMain.handle("app:set-config", async (_event, payload) => {
  if (payload.erpScanUrl) config.erpScanUrl = String(payload.erpScanUrl)
  if (payload.readerPort) config.readerPort = Number(payload.readerPort)
  if (payload.subnet) config.subnet = String(payload.subnet)
  if (payload.lastReaderIp !== undefined) config.lastReaderIp = String(payload.lastReaderIp || "").trim()
  if (payload.updateFeedUrl !== undefined) config.updateFeedUrl = String(payload.updateFeedUrl || "")
  saveConfig()
  return true
})

ipcMain.handle("reader:search", async (_event, payload) => {
  const detectedSubnet = detectLocalSubnet()
  const subnetInput = String(payload?.subnet || detectedSubnet || config.subnet).trim()
  const port = Number(payload?.port || config.readerPort)
  const quick = Boolean(payload?.quick)
  const { ips: uniqIps, singleHost } = buildDiscoveryIpList(subnetInput, quick)
  const timeoutMs = singleHost
    ? Math.max(800, Number(process.env.DISCOVERY_TIMEOUT_MS || 800))
    : quick
      ? 220
      : Number(process.env.DISCOVERY_TIMEOUT_MS || 450)
  const concurrency = singleHost ? 1 : quick ? 40 : Math.max(1, Number(process.env.DISCOVERY_CONCURRENCY || 80))

  const results = []
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, uniqIps.length) }).map(async () => {
    while (index < uniqIps.length) {
      const current = uniqIps[index]
      index += 1
      const r = await probe(current, port, timeoutMs)
      if (r.reachable) results.push(r)
    }
  })
  await Promise.all(workers)
  return results.sort((a, b) => a.latency - b.latency)
})

ipcMain.handle("reader:connect", async (_event, payload) => {
  const ip = String(payload.ip || "").trim()
  if (!ip) throw new Error("Reader IP is required")
  const port = Number(payload.port || config.readerPort)
  const status = await reader.connect(ip, port)
  if (ip) {
    config.lastReaderIp = ip
    saveConfig()
  }
  return status
})

ipcMain.handle("reader:listen", async (_event, payload) => {
  const port = Number(payload?.port || config.readerPort)
  const status = await reader.listen(port)
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

ipcMain.handle("updater:get-state", async () => updaterState)

ipcMain.handle("updater:check", async () => {
  if (!config.updateFeedUrl) {
    setUpdaterState({
      stage: "error",
      message: "Update feed URL not set. Add it in app settings first."
    })
    return { ok: false, error: "missing_update_feed_url" }
  }
  autoUpdater.setFeedURL({ provider: "generic", url: config.updateFeedUrl })
  autoUpdater.checkForUpdates().catch((err) => {
    setUpdaterState({ stage: "error", message: `Check failed: ${err.message}` })
  })
  return { ok: true }
})

ipcMain.handle("updater:download", async () => {
  if (!updaterState.updateAvailable) return { ok: false, error: "no_update_available" }
  autoUpdater.downloadUpdate().catch((err) => {
    setUpdaterState({ stage: "error", message: `Download failed: ${err.message}` })
  })
  return { ok: true }
})

ipcMain.handle("updater:install", async () => {
  if (!updaterState.downloaded) return { ok: false, error: "update_not_downloaded" }
  setTimeout(() => autoUpdater.quitAndInstall(), 300)
  return { ok: true }
})

app.whenReady().then(() => {
  loadConfig()
  setupAutoUpdater()
  createWindow()
})
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
