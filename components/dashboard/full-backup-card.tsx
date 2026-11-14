"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Download, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

type Phase = "idle" | "building" | "ready" | "downloading" | "done" | "error"

type Prepared = {
  token: string
  filename: string
  sizeLabel: string
  downloadPath: string
  sizeBytes?: number
}

type LiveProgress = {
  percent: number
  leftPercent: number
  stage: string
  message: string
  bytesDoneLabel?: string
  bytesTotalLabel?: string
}

function formatBytes(n: number) {
  if (!n || n < 1024) return `${n || 0} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Strip redundant size text from API messages like "Zipping... 60.0 MB / 60.0 MB" */
function cleanStatus(message: string) {
  return String(message || "")
    .replace(/\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)\s*\/\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[.…]+$/g, "")
    .trim() || "Working"
}

function SheetShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="relative z-[1] w-full max-w-[320px] overflow-hidden rounded-[22px] border border-white/50 bg-white/95 shadow-[0_24px_80px_rgba(0,0,0,0.4)] dark:border-white/10 dark:bg-[hsl(var(--card))]/95">
        {children}
      </div>
    </div>,
    document.body,
  )
}

function ProgressSheet({
  title,
  percent,
  status,
  sizeLabel,
}: {
  title: string
  percent: number
  status: string
  sizeLabel?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <SheetShell>
      <div className="px-6 pt-6 pb-5 text-center space-y-5">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            {title}
          </p>
          <p className="text-[12px] text-[#86868b]">{status}</p>
        </div>

        <p className="text-[44px] font-bold tracking-tight tabular-nums leading-none text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
          {pct}
          <span className="text-[22px] font-semibold text-[#86868b]">%</span>
        </p>

        <div className="h-[5px] rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1a9f9a] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {sizeLabel ? (
          <p className="text-[11px] tabular-nums text-[#86868b]">{sizeLabel}</p>
        ) : (
          <div className="flex justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1a9f9a]" />
          </div>
        )}
      </div>
    </SheetShell>
  )
}

function ReadySheet({
  sizeLabel,
  filename,
  onDownload,
  onAgain,
  busy,
}: {
  sizeLabel?: string
  filename?: string
  onDownload: () => void
  onAgain: () => void
  busy?: boolean
}) {
  return (
    <SheetShell>
      <div className="px-6 pt-7 pb-5 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a9f9a]/15">
          <Check className="h-7 w-7 text-[#1a9f9a]" strokeWidth={2.5} />
        </div>

        <div className="space-y-1">
          <p className="text-[17px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Backup ready
          </p>
          <p className="text-[12px] text-[#86868b]">
            {sizeLabel ? `${sizeLabel} ZIP` : "Your ZIP is ready to save"}
          </p>
          {filename ? (
            <p className="text-[10px] text-[#aeaeb2] truncate px-2 pt-0.5">{filename}</p>
          ) : null}
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onDownload}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[#1a9f9a] text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAgain}
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/10 text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.09] disabled:opacity-50 cursor-pointer transition-colors"
          >
            Create again
          </button>
        </div>
      </div>
    </SheetShell>
  )
}

function DoneSheet({ sizeLabel }: { sizeLabel?: string }) {
  return (
    <SheetShell>
      <div className="px-6 pt-7 pb-7 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1a9f9a]">
          <Check className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <p className="text-[17px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Saved
          </p>
          <p className="text-[12px] text-[#86868b]">
            {sizeLabel ? `${sizeLabel} saved to your computer` : "Backup saved to your computer"}
          </p>
        </div>
      </div>
    </SheetShell>
  )
}

export function FullBackupCard() {
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [includeEnv, setIncludeEnv] = useState(true)
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [live, setLive] = useState<LiveProgress | null>(null)
  const [downloadLive, setDownloadLive] = useState<LiveProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      abortRef.current = true
    }
  }, [])

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function friendlyNetError(e: unknown, fallback: string) {
    const raw = e instanceof Error ? e.message : String(e || "")
    const lower = raw.toLowerCase()
    if (
      !raw ||
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower === "network error" ||
      lower.includes("load failed")
    ) {
      return "Connection interrupted. Try again and keep this tab open."
    }
    return raw || fallback
  }

  async function createBackup() {
    if (!user?.id) {
      setError("Sign in required")
      setPhase("error")
      return
    }
    setError("")
    setPrepared(null)
    setDownloadLive(null)
    abortRef.current = false
    setPhase("building")
    setLive({
      percent: 0,
      leftPercent: 100,
      stage: "queued",
      message: "Preparing…",
    })

    try {
      const res = await fetch("/api/dashboard/full-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, includeEnv }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Backup failed (${res.status})`)

      const jobId = String(json.jobId || "")
      if (!jobId) throw new Error("No backup job started")

      stopPoll()
      pollRef.current = setInterval(() => {
        void pollProgress(jobId, user.id)
      }, 800)
      await pollProgress(jobId, user.id)
    } catch (e) {
      stopPoll()
      setError(friendlyNetError(e, "Backup failed"))
      setPhase("error")
      setLive(null)
    }
  }

  async function pollProgress(jobId: string, userId: string) {
    if (abortRef.current) return
    try {
      const res = await fetch(
        `/api/dashboard/full-backup?jobId=${encodeURIComponent(jobId)}&userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not read backup progress")

      setLive({
        percent: Number(json.percent) || 0,
        leftPercent: Number(json.leftPercent) || Math.max(0, 100 - (Number(json.percent) || 0)),
        stage: json.stage || "",
        message: json.message || "Working…",
        bytesDoneLabel: json.bytesDoneLabel,
        bytesTotalLabel: json.bytesTotalLabel,
      })

      if (json.status === "ready" && json.downloadPath) {
        stopPoll()
        setPrepared({
          token: json.token,
          filename: json.filename,
          sizeLabel: json.sizeLabel || "",
          downloadPath: json.downloadPath,
          sizeBytes: json.sizeBytes,
        })
        setPhase("ready")
        setLive(null)
      } else if (json.status === "error") {
        stopPoll()
        setError(json.error || "Backup failed")
        setPhase("error")
        setLive(null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e || "")
      const soft =
        /failed to fetch|networkerror|network error|load failed|fetch/i.test(msg) || !msg
      if (soft) {
        setLive((prev) =>
          prev
            ? { ...prev, message: "Reconnecting…" }
            : {
                percent: 0,
                leftPercent: 100,
                stage: "reconnect",
                message: "Reconnecting…",
              },
        )
        return
      }
      stopPoll()
      setError(friendlyNetError(e, "Backup progress failed"))
      setPhase("error")
      setLive(null)
    }
  }

  async function downloadZip() {
    if (!prepared?.downloadPath) return
    setError("")
    setPhase("downloading")
    setDownloadLive({
      percent: 0,
      leftPercent: 100,
      stage: "download",
      message: "Saving…",
    })

    const total = Number(prepared.sizeBytes || 0) || 0

    try {
      const picker = (
        window as Window & {
          showSaveFilePicker?: (opts: {
            suggestedName?: string
            types?: { description: string; accept: Record<string, string[]> }[]
          }) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker

      if (typeof picker === "function" && typeof ReadableStream !== "undefined") {
        const handle = await picker({
          suggestedName: prepared.filename || "voltrix-erp-backup.zip",
          types: [
            {
              description: "ZIP archive",
              accept: { "application/zip": [".zip"] },
            },
          ],
        })
        const writable = await handle.createWritable()
        const res = await fetch(prepared.downloadPath, { cache: "no-store" })
        if (!res.ok) {
          let message = `Download failed (${res.status})`
          try {
            const j = await res.json()
            if (j?.error) message = String(j.error)
          } catch {
            /* ignore */
          }
          await writable.abort().catch(() => undefined)
          throw new Error(message)
        }

        const reader = res.body?.getReader()
        if (!reader) {
          await writable.abort().catch(() => undefined)
          throw new Error("Browser could not stream the download")
        }

        let received = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            await writable.write(value)
            received += value.length
            const pct =
              total > 0
                ? Math.min(99, Math.round((received / total) * 100))
                : Math.min(95, Math.round(received / (1024 * 1024)))
            setDownloadLive({
              percent: pct,
              leftPercent: Math.max(0, 100 - pct),
              stage: "download",
              message: "Saving…",
              bytesDoneLabel: formatBytes(received),
              bytesTotalLabel: total > 0 ? formatBytes(total) : undefined,
            })
          }
        }
        await writable.close()

        setDownloadLive({
          percent: 100,
          leftPercent: 0,
          stage: "done",
          message: "Saved",
          bytesDoneLabel: formatBytes(received),
          bytesTotalLabel: total > 0 ? formatBytes(total) : formatBytes(received),
        })
        setPhase("done")
        setTimeout(() => {
          setDownloadLive(null)
          setPhase("idle")
          setPrepared(null)
        }, 2800)
        return
      }

      const a = document.createElement("a")
      a.href = prepared.downloadPath
      a.download = prepared.filename || "voltrix-erp-backup.zip"
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()

      setDownloadLive({
        percent: 100,
        leftPercent: 0,
        stage: "done",
        message: "Saved",
        bytesDoneLabel: total > 0 ? formatBytes(total) : undefined,
        bytesTotalLabel: total > 0 ? formatBytes(total) : undefined,
      })
      setPhase("done")
      setTimeout(() => {
        setDownloadLive(null)
        setPhase("idle")
        setPrepared(null)
      }, 2800)
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPhase("ready")
        setDownloadLive(null)
        return
      }
      setError(friendlyNetError(e, "Download failed"))
      setPhase("ready")
      setDownloadLive(null)
    }
  }

  const busy = phase === "building" || phase === "downloading"
  const showBuild = phase === "building" && live
  const showDownload = phase === "downloading" && downloadLive
  const showReady = phase === "ready" && prepared
  const showDone = phase === "done"

  const buildSize =
    live?.bytesDoneLabel && live?.bytesTotalLabel
      ? `${live.bytesDoneLabel} of ${live.bytesTotalLabel}`
      : live?.bytesDoneLabel

  const downloadSize =
    downloadLive?.bytesDoneLabel && downloadLive?.bytesTotalLabel
      ? `${downloadLive.bytesDoneLabel} of ${downloadLive.bytesTotalLabel}`
      : downloadLive?.bytesDoneLabel

  return (
    <>
      {showBuild && (
        <ProgressSheet
          title="Creating backup"
          percent={live.percent}
          status={cleanStatus(live.message)}
          sizeLabel={buildSize}
        />
      )}

      {showDownload && (
        <ProgressSheet
          title="Downloading"
          percent={downloadLive.percent}
          status={cleanStatus(downloadLive.message)}
          sizeLabel={downloadSize}
        />
      )}

      {showReady && (
        <ReadySheet
          sizeLabel={prepared.sizeLabel}
          filename={prepared.filename}
          busy={busy}
          onDownload={() => void downloadZip()}
          onAgain={() => void createBackup()}
        />
      )}

      {showDone && (
        <DoneSheet sizeLabel={prepared?.sizeLabel || downloadLive?.bytesTotalLabel} />
      )}

      <div className="max-w-md rounded-[18px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] overflow-hidden">
        <div className="px-5 pt-5 pb-4 space-y-1">
          <p className="text-[15px] font-bold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
            Backup
          </p>
          <p className="text-[12px] text-[#86868b] leading-snug">
            Database, uploads, and website data in one ZIP.
          </p>
        </div>

        <div className="mx-5 h-px bg-black/[0.06] dark:bg-white/10" />

        <button
          type="button"
          disabled={busy || phase === "ready" || phase === "done"}
          onClick={() => setIncludeEnv((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors cursor-pointer",
            busy || phase === "ready" || phase === "done"
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
          )}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              Include secrets
            </p>
            <p className="text-[11px] text-[#86868b] mt-0.5">env.backup · keep the ZIP private</p>
          </div>
          <span
            className={cn(
              "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
              includeEnv ? "bg-[#1a9f9a]" : "bg-black/[0.12] dark:bg-white/20",
            )}
          >
            <span
              className={cn(
                "absolute top-[2px] left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform",
                includeEnv && "translate-x-[18px]",
              )}
            />
          </span>
        </button>

        <div className="px-5 pb-5 pt-2 space-y-2">
          <button
            type="button"
            disabled={busy || !user}
            onClick={() => void createBackup()}
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1d1d1f] dark:bg-white text-[13px] font-semibold text-white dark:text-[#1d1d1f] hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create ZIP"}
          </button>

          {phase === "error" && error && (
            <p className="text-center text-[11px] text-[#ff3b30]">{error}</p>
          )}
        </div>
      </div>
    </>
  )
}
