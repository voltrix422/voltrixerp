type ScannerConnectionState = {
  connected: boolean
  scanning: boolean
  readerIp: string
  readerPort: number
  updatedAt: string
}

export type LiveScanRow = {
  id: string
  epc: string
  seenAt: string
  readerIp: string
  readerPort: number
  antenna?: string
  rssi?: number
  frequency?: number
  protocol?: string
}

type ScannerStore = {
  connection: ScannerConnectionState
  liveScans: LiveScanRow[]
}

const globalForScannerStore = globalThis as unknown as { __rfidScannerStore?: ScannerStore }

function initialState(): ScannerStore {
  return {
    connection: {
      connected: false,
      scanning: false,
      readerIp: "",
      readerPort: 9090,
      updatedAt: new Date().toISOString(),
    },
    liveScans: [],
  }
}

export function getScannerStore(): ScannerStore {
  if (!globalForScannerStore.__rfidScannerStore) {
    globalForScannerStore.__rfidScannerStore = initialState()
  }
  return globalForScannerStore.__rfidScannerStore
}

export function getScannerStatus() {
  const store = getScannerStore()
  return {
    connection: store.connection,
    scan_count: store.liveScans.length,
    scans: store.liveScans.slice(0, 200),
  }
}

export function connectScanner(readerIp: string, readerPort: number) {
  const store = getScannerStore()
  store.connection = {
    connected: true,
    scanning: false,
    readerIp,
    readerPort,
    updatedAt: new Date().toISOString(),
  }
  return store.connection
}

export function disconnectScanner() {
  const store = getScannerStore()
  store.connection = {
    connected: false,
    scanning: false,
    readerIp: "",
    readerPort: 9090,
    updatedAt: new Date().toISOString(),
  }
  return store.connection
}

export function startScanner() {
  const store = getScannerStore()
  if (!store.connection.connected) return null
  store.connection.scanning = true
  store.connection.updatedAt = new Date().toISOString()
  return store.connection
}

export function stopScanner() {
  const store = getScannerStore()
  store.connection.scanning = false
  store.connection.updatedAt = new Date().toISOString()
  return store.connection
}

export function clearLiveScans() {
  const store = getScannerStore()
  store.liveScans = []
}

export function appendLiveScan(scan: Omit<LiveScanRow, "id" | "seenAt">) {
  const store = getScannerStore()
  const row: LiveScanRow = {
    ...scan,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    seenAt: new Date().toISOString(),
  }
  store.liveScans.unshift(row)
  if (store.liveScans.length > 500) {
    store.liveScans = store.liveScans.slice(0, 500)
  }
  return row
}
