const readersEl = document.getElementById("readers")
const tagsBody = document.getElementById("tagsBody")
const statusText = document.getElementById("statusText")
const readerText = document.getElementById("readerText")
const uniqueText = document.getElementById("uniqueText")
const readsText = document.getElementById("readsText")
const scanElapsedText = document.getElementById("scanElapsedText")
const logEl = document.getElementById("log")

const subnetInput = document.getElementById("subnet")
const manualIpInput = document.getElementById("manualIp")
const portInput = document.getElementById("port")
const searchBtn = document.getElementById("searchBtn")
const connectBtn = document.getElementById("connectBtn")
const disconnectBtn = document.getElementById("disconnectBtn")
const startBtn = document.getElementById("startBtn")
const stopBtn = document.getElementById("stopBtn")
const clearTagsBtn = document.getElementById("clearTagsBtn")
const scanControls = document.getElementById("scanControls")

let selectedReader = null
let wasScanning = false
let scanStartedAt = null
let scanTimerId = null

function log(message) {
  const ts = new Date().toLocaleTimeString()
  logEl.textContent = `[${ts}] ${message}\n${logEl.textContent}`.slice(0, 8000)
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function updateScanElapsedDisplay() {
  if (!scanElapsedText) return
  if (!scanStartedAt) {
    scanElapsedText.textContent = "—"
    return
  }
  scanElapsedText.textContent = formatElapsed(Date.now() - scanStartedAt)
}

function applyScanningTimer(status) {
  const nowScanning = Boolean(status?.scanning)
  if (nowScanning && !wasScanning) {
    scanStartedAt = Date.now()
    if (scanTimerId) clearInterval(scanTimerId)
    scanTimerId = setInterval(updateScanElapsedDisplay, 500)
    updateScanElapsedDisplay()
  } else if (!nowScanning && wasScanning) {
    if (scanTimerId) {
      clearInterval(scanTimerId)
      scanTimerId = null
    }
    if (scanStartedAt) scanElapsedText.textContent = formatElapsed(Date.now() - scanStartedAt)
    else scanElapsedText.textContent = "—"
    scanStartedAt = null
  }
  wasScanning = nowScanning
}

function applyToolbarVisibility(status) {
  if (!status) return
  const canDisconnect = Boolean(status.listening || status.connected)
  disconnectBtn.classList.toggle("is-hidden", !canDisconnect)
  connectBtn.classList.toggle("is-hidden", Boolean(status.connected))
  scanControls.classList.toggle("is-hidden", !status.connected)
}

function setStatus(status) {
  const waitingForDevice = Boolean(status.listenMode && status.listening && !status.connected)
  if (waitingForDevice) {
    statusText.textContent = "Waiting for reader"
  } else if (status.listenMode && status.connected) {
    statusText.textContent = status.scanning ? "Scanning (reader connected)" : "Reader connected"
  } else {
    statusText.textContent = status.connected ? (status.scanning ? "Scanning" : "Connected") : "Disconnected"
  }
  if (status.listenMode) {
    readerText.textContent = status.connected
      ? `LISTEN 0.0.0.0:${status.readerPort} ← ${status.readerIp || "reader"}`
      : `LISTEN 0.0.0.0:${status.readerPort} (no reader yet)`
  } else {
    readerText.textContent = status.connected && status.readerIp ? `${status.readerIp}:${status.readerPort}` : "-"
  }
  if (typeof status.rawPacketCount === "number" && status.connected) {
    const base = statusText.textContent || ""
    statusText.textContent = `${base} | Packets: ${status.rawPacketCount}`
  }
  applyToolbarVisibility(status)
  applyScanningTimer(status)

  if (!status.connected && !status.listening) {
    if (scanTimerId) {
      clearInterval(scanTimerId)
      scanTimerId = null
    }
    wasScanning = false
    scanStartedAt = null
    if (scanElapsedText) scanElapsedText.textContent = "—"
  }
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
      portInput.value = String(item.port)
      log(`Selected ${item.ip}:${item.port}`)
    }
    if (idx === 0 && !selectedReader) {
      selectedReader = item
      portInput.value = String(item.port)
    }
    readersEl.appendChild(btn)
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderAggregateTable(entries) {
  const list = Array.isArray(entries) ? entries : []
  tagsBody.innerHTML = ""
  for (const row of list) {
    const tr = document.createElement("tr")
    const last = new Date(row.lastSeen || Date.now()).toLocaleTimeString()
    const epc = escapeHtml(row.epc || "")
    const rip = escapeHtml(String(row.readerIp || ""))
    const erp = row.erpOk ? "OK" : "—"
    tr.innerHTML = `<td><strong>${Number(row.count) || 0}</strong></td><td>${last}</td><td class="epc-cell" title="${epc}">${epc}</td><td>${rip}:${row.readerPort || 0}</td><td>${erp}</td>`
    tagsBody.appendChild(tr)
  }
}

async function bootstrap() {
  const cfg = await window.rfidApp.getConfig()
  subnetInput.value = cfg.subnet || "192.168.18"
  manualIpInput.value = cfg.lastReaderIp || ""
  portInput.value = String(cfg.readerPort || 9090)
  if (cfg.localSubnet && cfg.subnet && String(cfg.localSubnet) !== String(cfg.subnet)) {
    log(`Tip: this PC is on ${cfg.localSubnet}.x — if search finds nothing, align Subnet or set Reader IP.`)
  }

  const state = await window.rfidApp.getState()
  setStatus(state.status)
  uniqueText.textContent = String(state.counters.unique || 0)
  readsText.textContent = String(state.counters.reads || 0)
  renderAggregateTable(state.aggregates || [])
}

searchBtn.onclick = async () => {
  const subnet = subnetInput.value.trim()
  const port = Number(portInput.value || 9090)
  await window.rfidApp.setConfig({ subnet, readerPort: port })
  log(`Searching ${subnet}…`)
  const readers = await window.rfidApp.searchReaders({ subnet, port })
  renderReaders(readers)
  log(`Found ${readers.length} reader(s). Pick one, then Connect.`)
}

manualIpInput.addEventListener("blur", async () => {
  const v = manualIpInput.value.trim()
  await window.rfidApp.setConfig({ lastReaderIp: v })
})

connectBtn.onclick = async () => {
  const fromList = selectedReader?.port
  const port = Number.isFinite(Number(fromList)) ? Number(fromList) : Number(portInput.value || 9090)
  const manual = (manualIpInput.value || "").trim()
  const ip = manual || selectedReader?.ip
  if (!ip) {
    log("Pick a reader from the list after Search, or type Reader IP, then Connect.")
    return
  }
  try {
    await window.rfidApp.disconnectReader()
    const status = await window.rfidApp.connectReader({ ip, port })
    setStatus(status)
    log(`TCP connected to ${ip}:${port}`)
    const started = await window.rfidApp.startScan()
    setStatus(started)
    if (started.connected && started.scanning) log("Scanning — tags will appear when tags are in range.")
    else if (started.connected) log("Connected. Use Start Scan if tags do not appear.")
    else log("Unexpected state after connect.")
  } catch (err) {
    log(`Connect failed: ${err?.message || err}`)
    const st = await window.rfidApp.getState()
    setStatus(st.status)
  }
}

disconnectBtn.onclick = async () => {
  const status = await window.rfidApp.disconnectReader()
  setStatus(status)
  renderAggregateTable([])
  log("Disconnected.")
}

startBtn.onclick = async () => {
  try {
    const status = await window.rfidApp.startScan()
    setStatus(status)
    if (!status.connected) log("No reader session. Connect first.")
    else if (!status.scanning) log("Start scan did not enable scanning.")
    else log("Scanning.")
  } catch (err) {
    log(String(err?.message || err))
  }
}

stopBtn.onclick = async () => {
  const status = await window.rfidApp.stopScan()
  setStatus(status)
  log("Scan stopped.")
}

clearTagsBtn.onclick = async () => {
  try {
    await window.rfidApp.clearTags()
    const st = await window.rfidApp.getState()
    uniqueText.textContent = String(st.counters.unique || 0)
    readsText.textContent = String(st.counters.reads || 0)
    renderAggregateTable(st.aggregates || [])
    setStatus(st.status)
    log("Tags and scan counters cleared (reader session unchanged).")
  } catch (err) {
    log(`Clear tags failed: ${err?.message || err}`)
  }
}

window.rfidApp.onStatus((status) => {
  setStatus(status)
})

window.rfidApp.onCounters((counters) => {
  uniqueText.textContent = String(counters.unique || 0)
  readsText.textContent = String(counters.reads || 0)
})

window.rfidApp.onAggregate(({ entries }) => {
  renderAggregateTable(entries)
})

bootstrap().catch((err) => log(`Init error: ${err.message}`))
