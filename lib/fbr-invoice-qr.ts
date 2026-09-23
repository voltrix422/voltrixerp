/** FBR QR encodes only the official invoice number. Tax Asaan scans that number. */
export function fbrInvoiceQrText(invoiceNumber: string | undefined | null): string {
  return String(invoiceNumber || "").trim()
}

export async function fbrInvoiceQrPngDataUrl(invoiceNumber: string): Promise<string> {
  const QRCode = (await import("qrcode")).default
  return QRCode.toDataURL(fbrInvoiceQrText(invoiceNumber), {
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  })
}
