const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { app, BrowserWindow, ipcMain, clipboard } = require("electron")

/** Best-effort: USB keyboard / HID class devices (UD‑10 wedge readers usually appear here). */
function probeUsbHidDevices() {
  if (process.platform !== "win32") {
    return {
      ok: true,
      text: "Automated USB listing runs on Windows only. Elsewhere, check System Settings / Device Manager for a HID or keyboard device when the reader is plugged in."
    }
  }
  const cmd = `
$ErrorActionPreference = 'SilentlyContinue'
$d = Get-PnpDevice -PresentOnly | Where-Object {
  $_.Status -eq 'OK' -and $_.InstanceId -match 'USB' -and (
    $_.Class -eq 'Keyboard' -or $_.Class -eq 'HIDClass' -or
    $_.FriendlyName -match 'keyboard|Keyboard|HID|Input Device|RFID|Reader'
  )
}
$d | Select-Object -First 50 FriendlyName, Class, InstanceId | Format-Table -AutoSize | Out-String -Width 220
`.trim()
  try {
    const text = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
      maxBuffer: 512 * 1024
    })
    const trimmed = String(text || "").trim()
    return { ok: true, text: trimmed || "(no USB keyboard/HID rows — plug the reader, wait a few seconds, Refresh)" }
  } catch (err) {
    return { ok: false, text: "", error: err.message || "probe_failed" }
  }
}

let win = null

/** Main-process wedge: works even when a textarea has focus (renderer capture does not). */
let readerCatchEnabled = true
let acceptAnyHexMain = false
let wedgeBuffer = ""
let wedgeDebounceTimer = null

function normalizeHexBuf(s) {
  return String(s || "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
}

function shouldAutoFlushWedge(h) {
  if (!/^[0-9A-F]+$/.test(h) || h.length % 2 !== 0 || h.length < 8 || h.length > 64) return false
  if (acceptAnyHexMain) {
    if (h.length === 24 || h.length === 32) return true
    return h.length >= 8
  }
  if (!/^E2[0-9A-F]+$/.test(h)) return false
  if (h.length === 24 || h.length === 32) return true
  if (h.length < 24) return true
  return false
}

function flushWedgeBufferToRenderer(w, clearDebounce) {
  if (clearDebounce) {
    if (wedgeDebounceTimer) {
      clearTimeout(wedgeDebounceTimer)
      wedgeDebounceTimer = null
    }
  }
  const line = wedgeBuffer.trim()
  wedgeBuffer = ""
  if (!line || w.isDestroyed()) return
  w.webContents.send("wedge:reader-line", line)
}

function scheduleWedgeAutoFlush(w) {
  if (wedgeDebounceTimer) clearTimeout(wedgeDebounceTimer)
  wedgeDebounceTimer = setTimeout(() => {
    wedgeDebounceTimer = null
    if (!readerCatchEnabled || w.isDestroyed()) return
    const h = normalizeHexBuf(wedgeBuffer)
    if (shouldAutoFlushWedge(h)) flushWedgeBufferToRenderer(w, false)
  }, 420)
}

function attachKeyboardWedgeCatch(w) {
  w.webContents.on("before-input-event", (event, input) => {
    if (!readerCatchEnabled || w.isDestroyed()) return
    if (input.type !== "keyDown") return
    if (input.control || input.meta || input.alt) return

    if (input.key === "Enter" || input.key === "NumpadEnter" || input.code === "Enter" || input.code === "NumpadEnter") {
      if (!wedgeBuffer.trim()) return
      event.preventDefault()
      flushWedgeBufferToRenderer(w, true)
      return
    }
    if (input.key === "Tab") {
      if (!wedgeBuffer.trim()) return
      event.preventDefault()
      flushWedgeBufferToRenderer(w, true)
      return
    }
    if (input.key === "Backspace") {
      event.preventDefault()
      wedgeBuffer = wedgeBuffer.slice(0, -1)
      scheduleWedgeAutoFlush(w)
      return
    }
    if (input.key === "Escape") {
      event.preventDefault()
      wedgeBuffer = ""
      if (wedgeDebounceTimer) {
        clearTimeout(wedgeDebounceTimer)
        wedgeDebounceTimer = null
      }
      return
    }
    if (input.key.length === 1) {
      const ch = input.key
      if (ch === " ") return
      if (ch >= " " && ch <= "~") {
        event.preventDefault()
        wedgeBuffer += ch
        if (wedgeBuffer.length > 200) wedgeBuffer = wedgeBuffer.slice(-200)
        scheduleWedgeAutoFlush(w)
      }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  attachKeyboardWedgeCatch(win)
  win.loadFile(path.join(__dirname, "index.html"))
}

ipcMain.handle("wedge:set-reader-catch", async (_e, payload) => {
  if (payload !== null && typeof payload === "object") {
    if ("enabled" in payload) readerCatchEnabled = Boolean(payload.enabled)
    if ("acceptAnyHex" in payload) acceptAnyHexMain = Boolean(payload.acceptAnyHex)
  } else {
    readerCatchEnabled = Boolean(payload)
  }
  if (!readerCatchEnabled) {
    wedgeBuffer = ""
    if (wedgeDebounceTimer) {
      clearTimeout(wedgeDebounceTimer)
      wedgeDebounceTimer = null
    }
  }
  return { ok: true, readerCatchEnabled, acceptAnyHexMain }
})

ipcMain.handle("wedge:copy", async (_e, text) => {
  clipboard.writeText(String(text || ""))
  return { ok: true }
})

ipcMain.handle("wedge:probe-usb", async () => probeUsbHidDevices())

ipcMain.handle("wedge:post-erp", async (_e, payload) => {
  const u = String(payload?.url || "").trim()
  if (!u) return { ok: false, error: "missing_url" }
  const epc = String(payload?.epc || "").toUpperCase()
  const body = {
    epc,
    reader_ip: "USB-HID-WEDGE",
    reader_port: 0,
    protocol: "RFID_USB_WEDGE"
  }
  const name = String(payload?.productName || "").trim()
  const sku = String(payload?.sku || "").trim()
  const notes = String(payload?.notes || "").trim()
  const internalBarcode = String(payload?.internalBarcode || "").trim()
  const productId = String(payload?.productId || "").trim()
  if (name) body.product_name = name
  if (productId) body.product_id = productId
  if (sku) body.sku = sku
  if (notes) body.notes = notes
  if (internalBarcode) body.internal_barcode = internalBarcode
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message || "fetch_failed" }
  }
})

app.whenReady().then(createWindow)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
