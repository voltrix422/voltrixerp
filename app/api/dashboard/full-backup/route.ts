import { NextRequest, NextResponse } from "next/server"
import { createReadStream, existsSync } from "fs"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { Readable } from "stream"
import { prisma } from "@/lib/db"
import { isErpAdmin } from "@/lib/auth"
import {
  buildFullBackupZip,
  cleanupBackupWorkDir,
  formatBytes,
  type BackupProgress,
} from "@/lib/full-backup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 600

const DOWNLOAD_ROOT = path.join(os.tmpdir(), "voltrix-backup-downloads")

type JobStatus = "queued" | "running" | "ready" | "error"

type BackupJob = {
  jobId: string
  userId: string
  status: JobStatus
  progress: BackupProgress
  createdAt: number
  token?: string
  filename?: string
  zipPath?: string
  workDir?: string
  sizeBytes?: number
  error?: string
}

type StoredMeta = {
  token: string
  filename: string
  zipPath: string
  workDir: string
  sizeBytes: number
  userId: string
  createdAt: number
}

const jobs = new Map<string, BackupJob>()
const prepared = new Map<string, StoredMeta>()

async function assertAdmin(userId: string | null) {
  if (!userId) return { ok: false as const, status: 401, error: "Sign in required" }
  const user = await prisma.erpUser.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  })
  if (!user || !isErpAdmin(user.role)) {
    return { ok: false as const, status: 403, error: "Admin only — full backup is restricted" }
  }
  return { ok: true as const, user }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function ensureDownloadRoot() {
  await fs.mkdir(DOWNLOAD_ROOT, { recursive: true })
}

async function sweepOld() {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [token, meta] of prepared) {
    if (meta.createdAt < cutoff) {
      prepared.delete(token)
      await cleanupBackupWorkDir(meta.workDir)
    }
  }
  for (const [jobId, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(jobId)
  }
}

function publicJob(job: BackupJob) {
  const percent = job.progress.percent || 0
  return {
    jobId: job.jobId,
    status: job.status,
    percent,
    leftPercent: Math.max(0, 100 - percent),
    stage: job.progress.stage,
    message: job.progress.message,
    bytesDone: job.progress.bytesDone,
    bytesTotal: job.progress.bytesTotal,
    bytesDoneLabel: job.progress.bytesDone != null ? formatBytes(job.progress.bytesDone) : undefined,
    bytesTotalLabel: job.progress.bytesTotal != null ? formatBytes(job.progress.bytesTotal) : undefined,
    error: job.error,
    token: job.token,
    filename: job.filename,
    sizeBytes: job.sizeBytes,
    sizeLabel: job.sizeBytes != null ? formatBytes(job.sizeBytes) : undefined,
    downloadPath:
      job.token && job.status === "ready"
        ? `/api/dashboard/full-backup?token=${encodeURIComponent(job.token)}&userId=${encodeURIComponent(job.userId)}`
        : undefined,
  }
}

async function runJob(job: BackupJob, includeEnv: boolean, createdBy: string, databaseUrl: string) {
  job.status = "running"
  job.progress = {
    percent: 1,
    stage: "prepare",
    message: "Hold on — starting full backup…",
  }

  try {
    await ensureDownloadRoot()
    const built = await buildFullBackupZip({
      appRoot: process.cwd(),
      databaseUrl,
      createdBy,
      includeEnv,
      onProgress: (p) => {
        job.progress = p
      },
    })

    const token = newId()
    const tokenDir = path.join(DOWNLOAD_ROOT, token)
    await fs.mkdir(tokenDir, { recursive: true })
    const stableZip = path.join(tokenDir, built.filename)
    await fs.rename(built.zipPath, stableZip).catch(async () => {
      await fs.copyFile(built.zipPath, stableZip)
      await fs.unlink(built.zipPath).catch(() => undefined)
    })
    await cleanupBackupWorkDir(built.workDir)

    const meta: StoredMeta = {
      token,
      filename: built.filename,
      zipPath: stableZip,
      workDir: tokenDir,
      sizeBytes: built.sizeBytes,
      userId: job.userId,
      createdAt: Date.now(),
    }
    prepared.set(token, meta)

    job.token = token
    job.filename = built.filename
    job.zipPath = stableZip
    job.workDir = tokenDir
    job.sizeBytes = built.sizeBytes
    job.status = "ready"
    job.progress = {
      percent: 100,
      stage: "done",
      message: "All done — download your ZIP when ready",
      bytesDone: built.sizeBytes,
      bytesTotal: built.sizeBytes,
    }
  } catch (e) {
    console.error("[full-backup] job failed", e)
    job.status = "error"
    job.error = e instanceof Error ? e.message : "Backup failed"
    job.progress = {
      percent: job.progress.percent || 0,
      stage: "error",
      message: job.error,
    }
  }
}

/**
 * POST — start async backup job
 * Body: { userId, includeEnv?: boolean }
 */
export async function POST(req: NextRequest) {
  let body: { userId?: string; includeEnv?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const auth = await assertAdmin(body.userId ?? null)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL is not configured on the server" }, { status: 500 })
  }

  await sweepOld()

  const jobId = newId()
  const job: BackupJob = {
    jobId,
    userId: auth.user.id,
    status: "queued",
    createdAt: Date.now(),
    progress: {
      percent: 0,
      stage: "queued",
      message: "Hold on — backup queued…",
    },
  }
  jobs.set(jobId, job)

  // Fire-and-forget on VPS Node server (do not await)
  void runJob(job, body.includeEnv !== false, auth.user.name || auth.user.id, databaseUrl)

  return NextResponse.json({
    jobId,
    status: job.status,
    message: "Hold on — we’re building your full backup ZIP…",
    progressPath: `/api/dashboard/full-backup?jobId=${encodeURIComponent(jobId)}&userId=${encodeURIComponent(auth.user.id)}`,
  })
}

/**
 * GET
 *  - ?jobId=&userId=  → live progress JSON
 *  - ?token=&userId=  → stream ZIP download
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  const jobId = req.nextUrl.searchParams.get("jobId")
  const token = req.nextUrl.searchParams.get("token")

  const auth = await assertAdmin(userId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (jobId) {
    const job = jobs.get(jobId)
    if (!job || job.userId !== auth.user.id) {
      return NextResponse.json({ error: "Backup job not found" }, { status: 404 })
    }
    return NextResponse.json(publicJob(job))
  }

  if (!token) {
    return NextResponse.json(
      { error: "Provide jobId (progress) or token (download)." },
      { status: 400 },
    )
  }

  const meta = prepared.get(token)
  if (!meta || meta.userId !== auth.user.id) {
    return NextResponse.json({ error: "Backup not found or expired. Create it again." }, { status: 404 })
  }
  if (!existsSync(meta.zipPath)) {
    prepared.delete(token)
    return NextResponse.json({ error: "Backup file missing. Create it again." }, { status: 404 })
  }

  const nodeStream = createReadStream(meta.zipPath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream

  const cleanup = () => {
    prepared.delete(token)
    void cleanupBackupWorkDir(meta.workDir)
  }
  nodeStream.on("close", cleanup)
  nodeStream.on("error", cleanup)

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(meta.sizeBytes),
      "Content-Disposition": `attachment; filename="${meta.filename}"`,
      "Cache-Control": "no-store",
      "X-Backup-Filename": meta.filename,
      "X-Backup-Bytes": String(meta.sizeBytes),
    },
  })
}
