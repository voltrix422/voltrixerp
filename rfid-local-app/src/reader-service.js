const net = require("node:net")

function normalizeReaderIp(addr) {
  if (!addr) return ""
  const s = String(addr).trim()
  return s.replace(/^::ffff:/i, "")
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
  }

  status() {
    return {
      connected: this.connected,
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
      this.socket.setTimeout(1200)

      this.socket.once("connect", () => {
        this.connected = true
        try {
          this.readerIp = normalizeReaderIp(this.socket.remoteAddress || this.readerIp)
        } catch (_e) {
          /* ignore */
        }
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
        this.emitStatus({ message: "Reader disconnected" })
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
          if (this.server && this.listenMode) {
            this.connected = true
            this.readerIp = ""
            this.scanning = false
            this.emitStatus({ message: "Reader push disconnected, waiting for reconnect..." })
          } else {
            this.connected = false
            this.scanning = false
            this.emitStatus({ message: "Reader push disconnected" })
          }
        })
        client.on("error", () => {})
      })
      this.server.once("error", (err) => {
        this.disconnect()
        reject(err)
      })
      this.server.listen(readerPort, "0.0.0.0", () => {
        this.connected = true
        this.emitStatus({ message: `Listening for reader on port ${readerPort}` })
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
    this.emitStatus()
  }

  startScan() {
    if (!this.connected) throw new Error("Reader not connected")
    this.scanning = true
    this.trySendStartCommands()
    this.emitStatus()
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
    // Best-effort command variants used by different readers.
    this.tryWrite("START\r\n")
    this.tryWrite("INVENTORY\r\n")
    this.tryWrite(Buffer.from([0xa0, 0x04, 0x80, 0x05, 0x00, 0xd7])) // common inventory start frame
    this.tryWrite(Buffer.from([0xa0, 0x03, 0x89, 0x01, 0xd3])) // common continuous inventory trigger
  }

  trySendStopCommands() {
    if (this.listenMode) return
    this.tryWrite("STOP\r\n")
    this.tryWrite("STOPINVENTORY\r\n")
    this.tryWrite(Buffer.from([0xa0, 0x04, 0x80, 0x06, 0x00, 0xd6])) // common inventory stop frame
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
    const patterns = [
      /EPC[:=\s]+([0-9A-F]{8,64})/gi,
      /\b6C\s+([0-9A-F]{8,64})\b/gi,
      /\b([0-9A-F]{24,64})\b/g,
      /([0-9A-F]{8,64})/gi
    ]
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
    if (clean.length < 8) return []

    // Most EPCs are 96-bit (24 hex) and often start with E2.
    const preferredLens = [24, 28, 32, 40, 48, 56, 64]
    for (const len of preferredLens) {
      const re = new RegExp(`(E2[0-9A-F]{${Math.max(6, len - 2)}})`, "g")
      let m
      while ((m = re.exec(clean)) !== null) {
        const epc = (m[1] || "").slice(0, len).toUpperCase()
        if (epc.length >= 8 && epc.length <= 64) out.add(epc)
      }
    }

    // Fallback: any plausible fixed-size EPC chunks from long streams.
    if (out.size === 0 && clean.length >= 24) {
      const fallbackLens = [24, 32]
      for (const len of fallbackLens) {
        for (let i = 0; i + len <= clean.length; i += 2) {
          const epc = clean.slice(i, i + len)
          if (/^[0-9A-F]+$/.test(epc)) out.add(epc)
          if (out.size >= 30) break
        }
        if (out.size >= 30) break
      }
    }

    return [...out]
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
          if (/^[0-9A-F]{8,64}$/.test(hex)) epcs.add(hex)
        }
      }
    }
    return [...epcs]
  }

  handleData(chunk) {
    if (!this.scanning) return
    this.rawPacketCount += 1
    const text = chunk.toString("utf8")
    const hexText = chunk.toString("hex").toUpperCase()
    const epcs = this.extractEpcs(text)
    const epcsFromHex = this.extractEpcs(hexText)
    const epcsFromBlob = this.extractEpcsFromHexBlob(hexText)
    const epcsFromFrames = this.extractEpcsFromBinaryFrames(chunk)
    const allEpcs = [...new Set([...epcs, ...epcsFromHex, ...epcsFromBlob, ...epcsFromFrames])]
    for (const epc of allEpcs) {
      if (!epc || !this.shouldAccept(epc)) continue
      this.onTag({
        epc,
        readerIp: this.readerIp,
        readerPort: this.readerPort,
        seenAt: new Date().toISOString(),
        raw: text || hexText
      })
    }
    this.emitStatus()
  }
}

module.exports = { ReaderService }
