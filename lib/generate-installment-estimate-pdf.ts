"use client"

import jsPDF from "jspdf"
import type { EstimateBreakdown } from "@/lib/installment-estimate"

const INK = { r: 29, g: 29, b: 31 }
const MUTED = { r: 110, g: 110, b: 115 }
const FAINT = { r: 174, g: 174, b: 178 }
const LINE = { r: 232, g: 232, b: 237 }
const BLUE = { r: 0, g: 122, b: 255 }
const BG = { r: 245, g: 245, b: 247 }
const CARD = { r: 250, g: 250, b: 252 }
const ACCENT_BG = { r: 245, g: 248, b: 255 }

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
  return `PKR ${Math.round(n).toLocaleString("en-PK")}`
}

/** Avoid "Name (MODEL) (MODEL)" when name already includes model. */
function lineLabel(name: string, model?: string, qty?: number) {
  const base = String(name || "").trim()
  const m = String(model || "").trim()
  let label = base
  if (m) {
    const already =
      base.toLowerCase().includes(`(${m.toLowerCase()})`) ||
      base.toLowerCase().includes(m.toLowerCase())
    if (!already) label = `${base} (${m})`
  }
  if (qty && qty > 1) label = `${label}  x${qty}`
  return label
}

export type InstallmentEstimatePdfInput = {
  title: string
  clientName: string
  systemKw: number
  notes?: string
  lines: Array<{ name: string; amount: number; qty?: number; model?: string }>
  breakdown: EstimateBreakdown
}

export async function generateInstallmentEstimatePdf(
  input: InstallmentEstimatePdfInput,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  const m = 18
  const contentW = pageW - m * 2
  const logo = await loadLogoBase64()
  const bd = input.breakdown

  // Header bar
  doc.setFillColor(BG.r, BG.g, BG.b)
  doc.rect(0, 0, pageW, 28, "F")

  if (logo) {
    try {
      doc.addImage(logo, "PNG", m, 7, 12, 12)
    } catch {
      // skip
    }
  }
  const brandX = m + (logo ? 16 : 0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text("VOLTRIX", brandX, 12.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text("Installment Estimate", brandX, 17.5)
  doc.setFontSize(8)
  doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
  doc.text(new Date().toLocaleDateString("en-GB"), pageW - m, 14, { align: "right" })

  // Title
  let y = 38
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(INK.r, INK.g, INK.b)
  const title = input.title || `${input.systemKw} kW estimate`
  doc.text(title, m, y)
  y += 9

  // Client + System as labeled rows
  const client = input.clientName?.trim() || "—"
  const meta: Array<[string, string]> = [
    ["Client", client],
    ["System", `${input.systemKw} kW  (${bd.systemWatts.toLocaleString()} W)`],
  ]
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
    doc.text(k.toUpperCase(), m, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(v, m + 22, y)
    y += 6
  }
  y += 4

  // Cost breakdown
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
  doc.text("COST BREAKDOWN", m, y)
  y += 2
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.setLineWidth(0.35)
  doc.line(m, y, pageW - m, y)
  y += 6

  const lines = (input.lines || []).filter((l) => l.name.trim() && (Number(l.amount) || 0) > 0)
  for (const line of lines) {
    const label = lineLabel(line.name, line.model, line.qty)
    const wrapped = doc.splitTextToSize(label, contentW - 44) as string[]
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.text(wrapped, m, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.text(money(Number(line.amount) || 0), pageW - m, y, { align: "right" })
    y += Math.max(5.5, wrapped.length * 4.2)
  }

  y += 2
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.setLineWidth(0.5)
  doc.line(m, y, pageW - m, y)
  y += 7
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text("Cost", m, y)
  doc.text(money(bd.cost), pageW - m, y, { align: "right" })
  y += 10

  // Installment plan card
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
  doc.text("INSTALLMENT PLAN", m, y)
  y += 3

  const rows: Array<{ label: string; value: string; emphasize?: boolean; dim?: boolean }> = [
    { label: `Advance (${bd.advancePercent}%)`, value: `- ${money(bd.advance)}`, dim: true },
    { label: "Remaining Y", value: money(bd.remainingY) },
    { label: `Y  x  ${bd.factor}`, value: money(bd.financedAmount) },
    { label: "Total with advance", value: money(bd.actualCost), emphasize: true },
  ]
  const rowH = 8
  const cardH = 6 + rows.length * rowH
  doc.setFillColor(CARD.r, CARD.g, CARD.b)
  doc.roundedRect(m, y, contentW, cardH, 2.5, 2.5, "F")

  let cy = y + 7
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r.emphasize) {
      doc.setFillColor(ACCENT_BG.r, ACCENT_BG.g, ACCENT_BG.b)
      doc.rect(m + 1.5, cy - 5, contentW - 3, rowH - 0.5, "F")
    }
    doc.setFont("helvetica", r.emphasize ? "bold" : "normal")
    doc.setFontSize(r.emphasize ? 10 : 9)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(r.label, m + 5, cy)
    if (r.dim) {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    } else {
      doc.setTextColor(INK.r, INK.g, INK.b)
    }
    doc.setFont("helvetica", "bold")
    doc.text(r.value, pageW - m - 5, cy, { align: "right" })
    if (i < rows.length - 1 && !rows[i + 1].emphasize) {
      doc.setDrawColor(LINE.r, LINE.g, LINE.b)
      doc.setLineWidth(0.2)
      doc.line(m + 5, cy + 3, pageW - m - 5, cy + 3)
    }
    cy += rowH
  }
  y += cardH + 8

  // Monthly banner
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b)
  doc.roundedRect(m, y, contentW, 22, 3, 3, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(`Monthly installment    Y x ${bd.factor}  /  ${bd.months} months`, m + 6, y + 8)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(money(bd.monthlyInstallment), pageW - m - 6, y + 15, { align: "right" })
  y += 30

  if (input.notes?.trim()) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
    doc.text("NOTES", m, y)
    y += 4.5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(INK.r, INK.g, INK.b)
    const noteLines = doc.splitTextToSize(input.notes.trim(), contentW) as string[]
    doc.text(noteLines, m, y)
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(FAINT.r, FAINT.g, FAINT.b)
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
