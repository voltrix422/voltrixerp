"use client"

import jsPDF from "jspdf"
import type { EstimateBreakdown } from "@/lib/installment-estimate"

const INK = { r: 29, g: 29, b: 31 }
const MUTED = { r: 134, g: 134, b: 139 }
const LINE = { r: 229, g: 229, b: 234 }
const BLUE = { r: 0, g: 122, b: 255 }
const BG = { r: 245, g: 245, b: 247 }

async function loadLogoBase64(): Promise<string> {
  try {
    const res = await fetch("/logo.png")
    if (!res.ok) return ""
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

function money(n: number) {
  return `PKR ${Math.round(n).toLocaleString()}`
}

export type InstallmentEstimatePdfInput = {
  title: string
  clientName: string
  systemKw: number
  notes?: string
  lines: Array<{ name: string; amount: number; qty?: number; model?: string }>
  breakdown: EstimateBreakdown
  panelRsPerWatt?: number
  bosRsPerWatt?: number
  installationRsPerWatt?: number
  structureRsPerWatt?: number
  raisedRsPerWatt?: number
}

export async function generateInstallmentEstimatePdf(
  input: InstallmentEstimatePdfInput,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const m = 14
  const contentW = pageW - m * 2
  const logo = await loadLogoBase64()
  const bd = input.breakdown

  // Soft header bar
  doc.setFillColor(BG.r, BG.g, BG.b)
  doc.rect(0, 0, pageW, 36, "F")

  if (logo) {
    try {
      doc.addImage(logo, "PNG", m, 8, 16, 16)
    } catch {
      // skip
    }
  }
  const textX = m + (logo ? 20 : 0)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("VOLTRIX", textX, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text("Installment Estimate", textX, 19)
  doc.text(new Date().toLocaleDateString(), pageW - m, 14, { align: "right" })

  let y = 44
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(input.title || `${input.systemKw} kW estimate`, m, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const client = input.clientName?.trim() || "—"
  doc.text(`Client  ·  ${client}    ·    System  ${input.systemKw} kW  (${bd.systemWatts.toLocaleString()} W)`, m, y)
  y += 8

  // Rates strip
  doc.setFillColor(BG.r, BG.g, BG.b)
  doc.roundedRect(m, y, contentW, 12, 2, 2, "F")
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const rates = [
    `Panel ${input.panelRsPerWatt ?? "—"}/W`,
    `BOS ${input.bosRsPerWatt ?? "—"}/W`,
    `Install ${input.installationRsPerWatt ?? "—"}/W`,
    `Structure ${input.structureRsPerWatt ?? "—"}/W`,
    `Raised ${input.raisedRsPerWatt ?? "—"}/W`,
    `Advance ${bd.advancePercent}%`,
    `Factor ${bd.factor}`,
    `${bd.months} mo`,
  ].join("   ·   ")
  doc.text(rates, m + 3, y + 7.5)
  y += 18

  // Cost lines
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text("COST BREAKDOWN", m, y)
  y += 3
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.setLineWidth(0.3)
  doc.line(m, y, pageW - m, y)
  y += 5

  const lines = (input.lines || []).filter((l) => l.name.trim() && (Number(l.amount) || 0) > 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  for (const line of lines) {
    doc.setTextColor(INK.r, INK.g, INK.b)
    const label = line.model ? `${line.name} (${line.model})` : line.name
    const qty = line.qty && line.qty > 1 ? ` ×${line.qty}` : ""
    doc.text(`${label}${qty}`, m, y)
    doc.text(money(Number(line.amount) || 0), pageW - m, y, { align: "right" })
    y += 5.5
  }
  if (lines.length === 0) {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text("No cost lines", m, y)
    y += 5.5
  }

  y += 2
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.line(m, y, pageW - m, y)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text("Cost", m, y)
  doc.text(money(bd.cost), pageW - m, y, { align: "right" })
  y += 10

  // Installment card
  doc.setFillColor(BG.r, BG.g, BG.b)
  const cardH = 42
  doc.roundedRect(m, y, contentW, cardH, 3, 3, "F")
  let cy = y + 7
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(bold ? 10 : 8.5)
    doc.setTextColor(bold ? INK.r : MUTED.r, bold ? INK.g : MUTED.g, bold ? INK.b : MUTED.b)
    doc.text(label, m + 4, cy)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(value, pageW - m - 4, cy, { align: "right" })
    cy += 6
  }
  row(`Advance (${bd.advancePercent}%)`, `− ${money(bd.advance)}`)
  row("Remaining Y", money(bd.remainingY))
  row(`Y × ${bd.factor}`, money(bd.financedAmount))
  row("Total with advance", money(bd.actualCost))
  y += cardH + 8

  // Monthly highlight
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b)
  doc.roundedRect(m, y, contentW, 18, 3, 3, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`Monthly installment  ·  Y × ${bd.factor} ÷ ${bd.months}`, m + 4, y + 7)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(money(bd.monthlyInstallment), pageW - m - 4, y + 12, { align: "right" })
  y += 26

  if (input.notes?.trim()) {
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text("NOTES", m, y)
    y += 4
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(INK.r, INK.g, INK.b)
    const noteLines = doc.splitTextToSize(input.notes.trim(), contentW) as string[]
    doc.text(noteLines, m, y)
    y += noteLines.length * 4 + 6
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text("Voltrix Batteries  ·  Installment estimate  ·  Confidential", m, 287)
  doc.text("voltrixbatteries.com", pageW - m, 287, { align: "right" })

  return doc.output("blob")
}

export function downloadInstallmentEstimatePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
