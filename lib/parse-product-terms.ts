export type ParsedProductTerms = {
  title: string
  intro: string[]
  sectionTitle: string
  bullets: string[]
}

export function parseProductTermsContent(content: string): ParsedProductTerms {
  const trimmed = content.trim()
  if (!trimmed) {
    return {
      title: "Terms & Conditions",
      intro: [],
      sectionTitle: "Terms and Conditions",
      bullets: [],
    }
  }

  const match = trimmed.match(/^([^\n]+)\n+([\s\S]*?)\n*(?:Terms and Conditions:?)\s*\n*([\s\S]*)$/i)
  if (!match) {
    return {
      title: "Terms & Conditions",
      intro: trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean),
      sectionTitle: "Terms and Conditions",
      bullets: [],
    }
  }

  return {
    title: match[1].trim(),
    intro: match[2]
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
    sectionTitle: "Terms and Conditions",
    bullets: match[3]
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean),
  }
}

export function splitTermsTitleBadges(title: string): string[] {
  return title
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}
