"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { BookMarked, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QUICK_ADD_SROS, type ImportSro } from "@/lib/import-shipment"

const inputCls =
  "w-full min-w-0 h-8 rounded border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] transition-colors"

const chipCls =
  "text-[10px] px-2 py-1 rounded border cursor-pointer transition-all duration-150 hover:bg-[hsl(var(--muted))]/50 hover:border-[hsl(var(--foreground))]/30 hover:shadow-sm active:scale-[0.98]"

export function ImportSroDrawer({
  open,
  onClose,
  sroLibrary,
  onAdd,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  sroLibrary: ImportSro[]
  onAdd: (partial?: Partial<ImportSro>) => void
  onRemove: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  function handleAdd() {
    onAdd({ code, title, description })
    setCode("")
    setTitle("")
    setDescription("")
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="SRO library">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] cursor-pointer transition-opacity"
        aria-label="Close SRO library"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-[hsl(var(--background))] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2">
              <BookMarked className="h-4 w-4 shrink-0" />
              SRO library
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Saved here · quick-add on any GD
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer transition-colors hover:bg-[hsl(var(--muted))]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">SRO code</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                className={inputCls}
                placeholder="SRO 1125(I)/2011"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className={inputCls}
                placeholder="Short title"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Notes</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs w-full cursor-pointer transition-all hover:brightness-95 hover:shadow-sm"
              onClick={handleAdd}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add SRO
            </Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Quick add
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ADD_SROS.map(q => (
                <button
                  key={q.code}
                  type="button"
                  onClick={() => onAdd(q)}
                  className={chipCls}
                  title={q.title}
                >
                  + {q.code}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Saved SROs ({sroLibrary.length})
            </p>
            {sroLibrary.length === 0 ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] border border-dashed rounded-md px-3 py-4 text-center">
                No SROs saved yet — type one or use quick-add above.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sroLibrary.map(s => (
                  <li
                    key={s.id}
                    className="rounded-md border px-3 py-2 flex items-start justify-between gap-2 transition-colors hover:bg-[hsl(var(--muted))]/20"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold truncate">{s.code}</p>
                      <p className="text-[11px] mt-0.5">{s.title || "—"}</p>
                      {s.description ? (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{s.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="text-red-600 shrink-0 p-1 rounded cursor-pointer transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => onRemove(s.id)}
                      aria-label={`Remove ${s.code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
