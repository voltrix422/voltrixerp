export type ParsedProductTerms = {
  title: string
  intro: string[]
  sectionTitle: string
  bullets: string[]
}

export function composeProductTermsContent(params: {
  title: string
  intro: string
  bullets: string[]
}): string {
  const title = params.title.trim()
  const intro = params.intro.trim()
  const bullets = params.bullets.map((line) => line.trim()).filter(Boolean)
  const bulletBlock = bullets
    .map((line) => (line.startsWith("-") || line.startsWith("•") ? line : `- ${line}`))
    .join("\n")

  const parts = [title]
  if (intro) parts.push("", intro)
  if (bulletBlock) parts.push("", "Terms and Conditions:", "", bulletBlock)
  return parts.join("\n").trim()
}

export function decomposeProductTermsContent(content: string): {
  title: string
  intro: string
  bullets: string[]
} {
  const parsed = parseProductTermsContent(content)
  return {
    title: parsed.title,
    intro: parsed.intro.join("\n\n"),
    bullets: parsed.bullets,
  }
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
    bullets: extractBullets(match[3]),
  }
}

function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
}

export function splitTermsTitleBadges(title: string): string[] {
  return title
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}
