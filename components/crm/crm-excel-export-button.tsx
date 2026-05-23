"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  onExport: () => void
  exporting?: boolean
  disabled?: boolean
  label?: string
  className?: string
}

export function CrmExcelExportButton({
  onExport,
  exporting,
  disabled,
  label = "Export Excel",
  className,
}: Props) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className ?? "h-8 text-xs gap-1.5 cursor-pointer shrink-0"}
      disabled={disabled || exporting}
      onClick={onExport}
    >
      <Download className="h-3.5 w-3.5" />
      {exporting ? "Exporting…" : label}
    </Button>
  )
}
