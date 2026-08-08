"use client"

import { useEffect, useRef, useState } from "react"
import { Archive, Download, Loader2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

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

function ProgressOverlay({
  title,
  holdOn,
  percent,
  leftPercent,
  message,
  detail,
  onCancel,
}: {
  title: string
  holdOn: string
  percent: number
  leftPercent: number
  message: string
  detail?: string
  onCancel?: () => void
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border bg-[hsl(var(--card))] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#1faca6]" />
              {title}
            </p>
            <p className="text-sm text-[#1faca6] font-medium mt-1">{holdOn}</p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{message}</p>

        <div className="mt-4 space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Done</p>
              <p className="text-2xl font-semibold tabular-nums text-[#1faca6]">{pct}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Left</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{Math.max(0, leftPercent)}%</p>
            </div>
          </div>

          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1faca6] transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {detail && (
            <p className="text-[11px] text-muted-foreground tabular-nums">{detail}</p>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4">
          Keep this tab open until it finishes. Large backups can take a few minutes.
        </p>
      </div>
    </div>
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
      message: "Hold on — starting your full system backup…",
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
      }, 450)
      await pollProgress(jobId, user.id)
    } catch (e) {
      stopPoll()
      setError(e instanceof Error ? e.message : "Backup failed")
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
        message: json.message || "Hold on — working…",
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
      stopPoll()
      setError(e instanceof Error ? e.message : "Backup progress failed")
      setPhase("error")
      setLive(null)
    }
  }

  async function downloadZip() {
    if (!prepared?.downloadPath) return
    setPhase("downloading")
    setDownloadLive({
      percent: 0,
      leftPercent: 100,
      stage: "download",
      message: "Hold on — downloading your ZIP…",
    })

    try {
      const res = await fetch(prepared.downloadPath, { cache: "no-store" })
      if (!res.ok) {
        let message = `Download failed (${res.status})`
        try {
          const j = await res.json()
          if (j?.error) message = String(j.error)
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }

      const total =
        Number(res.headers.get("Content-Length") || prepared.sizeBytes || 0) || 0
      const reader = res.body?.getReader()
      if (!reader) throw new Error("Browser could not stream the download")

      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : Math.min(95, Math.round(received / (1024 * 1024)))
          setDownloadLive({
            percent: pct,
            leftPercent: Math.max(0, 100 - pct),
            stage: "download",
            message: "Hold on — saving ZIP to your computer…",
            bytesDoneLabel: formatBytes(received),
            bytesTotalLabel: total > 0 ? formatBytes(total) : undefined,
          })
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = prepared.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setDownloadLive({
        percent: 100,
        leftPercent: 0,
        stage: "done",
        message: "Download complete",
        bytesDoneLabel: formatBytes(received),
        bytesTotalLabel: total > 0 ? formatBytes(total) : formatBytes(received),
      })
      setPhase("done")
      setTimeout(() => {
        setDownloadLive(null)
        setPhase("idle")
        setPrepared(null)
      }, 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed")
      setPhase("error")
      setDownloadLive(null)
    }
  }

  const busy = phase === "building" || phase === "downloading"
  const showBuildOverlay = phase === "building" && live
  const showDownloadOverlay = phase === "downloading" && downloadLive

  return (
    <>
      {showBuildOverlay && (
        <ProgressOverlay
          title="Creating full backup"
          holdOn="Hold on — we’re zipping everything for you"
          percent={live.percent}
          leftPercent={live.leftPercent}
          message={live.message}
          detail={
            live.bytesDoneLabel
              ? live.bytesTotalLabel
                ? `${live.bytesDoneLabel} of ${live.bytesTotalLabel}`
                : live.bytesDoneLabel
              : live.stage
                ? `Step: ${live.stage}`
                : undefined
          }
        />
      )}

      {showDownloadOverlay && (
        <ProgressOverlay
          title="Downloading backup"
          holdOn="Hold on — almost there"
          percent={downloadLive.percent}
          leftPercent={downloadLive.leftPercent}
          message={downloadLive.message}
          detail={
            downloadLive.bytesDoneLabel
              ? downloadLive.bytesTotalLabel
                ? `${downloadLive.bytesDoneLabel} of ${downloadLive.bytesTotalLabel}`
                : downloadLive.bytesDoneLabel
              : undefined
          }
        />
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Archive className="h-4 w-4 text-[#1faca6]" />
            System backup
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Download a complete ZIP of the ERP — admin only.
          </p>
        </div>

        <div className="max-w-md rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1faca6]/12 text-[#1faca6]">
              <Archive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Full system backup</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Database, uploads, website data, and schema in one ZIP.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-[#1faca6] font-bold">·</span>
              PostgreSQL database dump
            </li>
            <li className="flex gap-2">
              <span className="text-[#1faca6] font-bold">·</span>
              All uploads (proofs, images, docs)
            </li>
            <li className="flex gap-2">
              <span className="text-[#1faca6] font-bold">·</span>
              Website data + Prisma schema
            </li>
          </ul>

          <label className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border"
              checked={includeEnv}
              disabled={busy || phase === "ready"}
              onChange={(e) => setIncludeEnv(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Include env.backup</span>
              <span className="block text-muted-foreground mt-0.5">
                Optional. Contains passwords — keep the ZIP private.
              </span>
            </span>
          </label>

          {includeEnv && (
            <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
              Secrets will be inside the ZIP. Store it safely.
            </p>
          )}

          {prepared && (phase === "ready" || phase === "done") && (
            <p className="mt-3 text-[11px] rounded-md border bg-muted/20 px-3 py-2 truncate">
              <span className="text-muted-foreground">Ready · </span>
              <span className="font-medium">{prepared.filename}</span>
              {prepared.sizeLabel ? (
                <span className="text-muted-foreground"> · {prepared.sizeLabel}</span>
              ) : null}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {phase !== "ready" && phase !== "done" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy || !user}
                onClick={() => void createBackup()}
                className="h-9 w-full bg-[#1faca6] hover:bg-[#1a9691] text-white"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                )}
                {phase === "building"
                  ? "Zipping…"
                  : phase === "downloading"
                    ? "Downloading…"
                    : "Create full backup ZIP"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={!prepared || busy}
                  onClick={() => void downloadZip()}
                  className="h-9 w-full bg-[#1faca6] hover:bg-[#1a9691] text-white"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download ZIP
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void createBackup()}
                  className="h-9 w-full"
                >
                  Create again
                </Button>
              </>
            )}
          </div>

          {phase === "done" && (
            <p className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-400 text-center">
              Download complete — check your Downloads folder
            </p>
          )}
          {phase === "error" && error && (
            <p className="mt-2 text-[10px] text-red-600 text-center">{error}</p>
          )}
        </div>
      </section>
    </>
  )
}
