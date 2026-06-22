"use client"

import { useEffect } from "react"
import { Eye } from "lucide-react"
import { useAuthWithRole } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"

const WRITE_LABEL =
  /\b(add|create|save|delete|remove|edit|update|submit|import|upload|approve|reject|merge|rename|assign|link|sync|fix phones|log outreach|set follow-up|new |manage users)\b/i

function isAllowedReadOnlyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true
  if (target.closest("[data-readonly-allow]")) return true
  if (target.closest("a[href]") && !target.closest("button")) return true
  if (target.closest("input[type='search'], input[type='date'], input[placeholder*='Search' i]")) return true
  if (target.closest("select[data-filter], [data-filter] select")) return true
  return false
}

function isWriteActionTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const el = target.closest("button, [role='button'], input[type='submit'], label[for]") as HTMLElement | null
  if (!el) return false
  if (el.closest("[data-readonly-allow]")) return false
  const text = `${el.textContent || ""} ${el.getAttribute("title") || ""} ${el.getAttribute("aria-label") || ""}`
  if (WRITE_LABEL.test(text)) return true
  if (el.querySelector('[class*="lucide-trash"], [class*="lucide-pencil"], [class*="lucide-plus"]')) return true
  return false
}

export function ErpWriteProtection({ children }: { children: React.ReactNode }) {
  const { readOnly } = useAuthWithRole()
  const { toast } = useToast()

  useEffect(() => {
    if (!readOnly) return

    function onClick(event: MouseEvent) {
      if (isAllowedReadOnlyTarget(event.target)) return
      if (!isWriteActionTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      toast({
        type: "info",
        title: "View only account",
        message: "You can browse this page but cannot create or change records.",
      })
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target
      if (form instanceof HTMLFormElement && !form.closest("[data-readonly-allow]")) {
        event.preventDefault()
        event.stopPropagation()
        toast({
          type: "info",
          title: "View only account",
          message: "You cannot submit forms with a view-only account.",
        })
      }
    }

    document.addEventListener("click", onClick, true)
    document.addEventListener("submit", onSubmit, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("submit", onSubmit, true)
    }
  }, [readOnly, toast])

  if (!readOnly) return <>{children}</>

  return (
    <>
      <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>View only</strong> — you can open assigned pages and browse data, but cannot create, edit, or delete anything.
        </span>
      </div>
      {children}
    </>
  )
}
