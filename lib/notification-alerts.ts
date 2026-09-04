"use client"

export type IncomingAlert = {
  title: string
  body?: string
  link?: string
  tag: string
}

const recentTags = new Set<string>()
let channel: BroadcastChannel | null = null
let chimeUrl: string | null = null
let audioUnlocked = false

function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null
  if (!channel) {
    channel = new BroadcastChannel("voltrix-erp-alerts")
    channel.onmessage = (event: MessageEvent) => {
      const tag = String((event.data as { tag?: string } | null)?.tag || "")
      if (tag) recentTags.add(tag)
    }
  }
  return channel
}

function rememberTag(tag: string) {
  recentTags.add(tag)
  window.setTimeout(() => recentTags.delete(tag), 12_000)
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

function toneSamples(frequency: number, durationSec: number, sampleRate: number, volume: number) {
  const count = Math.floor(sampleRate * durationSec)
  const data = new Int16Array(count)
  const attack = Math.floor(sampleRate * 0.012)
  const release = Math.floor(sampleRate * 0.06)
  for (let i = 0; i < count; i++) {
    const env =
      Math.min(1, i / Math.max(1, attack)) * Math.min(1, (count - i) / Math.max(1, release))
    data[i] = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * env * volume * 32767)
  }
  return data
}

function silenceSamples(durationSec: number, sampleRate: number) {
  return new Int16Array(Math.floor(sampleRate * durationSec))
}

function concatSamples(parts: Int16Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Int16Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function samplesToWavUrl(samples: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, samples.length * 2, true)
  new Int16Array(buffer, 44).set(samples)
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }))
}

function getChimeUrl() {
  if (chimeUrl) return chimeUrl
  const sampleRate = 22050
  const samples = concatSamples([
    toneSamples(880, 0.14, sampleRate, 0.42),
    silenceSamples(0.05, sampleRate),
    toneSamples(1174, 0.22, sampleRate, 0.38),
  ])
  chimeUrl = samplesToWavUrl(samples, sampleRate)
  return chimeUrl
}

/** Call from a click/keydown so later alerts can play while the tab is in the background. */
export function unlockNotificationAudio() {
  if (typeof window === "undefined") return
  audioUnlocked = true
  try {
    const audio = new Audio(getChimeUrl())
    audio.volume = 0.001
    void audio.play().then(() => {
      audio.pause()
      audio.currentTime = 0
    }).catch(() => {
      audioUnlocked = false
    })
  } catch {
    audioUnlocked = false
  }
}

export function playNotificationSound() {
  if (typeof window === "undefined") return
  try {
    const audio = new Audio(getChimeUrl())
    audio.volume = 0.72
    void audio.play().catch(() => {
      audioUnlocked = false
    })
  } catch {
    // ignore autoplay blocks until the next user gesture
  }
  try {
    navigator.vibrate?.([80, 40, 80])
  } catch {
    // ignore
  }
}

export function desktopNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

export async function requestDesktopNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  if (Notification.permission !== "default") return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function showDesktopNotification(alert: IncomingAlert) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return

  try {
    const notification = new Notification(alert.title, {
      body: (alert.body || "").slice(0, 180),
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      tag: alert.tag,
      silent: false,
      requireInteraction: false,
    })
    notification.onclick = () => {
      try {
        window.focus()
        if (alert.link && alert.link.startsWith("/")) {
          window.location.assign(alert.link)
        }
      } catch {
        // ignore
      }
      notification.close()
    }
  } catch {
    // Some browsers throw if the document is not fully active.
  }
}

export function announceIncomingAlert(alert: IncomingAlert) {
  if (!alert.tag || recentTags.has(alert.tag)) return
  rememberTag(alert.tag)
  try {
    getChannel()?.postMessage({ tag: alert.tag })
  } catch {
    // ignore
  }
  playNotificationSound()
  showDesktopNotification(alert)
}

export function announceIncomingAlerts(alerts: IncomingAlert[]) {
  if (!alerts.length) return
  if (alerts.length === 1) {
    announceIncomingAlert(alerts[0])
    return
  }
  announceIncomingAlert({
    title: `${alerts.length} new ERP notifications`,
    body: alerts[0].title,
    link: alerts[0].link,
    tag: `batch-${alerts.map((a) => a.tag).join("-").slice(0, 80)}`,
  })
}

export function isNotificationAudioUnlocked() {
  return audioUnlocked
}
