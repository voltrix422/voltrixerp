let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!sharedContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    sharedContext = new Ctx()
  }
  return sharedContext
}

type BeepNote = {
  frequency: number
  durationMs: number
  volume?: number
  type?: OscillatorType
  /** Gap after this note before the next (ms) */
  gapAfterMs?: number
}

function playNote(
  ctx: AudioContext,
  startTime: number,
  { frequency, durationMs, volume = 0.55, type = "square" }: BeepNote,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const durationSec = durationMs / 1000
  const end = startTime + durationSec

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startTime + 0.008)
  gain.gain.setValueAtTime(volume, startTime + durationSec * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.start(startTime)
  oscillator.stop(end + 0.02)
}

function playSequence(notes: BeepNote[]) {
  try {
    const ctx = getContext()
    if (!ctx) return
    void ctx.resume()

    let cursor = ctx.currentTime
    for (const note of notes) {
      playNote(ctx, cursor, note)
      cursor += note.durationMs / 1000 + (note.gapAfterMs ?? 0) / 1000
    }
  } catch {
    // Audio may be blocked until user gesture; ignore.
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore
  }
}

/** Call when opening the camera so beeps work on mobile (needs user gesture). */
export function prepareScanAudio() {
  const ctx = getContext()
  if (!ctx) return
  void ctx.resume()
  // Silent unlock tone (inaudible) so later beeps are not blocked on iOS
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 40
    gain.gain.value = 0.0001
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t = ctx.currentTime
    osc.start(t)
    osc.stop(t + 0.05)
  } catch {
    // ignore
  }
}

/** Sharp double chirp — like a handheld barcode scanner (good scan). */
export function playScanSuccessBeep() {
  playSequence([
    { frequency: 2093, durationMs: 70, volume: 0.62, type: "square", gapAfterMs: 35 },
    { frequency: 2637, durationMs: 85, volume: 0.68, type: "square" },
  ])
  vibrate(40)
}

/** Loud low buzz — duplicate / invalid scan. */
export function playScanRejectBeep() {
  playSequence([
    { frequency: 320, durationMs: 110, volume: 0.72, type: "sawtooth", gapAfterMs: 45 },
    { frequency: 220, durationMs: 140, volume: 0.78, type: "sawtooth", gapAfterMs: 50 },
    { frequency: 180, durationMs: 160, volume: 0.75, type: "square" },
  ])
  vibrate([120, 60, 120])
}
