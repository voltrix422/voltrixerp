/** Client-side OCR for product label photos (camera upload). */
export async function runLabelOcrOnImageFile(file: File | Blob): Promise<string> {
  const Tesseract = await import("tesseract.js")
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: () => undefined,
  })
  return data.text || ""
}
