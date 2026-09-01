import type { ExtensiveQuotation } from "@/lib/extensive-quotations"

export async function downloadExtensiveQuotationPDF(quote: ExtensiveQuotation) {
  const res = await fetch("/api/generate-extensive-quotation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quote),
  })
  if (!res.ok) throw new Error("Failed to generate PDF")
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Quotation-${quote.quotationNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
