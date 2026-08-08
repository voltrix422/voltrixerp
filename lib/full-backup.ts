import { execFile } from "child_process"
import { createWriteStream, createReadStream } from "fs"
import { promises as fs } from "fs"
import os from "os"
import path from "path"
import { promisify } from "util"
import { finished } from "stream/promises"
import { Readable } from "stream"
import { ZipArchive } from "archiver"

const execFileAsync = promisify(execFile)

export type BackupProgress = {
  percent: number
  stage: string
  message: string
  bytesDone?: number
  bytesTotal?: number
}

export type BackupProgressFn = (p: BackupProgress) => void

export type BackupManifest = {
  createdAt: string
  createdBy: string
  appRoot: string
  hostname: string
  includes: string[]
  notes: string[]
}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function pathExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function dirSizeApprox(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0
  async function walk(current: string) {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(current, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile()) {
        files++
        try {
          bytes += (await fs.stat(full)).size
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (await pathExists(dir)) await walk(dir)
  return { files, bytes }
}

/** Copy directory while reporting file progress (0–1 within this step). */
async function copyDirWithProgress(
  src: string,
  dest: string,
  onFileProgress: (done: number, total: number) => void,
) {
  const stats = await dirSizeApprox(src)
  const totalFiles = Math.max(1, stats.files)
  let doneFiles = 0

  async function walk(from: string, to: string) {
    await fs.mkdir(to, { recursive: true })
    const entries = await fs.readdir(from, { withFileTypes: true })
    for (const e of entries) {
      const s = path.join(from, e.name)
      const d = path.join(to, e.name)
      if (e.isDirectory()) {
        await walk(s, d)
      } else if (e.isFile()) {
        await fs.copyFile(s, d)
        doneFiles++
        onFileProgress(doneFiles, totalFiles)
      }
    }
  }

  await walk(src, dest)
  return stats
}

async function runPgDump(databaseUrl: string, outFile: string) {
  try {
    await execFileAsync(
      "pg_dump",
      [databaseUrl, "-Fc", "-f", outFile],
      { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 },
    )
    return "dump" as const
  } catch (first) {
    try {
      await execFileAsync(
        "pg_dump",
        [databaseUrl, "--no-owner", "--no-acl", "-f", outFile.replace(/\.dump$/i, ".sql")],
        { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 },
      )
      return "sql" as const
    } catch {
      throw first
    }
  }
}

export async function buildFullBackupZip(opts: {
  appRoot: string
  databaseUrl: string
  createdBy: string
  includeEnv: boolean
  onProgress?: BackupProgressFn
}): Promise<{ zipPath: string; workDir: string; filename: string; sizeBytes: number; report: string }> {
  const { appRoot, databaseUrl, createdBy, includeEnv, onProgress } = opts
  const reportProgress = (p: BackupProgress) => {
    onProgress?.({
      ...p,
      percent: clampPercent(p.percent),
    })
  }

  const tag = stamp()
  const folderName = `voltrix-erp-backup-${tag}`
  const filename = `${folderName}.zip`
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "voltrix-backup-"))
  const staging = path.join(workDir, folderName)
  const zipPath = path.join(workDir, filename)
  await fs.mkdir(staging, { recursive: true })

  const includes: string[] = []
  const notes: string[] = []

  reportProgress({
    percent: 2,
    stage: "prepare",
    message: "Hold on — preparing backup workspace…",
  })

  // ── Database (0–28%) ──────────────────────────────────────
  reportProgress({
    percent: 5,
    stage: "database",
    message: "Hold on — dumping the full database (this can take a minute)…",
  })
  const dumpPath = path.join(staging, "database.dump")
  try {
    const kind = await runPgDump(databaseUrl, dumpPath)
    if (kind === "dump" && (await pathExists(dumpPath))) {
      includes.push("database.dump (PostgreSQL custom format)")
    } else if (await pathExists(path.join(staging, "database.sql"))) {
      includes.push("database.sql (PostgreSQL plain SQL)")
    }
    reportProgress({
      percent: 28,
      stage: "database",
      message: "Database dump complete ✓",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    notes.push(`Database dump failed: ${msg}`)
    await fs.writeFile(
      path.join(staging, "DATABASE-DUMP-FAILED.txt"),
      `pg_dump failed.\n${msg}\n\nInstall PostgreSQL client tools (pg_dump) on the server and ensure DATABASE_URL is reachable.\n`,
      "utf8",
    )
    reportProgress({
      percent: 28,
      stage: "database",
      message: "Database dump skipped (see report) — continuing…",
    })
  }

  // ── Uploads (28–58%) ──────────────────────────────────────
  const uploadsSrc = path.join(appRoot, "public", "uploads")
  if (await pathExists(uploadsSrc)) {
    reportProgress({
      percent: 30,
      stage: "uploads",
      message: "Hold on — copying all uploads (proofs, images, docs)…",
    })
    const uploadsDest = path.join(staging, "uploads")
    const stats = await copyDirWithProgress(uploadsSrc, uploadsDest, (done, total) => {
      const frac = done / total
      reportProgress({
        percent: 30 + frac * 28,
        stage: "uploads",
        message: `Copying uploads… ${done.toLocaleString()} / ${total.toLocaleString()} files`,
        bytesDone: done,
        bytesTotal: total,
      })
    })
    includes.push(`uploads/ (${stats.files} files, ~${Math.round(stats.bytes / 1024 / 1024)} MB)`)
    reportProgress({
      percent: 58,
      stage: "uploads",
      message: `Uploads copied ✓ (${stats.files.toLocaleString()} files)`,
    })
  } else {
    await fs.mkdir(path.join(staging, "uploads"), { recursive: true })
    notes.push("public/uploads was missing — empty uploads/ included")
    includes.push("uploads/ (empty)")
    reportProgress({ percent: 58, stage: "uploads", message: "No uploads folder — continuing…" })
  }

  // ── Data + schema + env (58–70%) ──────────────────────────
  reportProgress({
    percent: 60,
    stage: "data",
    message: "Hold on — packing website data & schema…",
  })
  const dataSrc = path.join(appRoot, "data")
  const dataDest = path.join(staging, "data")
  await fs.mkdir(dataDest, { recursive: true })
  if (await pathExists(dataSrc)) {
    const entries = await fs.readdir(dataSrc)
    for (const name of entries) {
      if (name === ".gitkeep") continue
      if (name.startsWith("products.json.vps-backup-")) continue
      const from = path.join(dataSrc, name)
      const st = await fs.stat(from)
      if (st.isFile()) {
        await fs.copyFile(from, path.join(dataDest, name))
        includes.push(`data/${name}`)
      }
    }
  }
  const products = path.join(dataDest, "products.json")
  if (await pathExists(products)) {
    await fs.copyFile(products, path.join(staging, "products.json"))
  } else {
    await fs.writeFile(path.join(staging, "products.json"), "[]", "utf8")
  }

  const schemaSrc = path.join(appRoot, "prisma", "schema.prisma")
  if (await pathExists(schemaSrc)) {
    await fs.mkdir(path.join(staging, "prisma"), { recursive: true })
    await fs.copyFile(schemaSrc, path.join(staging, "prisma", "schema.prisma"))
    includes.push("prisma/schema.prisma")
  }

  const envSrc = path.join(appRoot, ".env")
  if (includeEnv && (await pathExists(envSrc))) {
    await fs.copyFile(envSrc, path.join(staging, "env.backup"))
    includes.push("env.backup (contains secrets — keep private)")
  } else if (!includeEnv) {
    notes.push(".env excluded from this download")
  }

  reportProgress({ percent: 68, stage: "data", message: "Data files packed ✓" })

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    createdBy,
    appRoot,
    hostname: os.hostname(),
    includes,
    notes,
  }
  const report = [
    "Voltrix ERP — Full system backup",
    `Created: ${manifest.createdAt}`,
    `Created by: ${createdBy}`,
    `Server: ${manifest.hostname}`,
    `App path: ${appRoot}`,
    "",
    "Contents:",
    ...includes.map((i) => `  - ${i}`),
    "",
    notes.length ? "Notes:" : "",
    ...notes.map((n) => `  - ${n}`),
    "",
    "Restore hints:",
    "  1. Database:  pg_restore -d YOUR_DATABASE_URL --clean --if-exists database.dump",
    "     (or psql YOUR_DATABASE_URL < database.sql if SQL dump)",
    "  2. Copy uploads/ → public/uploads/",
    "  3. Copy data/*.json → data/",
    "  4. env.backup → .env (review secrets before use)",
    "",
  ]
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n")

  await fs.writeFile(path.join(staging, "BACKUP-REPORT.txt"), report, "utf8")
  await fs.writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

  reportProgress({
    percent: 72,
    stage: "zip",
    message: "Hold on — compressing everything into a ZIP…",
  })

  // ── Zip (72–98%) ──────────────────────────────────────────
  const stagingStats = await dirSizeApprox(staging)
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 6 } })
    output.on("error", reject)
    archive.on("error", reject)
    archive.on("warning", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") reject(err)
    })
    archive.on("progress", (progress) => {
      const processed = progress.fs?.processedBytes || 0
      const total = Math.max(processed, progress.fs?.totalBytes || stagingStats.bytes || 1)
      const frac = Math.min(1, processed / total)
      reportProgress({
        percent: 72 + frac * 26,
        stage: "zip",
        message: `Zipping… ${formatBytes(processed)} / ${formatBytes(total)}`,
        bytesDone: processed,
        bytesTotal: total,
      })
    })
    archive.pipe(output)
    archive.directory(staging, false)
    void archive.finalize()
    finished(output).then(() => resolve()).catch(reject)
  })

  const sizeBytes = (await fs.stat(zipPath)).size
  reportProgress({
    percent: 100,
    stage: "done",
    message: "Backup ready — you can download the ZIP now",
    bytesDone: sizeBytes,
    bytesTotal: sizeBytes,
  })

  return { zipPath, workDir, filename, sizeBytes, report }
}

export function formatBytes(n: number) {
  if (!n || n < 1024) return `${n || 0} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function openZipReadStream(zipPath: string) {
  return createReadStream(zipPath)
}

export function zipToWebStream(zipPath: string): ReadableStream {
  const nodeStream = createReadStream(zipPath)
  return Readable.toWeb(nodeStream) as ReadableStream
}

export async function cleanupBackupWorkDir(workDir: string) {
  try {
    await fs.rm(workDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
