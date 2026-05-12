const DEFAULT_ERP = "https://voltrixbatteries.com/api/rfid/scanner/scan"
const REGISTRY_KEY = "wedgeTagRegistryV1"

const capture = document.getElementById("capture")
const tagEmpty = document.getElementById("tagEmpty")
const tagPresent = document.getElementById("tagPresent")
const epcDisplay = document.getElementById("epcDisplay")
const tagHexLen = document.getElementById("tagHexLen")
const tagBits = document.getElementById("tagBits")
const tagFamily = document.getElementById("tagFamily")
const hint = document.getElementById("hint")
const wedgeDiag = document.getElementById("wedgeDiag")
const receiveLog = document.getElementById("receiveLog")
const scanFocusSink = document.getElementById("scanFocusSink")
const inventoryBody = document.getElementById("inventoryBody")
const inventoryEmpty = document.getElementById("inventoryEmpty")
const lastReadDetail = document.getElementById("lastReadDetail")
const acceptAnyHex = document.getElementById("acceptAnyHex")
const btnReadArm = document.getElementById("btnReadArm")
const btnTestScan = document.getElementById("btnTestScan")
const btnClearInventory = document.getElementById("btnClearInventory")
const manualEpcInput = document.getElementById("manualEpcInput")
const btnManualEpc = document.getElementById("btnManualEpc")
const btnPasteFromClipboard = document.getElementById("btnPasteFromClipboard")

const linkPanel = document.getElementById("linkPanel")
const editBanner = document.getElementById("editBanner")
const fieldName = document.getElementById("fieldName")
const fieldProductId = document.getElementById("fieldProductId")
const fieldSku = document.getElementById("fieldSku")
const fieldNotes = document.getElementById("fieldNotes")
const fieldBarcode = document.getElementById("fieldBarcode")
const btnEditProduct = document.getElementById("btnEditProduct")
const btnResumeListen = document.getElementById("btnResumeListen")
const btnSaveLink = document.getElementById("btnSaveLink")
const btnSkipLink = document.getElementById("btnSkipLink")
const btnDiscardTag = document.getElementById("btnDiscardTag")

const usbHeadline = document.getElementById("usbHeadline")
const usbSub = document.getElementById("usbSub")
const usbPill = document.getElementById("usbPill")
const btnUsbRefresh = document.getElementById("btnUsbRefresh")
const usbProbeOut = document.getElementById("usbProbeOut")
const webhidNote = document.getElementById("webhidNote")

const syncErp = document.getElementById("syncErp")
const erpUrl = document.getElementById("erpUrl")
const registryBody = document.getElementById("registryBody")
const registryEmpty = document.getElementById("registryEmpty")
const stats = document.getElementById("stats")
const list = document.getElementById("list")
const btnClear = document.getElementById("btnClear")
const btnExport = document.getElementById("btnExport")
const btnClearRegistry = document.getElementById("btnClearRegistry")

const tabScan = document.getElementById("tabScan")
const tabSaved = document.getElementById("tabSaved")

const productFields = [fieldName, fieldProductId, fieldSku, fieldNotes, fieldBarcode]

erpUrl.value = localStorage.getItem("wedgeErpUrl") || DEFAULT_ERP
syncErp.checked = localStorage.getItem("wedgeSyncErp") === "1"
acceptAnyHex.checked = localStorage.getItem("wedgeAcceptAnyHex") === "1"

function savePrefs() {
  localStorage.setItem("wedgeErpUrl", erpUrl.value.trim())
  localStorage.setItem("wedgeSyncErp", syncErp.checked ? "1" : "0")
  localStorage.setItem("wedgeAcceptAnyHex", acceptAnyHex.checked ? "1" : "0")
}

erpUrl.addEventListener("change", savePrefs)
syncErp.addEventListener("change", savePrefs)
erpUrl.addEventListener("focus", () => {
  void syncReaderCatch(false)
})
erpUrl.addEventListener("blur", () => {
  void resyncReaderCatchFromUi()
})
acceptAnyHex.addEventListener("change", () => {
  savePrefs()
  void resyncReaderCatchFromUi()
})

function submitManualEpc() {
  if (editingProducts) {
    hint.textContent = "Finish product details or tap “Back to scanning” before adding another tag."
    hint.className = "hint err"
    return
  }
  const raw = manualEpcInput?.value?.trim() ?? ""
  if (!raw) {
    hint.textContent = "Paste or type the EPC / hex, then tap Add."
    hint.className = "hint err"
    return
  }
  receiveLogAppend(`${logTimestamp()}  Command:ManualEntry  Status:Success`)
  processOneRaw(raw)
  if (manualEpcInput) manualEpcInput.value = ""
  focusScanSink()
  void resyncReaderCatchFromUi()
}

if (manualEpcInput) {
  manualEpcInput.addEventListener("focus", () => {
    void syncReaderCatch(false)
  })
  manualEpcInput.addEventListener("blur", () => {
    void resyncReaderCatchFromUi()
  })
  manualEpcInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submitManualEpc()
    }
  })
}

btnManualEpc?.addEventListener("click", () => {
  submitManualEpc()
})

btnPasteFromClipboard?.addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText()
    if (manualEpcInput) manualEpcInput.value = String(t || "").trim()
    manualEpcInput?.focus()
  } catch (_e) {
    hint.textContent = "Clipboard blocked — use Ctrl+V in the field."
    hint.className = "hint err"
  }
})

/** Keystroke wedge is handled in the Electron main process (see main.js) + IPC wedge:reader-line. */
let editingProducts = false
/** @type {string | null} */
let pendingEpc = null

/** @type {{ epc: string, mode: string, ts: string, rawPreview: string, no: number, cnt: number } | null} */
let lastSuccessSnapshot = null

/** @type {Map<string, { epc: string, cnt: number, lastAt: number }>} */
const inventoryByEpc = new Map()

function renderLastReadDetail() {
  if (!lastReadDetail) return
  if (!lastSuccessSnapshot) {
    lastReadDetail.classList.add("hidden")
    lastReadDetail.innerHTML = ""
    return
  }
  const { epc, mode, ts, rawPreview, no, cnt } = lastSuccessSnapshot
  const fam = describeTagFamily(epc)
  lastReadDetail.classList.remove("hidden")
  lastReadDetail.innerHTML = `
    <p class="kicker">Last successful TagRead</p>
    <div class="epc-mono">${escapeHtml(epc)}</div>
    <dl class="tag-dl tag-dl-inline">
      <div><dt>No.</dt><dd>${no}</dd></div>
      <div><dt>PC</dt><dd>—</dd></div>
      <div><dt>CRC</dt><dd>—</dd></div>
      <div><dt>Cnt</dt><dd>${cnt}</dd></div>
      <div><dt>Hex length</dt><dd>${epc.length}</dd></div>
      <div><dt>Bits</dt><dd>${epc.length * 4}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(fam)}</dd></div>
      <div><dt>Mode</dt><dd>${escapeHtml(mode)}</dd></div>
    </dl>
    <p class="last-read-meta">Time: ${escapeHtml(ts)}</p>
    <p class="last-read-meta">Raw line: <code>${escapeHtml(rawPreview)}</code></p>
  `
}

function logTimestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

function receiveLogAppend(line) {
  if (!receiveLog) return
  receiveLog.textContent = `${receiveLog.textContent}${line}\n`.slice(-120000)
  receiveLog.scrollTop = receiveLog.scrollHeight
}

function focusScanSink() {
  try {
    scanFocusSink?.focus()
  } catch (_e) {
    /* ignore */
  }
}

async function syncReaderCatch(enabled) {
  try {
    if (window.wedgeApp?.setReaderCatch) {
      await window.wedgeApp.setReaderCatch({
        enabled,
        acceptAnyHex: acceptAnyHex.checked
      })
    }
  } catch (_e) {
    /* ignore */
  }
}

async function resyncReaderCatchFromUi() {
  if (editingProducts) await syncReaderCatch(false)
  else if (document.activeElement === erpUrl || document.activeElement === manualEpcInput) await syncReaderCatch(false)
  else await syncReaderCatch(true)
}

function normalizeHex(s) {
  return String(s || "")
    .replace(/[\s\r\n\t\u0000]/g, "")
    .replace(/[^0-9A-Fa-f]/g, "")
    .toUpperCase()
}

function stripWedgePrefix(s) {
  let t = String(s || "").trim()
  t = t.replace(/^(EPC|TAG|UID|DATA|RFID)[:#=>\s]*/i, "")
  t = t.replace(/^0x/i, "")
  return t.trim()
}

function validateEpc(hex) {
  const h = normalizeHex(hex)
  if (h.length < 8 || h.length % 2 !== 0 || h.length > 64) return { ok: false, hex: h, reason: "length" }
  if (!h.startsWith("E2") || !/^E2[0-9A-F]*$/.test(h)) return { ok: false, hex: h, reason: "format" }
  if (h.length === 24 || h.length === 32) return { ok: true, hex: h }
  if (h.length < 24) return { ok: true, hex: h }
  return { ok: false, hex: h, reason: "e2_len" }
}

function validateGenericHexPayload(hex) {
  const h = normalizeHex(hex)
  if (h.length < 8 || h.length % 2 !== 0 || h.length > 64) return { ok: false, hex: h, reason: "length" }
  if (!/^[0-9A-F]+$/.test(h)) return { ok: false, hex: h, reason: "length" }
  return { ok: true, hex: h }
}

function describeTagFamily(hex) {
  if (hex.startsWith("E280")) return "URI-style 96-bit (common)"
  if (hex.startsWith("E2")) return "EPC URI (Gen2)"
  try {
    const pairs = hex.match(/.{2}/g)
    if (!pairs) return "Hex payload"
    const bytes = pairs.map((x) => parseInt(x, 16))
    if (bytes.every((b) => b >= 32 && b <= 126)) {
      const ascii = String.fromCharCode(...bytes)
      return `ASCII payload (${ascii.slice(0, 28)}${ascii.length > 28 ? "…" : ""})`
    }
  } catch (_e) {
    /* ignore */
  }
  return "Hex payload"
}

function setFieldsReadonly(ro) {
  for (const el of productFields) {
    el.readOnly = ro
    el.placeholder = ro ? "Unlock with button below…" : ""
  }
}

function updateSaveEnabled() {
  if (!editingProducts) {
    btnSaveLink.disabled = true
    return
  }
  const ok = fieldName.value.trim() && fieldProductId.value.trim() && fieldSku.value.trim()
  btnSaveLink.disabled = !ok
}

productFields.forEach((el) => el.addEventListener("input", updateSaveEnabled))

async function setListeningCapture() {
  editingProducts = false
  await syncReaderCatch(true)
  setFieldsReadonly(true)
  capture.disabled = true
  capture.value = ""
  btnEditProduct.classList.remove("hidden")
  btnResumeListen.classList.add("hidden")
  editBanner.classList.add("hidden")
  fieldName.placeholder = "Unlock with button below…"
  updateSaveEnabled()
}

async function setEditingProducts() {
  editingProducts = true
  await syncReaderCatch(false)
  capture.value = ""
  setFieldsReadonly(false)
  fieldName.placeholder = ""
  btnEditProduct.classList.add("hidden")
  btnResumeListen.classList.remove("hidden")
  editBanner.classList.remove("hidden")
  updateSaveEnabled()
  fieldName.focus()
}

function updateTagUi() {
  const has = Boolean(pendingEpc)
  tagPresent.classList.toggle("hidden", !has)
  tagEmpty.classList.toggle("hidden", has)
  linkPanel.classList.toggle("hidden", !has)
  renderInventoryTable()
}

function fillTag(epc) {
  epcDisplay.textContent = epc
  tagHexLen.textContent = String(epc.length)
  tagBits.textContent = String(epc.length * 4)
  tagFamily.textContent = describeTagFamily(epc)
}

function clearProductFields() {
  for (const el of productFields) el.value = ""
}

function applyRegistryToFields(epc) {
  clearProductFields()
  const reg = loadRegistry().find((x) => x.epc === epc)
  if (!reg) return
  fieldName.value = reg.productName || ""
  fieldProductId.value = reg.productId || ""
  fieldSku.value = reg.sku || ""
  fieldNotes.value = reg.notes || ""
  fieldBarcode.value = reg.internalBarcode || ""
}

function recordInventoryRow(epc) {
  const prev = inventoryByEpc.get(epc)
  const now = Date.now()
  if (prev) {
    prev.cnt += 1
    prev.lastAt = now
  } else {
    inventoryByEpc.set(epc, { epc, cnt: 1, lastAt: now })
  }
  renderInventoryTable()
}

function renderInventoryTable() {
  if (!inventoryBody) return
  const rows = [...inventoryByEpc.values()].sort((a, b) => b.lastAt - a.lastAt)
  inventoryBody.innerHTML = ""
  if (!rows.length) {
    inventoryEmpty.classList.remove("hidden")
    return
  }
  inventoryEmpty.classList.add("hidden")
  rows.forEach((r, i) => {
    const tr = document.createElement("tr")
    if (pendingEpc === r.epc) tr.classList.add("row-selected")
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="muted">—</td>
      <td class="mono">${escapeHtml(r.epc)}</td>
      <td class="muted">—</td>
      <td>${r.cnt}</td>
      <td><button type="button" class="btn-link" data-link-epc="${escapeAttr(r.epc)}">Link</button></td>
    `
    inventoryBody.appendChild(tr)
  })
}

function selectTagForLink(epc) {
  pendingEpc = epc
  fillTag(epc)
  applyRegistryToFields(epc)
  updateTagUi()
  hint.textContent = "Tag selected — enter product details or Save if fields are already filled."
  hint.className = "hint ok"
}

function resolveScanPayload(stripped) {
  const gen2 = validateEpc(stripped)
  if (gen2.ok) return { ok: true, hex: gen2.hex, mode: "gen2" }
  if (acceptAnyHex.checked) {
    const any = validateGenericHexPayload(stripped)
    if (any.ok) return { ok: true, hex: any.hex, mode: "hex" }
    return { ok: false, reason: any.reason || "length", hex: any.hex }
  }
  return { ok: false, reason: gen2.reason, hex: gen2.hex }
}

async function onValidScan(hex) {
  if (editingProducts) {
    hint.textContent = "Scan ignored while editing — tap “Back to scanning” first."
    hint.className = "hint err"
    return
  }
  capture.value = ""
  pendingEpc = hex
  fillTag(hex)
  if (!editingProducts) applyRegistryToFields(hex)
  updateTagUi()
  await setListeningCapture()
  hint.textContent = "Tag read — row in the table above; full fields in “Last successful TagRead”. Use Link to attach a product."
  hint.className = "hint ok"
}

function processOneRaw(rawLine) {
  const stripped = stripWedgePrefix(rawLine)
  const res = resolveScanPayload(stripped)
  const ts = logTimestamp()
  const dataPreview = normalizeHex(stripped).slice(0, 96) || stripped.slice(0, 64)

  if (!res.ok) {
    receiveLogAppend(`${ts}  Command:TagRead  Status:Failure  DataText:${dataPreview}  Reason:${res.reason}`)
    hint.textContent =
      res.reason === "length"
        ? "Payload is not valid hex length (8–64 chars, even length). Enable “Accept any hex” for non‑E2 tags."
        : res.reason === "format"
          ? "Not a Gen2 E2… EPC. Enable “Accept any hex” for raw hex payloads (e.g. ASCII EPC in hex)."
          : "Payload length is not supported for ERP-style EPC."
    hint.className = "hint err"
    if (wedgeDiag) {
      wedgeDiag.textContent = `Last raw (${String(rawLine).length} chars): ${String(rawLine).slice(0, 120)}${String(rawLine).length > 120 ? "…" : ""}`
    }
    return
  }

  receiveLogAppend(`${ts}  Command:TagRead  Status:Success  DataText:${res.hex}  Mode:${res.mode}`)
  if (wedgeDiag) {
    wedgeDiag.textContent = `Last raw (${String(rawLine).length} chars): ${String(rawLine).slice(0, 160)}${String(rawLine).length > 160 ? "…" : ""}`
  }
  recordInventoryRow(res.hex)
  const row = inventoryByEpc.get(res.hex)
  const sorted = [...inventoryByEpc.values()].sort((a, b) => b.lastAt - a.lastAt)
  const no = sorted.findIndex((r) => r.epc === res.hex) + 1
  lastSuccessSnapshot = {
    epc: res.hex,
    mode: res.mode,
    ts,
    rawPreview: String(rawLine).slice(0, 160),
    no,
    cnt: row ? row.cnt : 1
  }
  renderLastReadDetail()
  void onValidScan(res.hex)
}

btnEditProduct.addEventListener("click", () => {
  if (!pendingEpc) return
  void setEditingProducts()
})

btnResumeListen.addEventListener("click", () => {
  void setListeningCapture()
  hint.textContent = "Listening for reader again."
  hint.className = "hint ok"
})

btnDiscardTag.addEventListener("click", () => {
  pendingEpc = null
  capture.value = ""
  clearProductFields()
  updateTagUi()
  void setListeningCapture()
  hint.textContent = "Selection cleared. Scan again or pick a row."
  hint.className = "hint ok"
})

btnSkipLink.addEventListener("click", () => {
  if (!pendingEpc) return
  pushSessionLog(pendingEpc, "EPC only")
  pendingEpc = null
  capture.value = ""
  clearProductFields()
  updateTagUi()
  void setListeningCapture()
  receiveLogAppend(`${logTimestamp()}  Command:SkipLink  Status:Success`)
  hint.textContent = "EPC logged (no product). Next tag…"
  hint.className = "hint ok"
})

btnSaveLink.addEventListener("click", async () => {
  if (!pendingEpc || !editingProducts) return
  const productName = fieldName.value.trim()
  const productId = fieldProductId.value.trim()
  const sku = fieldSku.value.trim()
  const notes = fieldNotes.value.trim()
  const internalBarcode = fieldBarcode.value.trim()
  if (!productName || !productId || !sku) return

  const entry = {
    epc: pendingEpc,
    productName,
    productId,
    sku,
    notes,
    internalBarcode,
    linkedAt: new Date().toISOString(),
    erpOk: null
  }

  let erpLabel = "local"
  if (syncErp.checked && window.wedgeApp?.postErp) {
    const url = erpUrl.value.trim() || DEFAULT_ERP
    const res = await window.wedgeApp.postErp({
      url,
      epc: pendingEpc,
      productName,
      productId,
      sku,
      notes,
      internalBarcode
    })
    entry.erpOk = res.ok
    erpLabel = res.ok ? "ERP OK" : `ERP ${res.status || res.error || "fail"}`
    receiveLogAppend(
      `${logTimestamp()}  Command:PostErp  Status:${res.ok ? "Success" : "Failure"}${res.ok ? "" : `  HTTP:${res.status || res.error || ""}`}`
    )
  }

  upsertRegistry(entry)
  pushSessionLog(pendingEpc, erpLabel)
  pendingEpc = null
  capture.value = ""
  clearProductFields()
  updateTagUi()
  void setListeningCapture()
  hint.textContent = "Saved. Ready for the next tag."
  hint.className = "hint ok"
})

btnReadArm.addEventListener("click", () => {
  receiveLogAppend(`${logTimestamp()}  Command:ArmListen  Status:Success`)
  hint.textContent =
    "“Read single” only arms listening — it is not a tag read. The table fills when Receive data shows TagRead (keyboard wedge) or after Test scan."
  hint.className = "hint ok"
  focusScanSink()
})

/** Demo 96-bit style EPC so you can confirm inventory + log without keyboard wedge hardware. */
const DEMO_SCAN_LINE = "E28011000000000000000001"

btnTestScan.addEventListener("click", () => {
  receiveLogAppend(`${logTimestamp()}  Command:TestScan  Status:Success`)
  processOneRaw(DEMO_SCAN_LINE)
  focusScanSink()
})

btnClearInventory.addEventListener("click", () => {
  if (!confirm("Clear session inventory table? (Saved links are not deleted.)")) return
  inventoryByEpc.clear()
  lastSuccessSnapshot = null
  renderLastReadDetail()
  pendingEpc = null
  clearProductFields()
  updateTagUi()
  void setListeningCapture()
  receiveLogAppend(`${logTimestamp()}  Command:ClearInventory  Status:Success`)
  hint.textContent = "Inventory table cleared."
  hint.className = "hint ok"
})

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-tab")
    document.querySelectorAll(".tab").forEach((b) => {
      const on = b.getAttribute("data-tab") === id
      b.classList.toggle("active", on)
      b.setAttribute("aria-selected", on ? "true" : "false")
    })
    tabScan.classList.toggle("hidden", id !== "scan")
    tabSaved.classList.toggle("hidden", id !== "saved")
    if (id === "scan") {
      if (document.activeElement && tabSaved.contains(document.activeElement)) {
        document.activeElement.blur()
      }
      focusScanSink()
    }
  })
})

if (inventoryBody) {
  inventoryBody.addEventListener("click", (ev) => {
    const t = ev.target
    if (!(t instanceof HTMLElement)) return
    const ep = t.getAttribute("data-link-epc")
    if (!ep) return
    selectTagForLink(ep)
  })
}

function summarizeUsbList(text) {
  const t = String(text || "").trim()
  if (!t) return { level: "warn", headline: "No matching USB rows", sub: "Plug the reader, wait a few seconds, then Refresh." }
  const rows = t.split("\n").filter((line) => /USB\\/i.test(line) && /HIDClass|Keyboard|Reader|RFID|Input/i.test(line))
  if (rows.length)
    return {
      level: "ok",
      headline: "USB HID path looks active",
      sub: `${rows.length} matching row(s). Wedge readers often show as “USB Input Device” (HIDClass).`
    }
  if (/USB\\/i.test(t)) return { level: "warn", headline: "USB devices present", sub: "Could not classify as HID/keyboard — reader may still work." }
  return { level: "warn", headline: "Unclear USB list", sub: "Refresh after plugging the reader." }
}

async function refreshUsbProbe() {
  usbPill.textContent = "…"
  usbPill.className = "pill pill-muted"
  usbHeadline.textContent = "Checking…"
  usbSub.textContent = ""
  usbProbeOut.textContent = ""
  if (!window.wedgeApp?.probeUsb) {
    usbPill.textContent = "N/A"
    usbPill.className = "pill pill-warn"
    usbHeadline.textContent = "USB probe unavailable"
    return
  }
  const r = await window.wedgeApp.probeUsb()
  if (!r.ok) {
    usbPill.textContent = "Error"
    usbPill.className = "pill pill-bad"
    usbHeadline.textContent = "Could not read device list"
    usbSub.textContent = String(r.error || "PowerShell error")
    usbProbeOut.textContent = (r.text || "").trim()
    return
  }
  usbProbeOut.textContent = r.text
  const s = summarizeUsbList(r.text)
  usbHeadline.textContent = s.headline
  usbSub.textContent = s.sub
  if (s.level === "ok") {
    usbPill.textContent = "Likely OK"
    usbPill.className = "pill pill-ok"
  } else {
    usbPill.textContent = "Check"
    usbPill.className = "pill pill-warn"
  }

  if (navigator.hid) {
    try {
      const hd = await navigator.hid.getDevices()
      webhidNote.textContent =
        hd.length > 0 ? `WebHID (optional): ${hd.length} allowed device(s).` : ""
    } catch (_e) {
      webhidNote.textContent = ""
    }
  }
}

btnUsbRefresh.addEventListener("click", () => {
  void (async () => {
    await syncReaderCatch(false)
    await refreshUsbProbe()
    await resyncReaderCatchFromUi()
  })()
})

function loadRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr : []
  } catch (_e) {
    return []
  }
}

function saveRegistry(rows) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(rows))
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
}

function renderRegistry() {
  const rows = loadRegistry()
  registryBody.innerHTML = ""
  if (!rows.length) {
    registryEmpty.classList.remove("hidden")
    return
  }
  registryEmpty.classList.add("hidden")
  for (const r of rows) {
    const tr = document.createElement("tr")
    tr.innerHTML = `
      <td class="mono">${escapeHtml(r.epc)}</td>
      <td>${escapeHtml(r.productName || "—")}</td>
      <td>${escapeHtml(r.productId || "—")}</td>
      <td>${escapeHtml(r.sku || "—")}</td>
      <td>${escapeHtml(new Date(r.linkedAt).toLocaleString())}</td>
      <td><button type="button" data-copy="${escapeAttr(r.epc)}">Copy</button></td>
    `
    registryBody.appendChild(tr)
  }
  registryBody.querySelectorAll("button[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-copy")
      if (v && window.wedgeApp?.copy) window.wedgeApp.copy(v)
    })
  })
}

function upsertRegistry(entry) {
  const r = loadRegistry()
  const i = r.findIndex((x) => x.epc === entry.epc)
  if (i >= 0) r[i] = entry
  else r.unshift(entry)
  saveRegistry(r)
  renderRegistry()
}

let scanCount = 0
function pushSessionLog(hex, label) {
  const li = document.createElement("li")
  li.innerHTML = `<span>${escapeHtml(hex)}</span> <span class="badge">${escapeHtml(label)}</span>`
  list.prepend(li)
  scanCount += 1
  stats.textContent = `Session events: ${scanCount}`
}

btnClear.addEventListener("click", () => {
  list.innerHTML = ""
  scanCount = 0
  stats.textContent = "Session events: 0"
})

btnExport.addEventListener("click", () => {
  const rows = loadRegistry()
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `voltrix-rfid-registry-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
})

btnClearRegistry.addEventListener("click", () => {
  if (!confirm("Delete all saved links on this computer?")) return
  localStorage.removeItem(REGISTRY_KEY)
  renderRegistry()
})

window.addEventListener("load", async () => {
  if (window.wedgeApp?.onReaderLine) {
    window.wedgeApp.onReaderLine((line) => {
      processOneRaw(line)
    })
  }
  if (wedgeDiag) wedgeDiag.textContent = "Raw wedge lines and parse errors appear here when expanded."
  receiveLogAppend(`${logTimestamp()}  App:Ready  Status:Success`)
  renderRegistry()
  updateTagUi()
  await refreshUsbProbe()
  await setListeningCapture()
  focusScanSink()
})
