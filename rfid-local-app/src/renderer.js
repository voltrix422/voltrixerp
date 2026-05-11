const readersEl = document.getElementById("readers")
const tagsBody = document.getElementById("tagsBody")
const statusText = document.getElementById("statusText")
const readerText = document.getElementById("readerText")
const uniqueText = document.getElementById("uniqueText")
const readsText = document.getElementById("readsText")
const logEl = document.getElementById("log")
const updateFeedUrlInput = document.getElementById("updateFeedUrl")
const checkUpdateBtn = document.getElementById("checkUpdateBtn")
const downloadUpdateBtn = document.getElementById("downloadUpdateBtn")
const installUpdateBtn = document.getElementById("installUpdateBtn")
const appVersionText = document.getElementById("appVersion")
const updateStatusText = document.getElementById("updateStatus")

const subnetInput = document.getElementById("subnet")
const manualIpInput = document.getElementById("manualIp")
const portInput = document.getElementById("port")
const searchBtn = document.getElementById("searchBtn")
const connectBtn = document.getElementById("connectBtn")
const disconnectBtn = document.getElementById("disconnectBtn")
const startBtn = document.getElementById("startBtn")
const stopBtn = document.getElementById("stopBtn")

let selectedReader = null
let autoModeBusy = false
let connectFlapCount = 0
let forceListenMode = true
let lastAutoRunAt = 0

function log(message) {
  const ts = new Date().toLocaleTimeString()
  logEl.textContent = `[${ts}] ${message}\n${logEl.textContent}`.slice(0, 8000)
}

function setStatus(status) {
  if (status.listenMode && status.scanning) {
    statusText.textContent = "Listening"
  } else {
    statusText.textContent = status.connected ? (status.scanning ? "Scanning" : "Connected") : "Disconnected"
  }
  if (status.listenMode) {
    readerText.textContent = status.readerIp
      ? `LISTEN 0.0.0.0:${status.readerPort} <- ${status.readerIp}`
      : `LISTEN 0.0.0.0:${status.readerPort} (waiting)`
  } else {
    readerText.textContent = status.readerIp ? `${status.readerIp}:${status.readerPort}` : "-"
  }
  if (typeof status.rawPacketCount === "number") {
    const base = statusText.textContent || ""
    statusText.textContent = `${base} | Packets: ${status.rawPacketCount}`
  }
}

function setUpdaterStatus(status) {
  appVersionText.textContent = status.currentVersion || "-"
  updateStatusText.textContent = status.message || status.stage || "Idle"
}

function renderReaders(items) {
  readersEl.innerHTML = ""
  if (!items.length) {
    readersEl.textContent = "No reader found"
    return
  }

  items.forEach((item, idx) => {
    const btn = document.createElement("button")
    btn.textContent = `${item.ip}:${item.port} (${item.latency}ms)`
    btn.onclick = () => {
      selectedReader = item
      log(`Selected ${item.ip}:${item.port}`)
    }
    if (idx === 0 && !selectedReader) selectedReader = item
    readersEl.appendChild(btn)
  })
}

function appendTag(tag) {
  const tr = document.createElement("tr")
  const at = new Date(tag.seenAt || Date.now()).toLocaleTimeString()
  tr.innerHTML = `<td>${at}</td><td>${tag.epc}</td><td>${tag.readerIp}:${tag.readerPort}</td><td>${tag.synced ? "OK" : "FAILED"}</td>`
  tagsBody.prepend(tr)
  while (tagsBody.children.length > 150) tagsBody.removeChild(tagsBody.lastChild)
}

async function bootstrap() {
  const cfg = await window.rfidApp.getConfig()
  subnetInput.value = cfg.subnet || "192.168.18"
  manualIpInput.value = cfg.lastReaderIp || ""
  portInput.value = String(cfg.readerPort || 9090)
  updateFeedUrlInput.value = cfg.updateFeedUrl || ""
  if (cfg.localSubnet && cfg.subnet && String(cfg.localSubnet) !== String(cfg.subnet)) {
    log(`Tip: this PC is on ${cfg.localSubnet}.x — if search finds nothing, align Subnet or set Reader IP.`)
  }

  const state = await window.rfidApp.getState()
  setStatus(state.status)
  uniqueText.textContent = String(state.counters.unique || 0)
  readsText.textContent = String(state.counters.reads || 0)
  ;(state.tags || []).forEach(appendTag)

  // Auto mode: discover -> connect -> start scan.
  if (!state.status?.connected || !state.status?.scanning) {
    await autoDiscoverAndStart()
  }
  const updaterState = await window.rfidApp.getUpdaterState()
  setUpdaterStatus(updaterState)
  setInterval(() => {
    autoDiscoverAndStart().catch((err) => log(`Auto mode error: ${err.message}`))
  }, 5000)
}

searchBtn.onclick = async () => {
  const subnet = subnetInput.value.trim()
  const port = Number(portInput.value || 9090)
  await window.rfidApp.setConfig({ subnet, readerPort: port })
  log(`Searching ${subnet}.x:${port}...`)
  const readers = await window.rfidApp.searchReaders({ subnet, port })
  renderReaders(readers)
  log(`Found ${readers.length} reachable reader(s)`)
}

manualIpInput.addEventListener("blur", async () => {
  const v = manualIpInput.value.trim()
  await window.rfidApp.setConfig({ lastReaderIp: v })
})

connectBtn.onclick = async () => {
  const port = Number(portInput.value || 9090)
  const manual = (manualIpInput.value || "").trim()
  const ip = manual || selectedReader?.ip
  if (!ip) {
    log("Enter Reader IP, or Search Readers and select one, then Connect.")
    return
  }
  const status = await window.rfidApp.connectReader({ ip, port })
  setStatus(status)
  log(`Connected ${ip}:${port}`)
  const started = await window.rfidApp.startScan()
  setStatus(started)
  log("Auto started scanning after connect")
}

disconnectBtn.onclick = async () => {
  const status = await window.rfidApp.disconnectReader()
  setStatus(status)
  log("Disconnected")
}

startBtn.onclick = async () => {
  const status = await window.rfidApp.startScan()
  setStatus(status)
  log("Scanning started")
}

stopBtn.onclick = async () => {
  const status = await window.rfidApp.stopScan()
  setStatus(status)
  log("Scanning stopped")
}

checkUpdateBtn.onclick = async () => {
  const updateFeedUrl = updateFeedUrlInput.value.trim()
  await window.rfidApp.setConfig({ updateFeedUrl })
  const res = await window.rfidApp.checkForUpdates()
  if (!res.ok) log("Update check failed: set update feed URL first")
  else log("Checking for updates...")
}

downloadUpdateBtn.onclick = async () => {
  const res = await window.rfidApp.downloadUpdate()
  if (!res.ok) log("No update available to download")
}

installUpdateBtn.onclick = async () => {
  const res = await window.rfidApp.installUpdate()
  if (!res.ok) log("Update is not downloaded yet")
  else log("Installing update and restarting app...")
}

async function autoDiscoverAndStart() {
  if (autoModeBusy) return
  const now = Date.now()
  if (now - lastAutoRunAt < 3000) return
  lastAutoRunAt = now
  autoModeBusy = true
  try {
    const current = await window.rfidApp.getState()
    if (current.status?.listenMode) {
      if (current.status?.scanning) return
      const started = await window.rfidApp.startScan()
      setStatus(started)
      log("Listen mode: scanning resumed (ready for reader TCP data)")
      return
    }
    if (current.status?.connected && current.status?.scanning && !current.status?.listenMode) return

    const subnet = subnetInput.value.trim()
    const port = Number(portInput.value || 9090)
    if (forceListenMode) {
      const listening = await window.rfidApp.listenReader({ port })
      setStatus(listening)
      await window.rfidApp.startScan()
      log(`Auto mode: LISTEN-first enabled on port ${port}`)
      return
    }
    const readers = await window.rfidApp.searchReaders({ subnet, port, quick: true })
    renderReaders(readers)
    if (!readers.length) {
      const listening = await window.rfidApp.listenReader({ port })
      setStatus(listening)
      await window.rfidApp.startScan()
      log(`Auto mode: no direct reader found, listening for push on port ${port}`)
      return
    }

    selectedReader = readers[0]
    const connected = await window.rfidApp.connectReader({ ip: selectedReader.ip, port })
    setStatus(connected)
    const started = await window.rfidApp.startScan()
    setStatus(started)
    log(`Auto mode: connected and scanning on ${selectedReader.ip}:${port}`)
  } finally {
    autoModeBusy = false
  }
}

window.rfidApp.onStatus((status) => {
  setStatus(status)
  if (status.listenMode) {
    connectFlapCount = 0
    forceListenMode = true
    if (status.connected && !status.scanning) {
      window.rfidApp.startScan().catch((err) => log(`Auto start failed: ${err.message}`))
    }
    return
  }
  if (status.connected && !status.scanning) {
    window.rfidApp.startScan().catch((err) => log(`Auto start failed: ${err.message}`))
  }
  if (String(status.message || "").toLowerCase().includes("disconnected")) {
    connectFlapCount += 1
    if (connectFlapCount >= 2) {
      forceListenMode = true
      log("Auto mode: switching to LISTEN mode due to unstable direct connection")
    }
  }
})
window.rfidApp.onCounters((counters) => {
  uniqueText.textContent = String(counters.unique || 0)
  readsText.textContent = String(counters.reads || 0)
})
window.rfidApp.onTag((tag) => appendTag(tag))
window.rfidApp.onUpdaterStatus((status) => {
  setUpdaterStatus(status)
  log(status.message || `Updater: ${status.stage}`)
})

bootstrap().catch((err) => log(`Init error: ${err.message}`))
