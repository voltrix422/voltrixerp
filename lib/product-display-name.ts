/** Split legacy "Title | MODEL" names and optional `model` field for product pages. */
export function getProductDisplayName(product: {
  name?: string | null
  model?: string | null
}): { title: string; model: string } {
  const rawName = String(product.name ?? "").trim()
  const explicitModel = String(product.model ?? "").trim()

  if (explicitModel) {
    const pipeIdx = rawName.indexOf(" | ")
    const title = pipeIdx >= 0 ? rawName.slice(0, pipeIdx).trim() : rawName
    return { title: title || rawName, model: explicitModel }
  }

  const pipeIdx = rawName.indexOf(" | ")
  if (pipeIdx >= 0) {
    return {
      title: rawName.slice(0, pipeIdx).trim(),
      model: rawName.slice(pipeIdx + 3).trim(),
    }
  }

  return { title: rawName, model: "" }
}
