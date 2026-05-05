import type { Quotation } from "@/lib/quotations"

export async function downloadQuotationPDF(quotation: Quotation) {
  try {
    const res = await fetch("/api/generate-quotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotation),
    })

    if (!res.ok) throw new Error("Failed to generate PDF")

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Quotation-${quotation.quotationNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error("Error downloading quotation PDF:", error)
    alert("Failed to download quotation PDF")
  }
}
