declare module "archiver" {
  import { Transform } from "stream"

  export class Archiver extends Transform {
    directory(dirpath: string, destpath: string | false): this
    file(filepath: string, data: { name: string }): this
    finalize(): Promise<void>
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T
    on(event: "progress", listener: (progress: {
      entries?: { total?: number; processed?: number }
      fs?: { totalBytes?: number; processedBytes?: number }
    }) => void): this
    on(event: "error" | "warning", listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export class ZipArchive extends Archiver {
    constructor(options?: { zlib?: { level?: number } })
  }

  export class TarArchive extends Archiver {
    constructor(options?: Record<string, unknown>)
  }

  export class JsonArchive extends Archiver {
    constructor(options?: Record<string, unknown>)
  }
}
