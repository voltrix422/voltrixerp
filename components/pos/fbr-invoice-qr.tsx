"use client"

import { useEffect, useState } from "react"
import { fbrInvoiceQrText } from "@/lib/fbr-invoice-qr"

export function FbrInvoiceQr({ invoiceNumber }: { invoiceNumber: string }) {
  const text = fbrInvoiceQrText(invoiceNumber)
  const [src, setSrc] = useState("")

  useEffect(() => {
    if (!text) {
      setSrc("")
      return
    }
    let cancelled = false
    void import("qrcode").then((mod) =>
      mod.default.toDataURL(text, { width: 160, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancelled) setSrc(url)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [text])

  if (!text) return null

  return (
    <div className="flex items-start gap-3 pt-1">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`FBR invoice QR ${text}`}
          className="h-24 w-24 shrink-0 rounded-sm border bg-white p-1"
        />
      ) : (
        <div className="h-24 w-24 shrink-0 rounded-sm border bg-[hsl(var(--muted))]" />
      )}
      <div className="min-w-0 space-y-1">
        <p className="font-mono text-xs break-all">{text}</p>
        <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
          Customer scans this QR in Tax Asaan → FBR POS → Verify Invoice, or SMS{" "}
          <span className="font-medium">INV</span> + CNIC + this number to 9966.
        </p>
      </div>
    </div>
  )
}
