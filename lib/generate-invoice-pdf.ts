import type { Order } from "./orders"

export async function generateInvoicePDF(order: Order): Promise<Blob> {
  try {
    const response = await fetch('/api/generate-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    })

    if (!response.ok) {
      throw new Error('Failed to generate invoice')
    }

    const pdfBlob = await response.blob()
    return pdfBlob
  } catch (error) {
    console.error('Error generating invoice:', error)
    throw error
  }
}

export async function downloadInvoicePDF(order: Order): Promise<void> {
  const blob = await generateInvoicePDF(order)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Invoice-${order.orderNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}