let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!sharedContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    sharedContext = new Ctx()
  }
  return sharedContext
}

function playTone(frequency: number, durationMs: number, volume = 0.12) {
  try {
    const ctx = getContext()
    if (!ctx) return
    void ctx.resume()

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = "sine"
    oscillator.frequency.value = frequency

    const start = ctx.currentTime
    const end = start + durationMs / 1000
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.start(start)
    oscillator.stop(end + 0.02)
  } catch {
    // Audio may be blocked until user gesture; ignore.
  }
}

/** Call when opening the camera so beeps work on mobile (needs user gesture). */
export function prepareScanAudio() {
  const ctx = getContext()
  if (ctx) void ctx.resume()
}

/** Short high beep when a new SN is accepted. */
export function playScanSuccessBeep() {
  playTone(880, 100)
  window.setTimeout(() => playTone(1175, 90, 0.1), 95)
}

/** Lower tone when scan is rejected (duplicate). */
export function playScanRejectBeep() {
  playTone(280, 140, 0.1)
}
