const net = require("node:net")

/** Hopeland "Data Communication Protocol" — frame head 0xAA (not Impinj 0xA0). */
const HOPELAND_STOP = Buffer.from("AA02FF0000A40F", "hex")
/** MID 0x10 read EPC: antenna 1 + continuous inventory (manual example). */
const HOPELAND_INVENTORY_ANT1 = Buffer.from("AA02100002010171AD", "hex")

function normalizeReaderIp(addr) {
  if (!addr) return ""
  const s = String(addr).trim()
  return s.replace(/^::ffff:/i, "")
}

/** Substrings that appear in TID / PC / Hopeland framing concatenated into TCP dumps — not EPC bank. */
function looksLikeProtocolGarbage(hexUpper) {
  const u = String(hexUpper || "").toUpperCase()
  if (u.includes("AA12")) return true
  if (u.includes("AA10")) return true
  if (u.includes("30000101")) return true
  if (u.includes("07459863")) return true
  return false
}

/**
 * Accept 96-bit **non-URI** EPC keys (24 hex) other than `E2…`.
 * We only allow GS1 binary header range **0x30–0x3F** (first byte). Broader patterns
 * (`41…` ASCII user memory, `69…`/`80…` sliding slices of `E280…`, `53…` TID debris)
 * matched Hopeland’s TCP stream and exploded unique-tag counts.
 */
function acceptNonE2Inventory24(u) {
  const s = String(u || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  if (s.length !== 24) return false
  if (s.startsWith("E2")) return false
  if (looksLikeProtocolGarbage(s)) return false
  if (s.startsWith("3000") || s.startsWith("3001")) return false
  return /^3[0-9A-F]{23}$/.test(s)
}

/** 96-bit EPCs after Hopeland frame marker — avoids random 24-hex noise elsewhere in the TCP stream. */
function extractNonE2NearAa12(cleanHex) {
  const out = new Set()
  const c = String(cleanHex || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  let pos = 0
  while ((pos = c.indexOf("AA12", pos)) !== -1) {
    const seg = c.slice(pos, pos + 160)
    for (let i = 0; i + 24 <= seg.length; i += 2) {
      const w = seg.slice(i, i + 24)
      if (acceptNonE2Inventory24(w)) out.add(w)
    }
    pos += 4
  }
  return [...out]
}

function acceptInventoryEpcKey(epc) {
  const u = String(epc || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  if (u.length < 8 || u.length % 2 !== 0) return false
  if (looksLikeProtocolGarbage(u)) return false
  if (u.length > 32) return false
  if (!/^[0-9A-F]+$/.test(u)) return false
  if (u.startsWith("E2")) {
    if (!/^E2[0-9A-F]+$/.test(u)) return false
    return u.length === 24 || u.length === 32 || u.length < 24
  }
  return acceptNonE2Inventory24(u)
}

/** Every byte-aligned 96-bit EPC (`E2` + 22 hex). Regex /g alone can miss windows when reports are packed. */
function addByteAlignedE2Windows24(cleanHex, outSet) {
  const c = String(cleanHex || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  for (let i = 0; i + 24 <= c.length; i += 2) {
    const w = c.slice(i, i + 24)
    if (!w.startsWith("E2")) continue
    if (acceptInventoryEpcKey(w)) outSet.add(w)
  }
}

/** If both 24- and 32-hex keys exist for one tag, keep the longer identity only. */
function dedupeEpcPrefixKeys(set) {
  const keys = [...set]
  for (const a of keys) {
    for (const b of keys) {
      if (a.length === 24 && b.length === 32 && b.startsWith(a)) set.delete(a)
    }
  }
}

/**
 * Hopeland / Gen2 streams often concatenate **96-bit EPC** (24 hex, usually `E280…`) with TID,
 * PC, and frame markers (`AA12…`). The reader’s “TagCount” is EPC-bank unique — we must not
 * treat each long concatenation as a different tag.
 * Multi-EPC chunks are handled by {@link gatherCanonicalEpcsFromRaw}; this covers partial E2…
 * reads from binary frames (fewer than 24 hex chars).
 */
function canonicalInventoryEpc(raw) {
  let s = String(raw || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  if (s.length < 8) return null

  const cut = s.indexOf("AA12")
  if (cut >= 16) s = s.slice(0, cut)

  if (looksLikeProtocolGarbage(s)) return null

  if (s.startsWith("E2") && s.length >= 8 && s.length < 24 && s.length % 2 === 0) return s

  return null
}

/**
 * Distinct 96-bit `E2…` EPCs in one parser string, plus vetted partial E2 fallbacks.
 * Important: do **not** truncate only at the first `AA12`. Long TCP hex often chains
 * several Hopeland inventory blobs (`…E280…AA12…E280…`); keeping only the slice *before*
 * the first marker dropped every EPC after it (e.g. 7 seen vs ~10 in Hopeland).
 */
function gatherCanonicalEpcsFromRaw(raw) {
  const out = new Set()
  const s0 = String(raw || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
  if (s0.length < 8) return []

  const blocks = s0.includes("AA12") ? s0.split("AA12") : [s0]
  for (const block0 of blocks) {
    let t = block0
    const cut10 = t.indexOf("AA10")
    if (cut10 >= 16) t = t.slice(0, cut10)
    if (t.length < 8) continue
    if (looksLikeProtocolGarbage(t) && !/^E2/.test(t)) continue

    const re24 = /E2[0-9A-F]{22}/g
    let m
    while ((m = re24.exec(t)) !== null) {
      if (acceptInventoryEpcKey(m[0])) out.add(m[0])
    }
    addByteAlignedE2Windows24(t, out)
  }

  const partial = canonicalInventoryEpc(s0)
  if (partial && acceptInventoryEpcKey(partial)) out.add(partial)

  return [...out]
}

class ReaderService {
  constructor(onStatus, onTag) {
    this.onStatus = onStatus
    this.onTag = onTag
    this.socket = null
    this.server = null
    this.connected = false
    this.scanning = false
    this.listenMode = false
    this.readerIp = ""
    this.readerPort = 9090
    this.recent = new Map()
    this.cooldownMs = 1200
    this.rawPacketCount = 0
    /** Last bytes from previous TCP chunk so EPC hex isn’t lost on packet boundaries. */
    this._streamCarry = Buffer.alloc(0)
  }

  status() {
    return {
      connected: this.connected,
      /** TCP server is bound (listen mode) — not the same as a reader session. */
      listening: Boolean(this.server),
      scanning: this.scanning,
      listenMode: this.listenMode,
      readerIp: this.readerIp,
      readerPort: this.readerPort,
      rawPacketCount: this.rawPacketCount
    }
  }

  emitStatus(extra = {}) {
    this.onStatus({ ...this.status(), ...extra })
  }

  connect(readerIp, readerPort) {
    return new Promise((resolve, reject) => {
      this.disconnect()
      this.readerIp = readerIp
      this.readerPort = readerPort
      this.listenMode = false
      this.socket = new net.Socket()
      this.socket.setTimeout(4500)

      this.socket.once("connect", () => {
        this.connected = true
        try {
          this.readerIp = normalizeReaderIp(this.socket.remoteAddress || this.readerIp)
        } catch (_e) {
          /* ignore */
        }
        // Hopeland / Hope protocol: host should send STOP first after TCP connect (idle reader).
        this.tryWrite(HOPELAND_STOP)
        this.emitStatus()
        resolve(this.status())
      })
      this.socket.once("timeout", () => {
        this.disconnect()
        reject(new Error("Reader connect timeout"))
      })
      this.socket.once("error", (err) => {
        this.disconnect()
        reject(err)
      })
      this.socket.on("close", () => {
        if (this.listenMode) return
        this.connected = false
        this.scanning = false
        this.rawPacketCount = 0
        this.emitStatus({ message: "Reader disconnected", sessionLost: true })
      })
      this.socket.on("data", (chunk) => this.handleData(chunk))
      this.socket.connect(readerPort, readerIp)
    })
  }

  listen(readerPort) {
    return new Promise((resolve, reject) => {
      this.disconnect()
      this.readerPort = readerPort
      this.listenMode = true
      this.server = net.createServer((client) => {
        if (this.socket) this.socket.destroy()
        this.socket = client
        this.connected = true
        this.readerIp = normalizeReaderIp(client.remoteAddress || "")
        // Reader may push tags before the renderer's startScan() IPC lands — treat as scanning.
        this.scanning = true
        this.emitStatus({ message: `Reader push connected: ${this.readerIp}` })
        client.on("data", (chunk) => this.handleData(chunk))
        client.on("close", () => {
          this.socket = null
          this.rawPacketCount = 0
          if (this.server && this.listenMode) {
            this.connected = false
            this.readerIp = ""
            this.scanning = false
            this.emitStatus({ message: "Reader disconnected — waiting for device again", sessionLost: true })
          } else {
            this.connected = false
            this.scanning = false
            this.emitStatus({ message: "Reader push disconnected", sessionLost: true })
          }
        })
        client.on("error", () => {})
      })
      this.server.once("error", (err) => {
        this.disconnect()
        reject(err)
      })
      this.server.listen(readerPort, "0.0.0.0", () => {
        this.connected = false
        this.scanning = false
        this.emitStatus({ message: `Waiting for reader on port ${readerPort} (no device connected yet)` })
        resolve(this.status())
      })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.connected = false
    this.scanning = false
    this.listenMode = false
    this.readerIp = ""
    this.rawPacketCount = 0
    this.recent.clear()
    this._streamCarry = Buffer.alloc(0)
    this.emitStatus()
  }

  /** Reset counters without tearing down TCP (e.g. “Clear tags” in UI). */
  resetScanPresentation() {
    this.rawPacketCount = 0
    this.recent.clear()
    this._streamCarry = Buffer.alloc(0)
    this.emitStatus()
  }

  startScan() {
    if (!this.connected) {
      if (this.listenMode) {
        this.emitStatus()
        return this.status()
      }
      throw new Error("Reader not connected")
    }
    this.scanning = true
    this.trySendStartCommands()
    this.emitStatus()
    return this.status()
  }

  stopScan() {
    this.scanning = false
    this.trySendStopCommands()
    this.emitStatus()
  }

  tryWrite(bufferOrText) {
    if (!this.socket) return
    try {
      this.socket.write(bufferOrText)
    } catch (_err) {
      // best effort only
    }
  }

  trySendStartCommands() {
    if (this.listenMode) return
    // Hopeland fixed readers (AA frames, MID 0x10 inventory).
    this.tryWrite(HOPELAND_STOP)
    this.tryWrite(HOPELAND_INVENTORY_ANT1)
    // Other readers (text / Impinj-style binary).
    this.tryWrite("START\r\n")
    this.tryWrite("INVENTORY\r\n")
    this.tryWrite(Buffer.from([0xa0, 0x04, 0x80, 0x05, 0x00, 0xd7]))
    this.tryWrite(Buffer.from([0xa0, 0x03, 0x89, 0x01, 0xd3]))
  }

  trySendStopCommands() {
    if (this.listenMode) return
    this.tryWrite(HOPELAND_STOP)
    this.tryWrite("STOP\r\n")
    this.tryWrite("STOPINVENTORY\r\n")
    this.tryWrite(Buffer.from([0xa0, 0x04, 0x80, 0x06, 0x00, 0xd6]))
  }

  shouldAccept(epc) {
    const now = Date.now()
    const prev = this.recent.get(epc)
    if (prev && now - prev < this.cooldownMs) return false
    this.recent.set(epc, now)
    if (this.recent.size > 500) {
      for (const [key, ts] of this.recent.entries()) {
        if (now - ts > this.cooldownMs) this.recent.delete(key)
      }
    }
    return true
  }

  extractEpcs(text) {
    const matches = new Set()
    const normalized = String(text || "").replace(/\u0000/g, " ")
    /** Do not run loose hex regex on binary decoded as UTF-8 — it creates fake “tags”. */
    const patterns = [/EPC[:=\s]+([0-9A-F]{8,64})/gi, /\b6C\s+([0-9A-F]{8,64})\b/gi]
    for (const p of patterns) {
      let m
      while ((m = p.exec(normalized)) !== null) {
        matches.add((m[1] || "").toUpperCase())
      }
    }
    return [...matches]
  }

  extractEpcsFromHexBlob(hexText) {
    const clean = String(hexText || "").replace(/[^0-9A-F]/gi, "").toUpperCase()
    const out = new Set()
    if (clean.length < 24) return []

    const re = /E2[0-9A-F]{22}/g
    let m
    while ((m = re.exec(clean)) !== null) {
      if (acceptInventoryEpcKey(m[0])) out.add(m[0])
    }
    addByteAlignedE2Windows24(clean, out)
    for (const x of extractNonE2NearAa12(clean)) out.add(x)

    return [...out]
  }

  /** Hopeland active upload uses 0xAA 0x12 … — parse Gen2 PC + EPC when possible (matches reader TagCount better than regex-only). */
  extractEpcsFromHopelandAa(bytes) {
    const epcs = new Set()
    const u = new Uint8Array(bytes)
    for (let i = 0; i < u.length - 10; i += 1) {
      if (u[i] !== 0xaa || u[i + 1] !== 0x12) continue
      const local = u.subarray(i, Math.min(i + 420, u.length))

      for (let off = 2; off <= 96 && off + 4 <= local.length; off += 1) {
        const pc = (local[off] << 8) | local[off + 1]
        const L = (pc >> 11) & 0x1f
        if (L < 1 || L > 31) continue
        const epcBits = L * 16
        const epcBytes = epcBits / 8
        if (!Number.isInteger(epcBytes) || epcBytes < 2 || epcBytes > 32) continue
        const es = off + 2
        if (es + epcBytes > local.length) continue
        const raw = Buffer.from(local.subarray(es, es + epcBytes)).toString("hex").toUpperCase()
        const nibbles = epcBytes * 2
        const key = raw.slice(0, nibbles)
        if (acceptInventoryEpcKey(key)) epcs.add(key)
        else if (nibbles >= 24) {
          const k24 = raw.slice(0, 24)
          if (acceptNonE2Inventory24(k24)) epcs.add(k24)
        }
      }

      const hex = Buffer.from(local).toString("hex").toUpperCase()
      let m
      const reE2 = /E2[0-9A-F]{22}/g
      while ((m = reE2.exec(hex)) !== null) {
        if (acceptInventoryEpcKey(m[0])) epcs.add(m[0])
      }
      addByteAlignedE2Windows24(hex, epcs)
      for (const x of extractNonE2NearAa12(hex)) epcs.add(x)
    }
    dedupeEpcPrefixKeys(epcs)
    return [...epcs]
  }

  extractEpcsFromBinaryFrames(chunk) {
    const epcs = new Set()
    const bytes = new Uint8Array(chunk)
    for (let i = 0; i < bytes.length - 6; i += 1) {
      if (bytes[i] !== 0xa0) continue
      const bodyLen = bytes[i + 1]
      const frameLen = bodyLen + 2
      if (frameLen < 8 || i + frameLen > bytes.length) continue
      const frame = bytes.slice(i, i + frameLen)
      const cmd = frame[2]

      // Inventory response frames commonly use 0x89/0x8A.
      if (cmd === 0x89 || cmd === 0x8a || cmd === 0xee) {
        // Heuristic: skip A0 LEN CMD ANT PC(2), trim RSSI+CRC tail.
        const start = 6
        const end = Math.max(start, frame.length - 3)
        const epcBytes = frame.slice(start, end)
        if (epcBytes.length >= 4 && epcBytes.length <= 32) {
          const hex = Buffer.from(epcBytes).toString("hex").toUpperCase()
          if (/^[0-9A-F]{8,64}$/.test(hex)) {
            for (const e of gatherCanonicalEpcsFromRaw(hex)) {
              if (acceptInventoryEpcKey(e)) epcs.add(e)
            }
          }
        }
      }
    }
    return [...epcs]
  }

  /**
   * One physical tag often appears as multiple hex strings in the same TCP chunk (prefix vs
   * extended, or different parsers). Keep the longest EPC when one is a strict prefix of another.
   */
  collapseRelatedEpcs(candidates) {
    const cleaned = [...new Set(candidates.map((e) => String(e || "").replace(/[^0-9A-F]/gi, "").toUpperCase()))].filter(
      (e) => e.length >= 8 && e.length <= 64 && e.length % 2 === 0
    )
    cleaned.sort((a, b) => b.length - a.length)
    const kept = []
    for (const epc of cleaned) {
      if (kept.some((k) => k.startsWith(epc) && k.length > epc.length)) continue
      for (let i = kept.length - 1; i >= 0; i -= 1) {
        if (epc.startsWith(kept[i]) && epc.length > kept[i].length) kept.splice(i, 1)
      }
      kept.push(epc)
    }
    return kept
  }

  handleData(chunk) {
    if (!this.connected || !this.scanning) return
    this.rawPacketCount += 1
    const STREAM_CARRY = 512
    const buf = Buffer.concat([this._streamCarry, chunk])
    this._streamCarry = buf.subarray(Math.max(0, buf.length - STREAM_CARRY))

    const text = chunk.toString("utf8")
    const hexText = buf.toString("hex").toUpperCase()
    const printable = (() => {
      if (!text.length) return false
      let ok = 0
      for (let i = 0; i < text.length; i += 1) {
        const c = text.charCodeAt(i)
        if (c === 9 || c === 10 || c === 13) ok += 1
        else if (c >= 0x20 && c <= 0x7e) ok += 1
      }
      return ok / text.length > 0.55
    })()
    const epcsText = printable ? this.extractEpcs(text) : []
    const epcsFromBlob = this.extractEpcsFromHexBlob(hexText)
    const epcsFromFrames = this.extractEpcsFromBinaryFrames(buf)
    const epcsHopeland = this.extractEpcsFromHopelandAa(buf)
    const merged = [...epcsText, ...epcsFromBlob, ...epcsFromFrames, ...epcsHopeland]
    const collapsed = this.collapseRelatedEpcs(merged)
    const canonicalSet = new Set()
    for (const raw of collapsed) {
      for (const e of gatherCanonicalEpcsFromRaw(raw)) {
        if (acceptInventoryEpcKey(e)) canonicalSet.add(e)
      }
    }
    addByteAlignedE2Windows24(hexText, canonicalSet)
    dedupeEpcPrefixKeys(canonicalSet)
    const allEpcs = [...canonicalSet]
    for (const epc of allEpcs) {
      if (!epc) continue
      const allowErp = this.shouldAccept(epc)
      this.onTag({
        epc,
        readerIp: this.readerIp,
        readerPort: this.readerPort,
        seenAt: new Date().toISOString(),
        raw: text || hexText,
        allowErp
      })
    }
    this.emitStatus()
  }
}

module.exports = { ReaderService }
