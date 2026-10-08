import {
  chargeAmountPkr,
  chargeTypeLabel,
  importDisplayName,
  STATUS_LABELS,
  type ImportShipment,
} from "@/lib/import-shipment"
import {
  effectiveImportCharges,
  isImportOtherCharge,
  isPswCharge,
} from "@/lib/finance-import-outflows"
import { downloadPlainReportPdf, pkr, type PlainTable } from "@/lib/plain-report-pdf"

export type ImportPswChargesLine = {
  shipmentId: string
  shipmentLabel: string
  supplier: string
  bl: string
  gd: string
  status: string
  kind: "PSW" | "Charge"
  category: string
  description: string
  amountPkr: number
  paid: boolean
}

export type ImportPswChargesShipmentRow = {
  id: string
  label: string
  supplier: string
  bl: string
  gd: string
  status: string
  currency: string
  fxRate: number
  pswPkr: number
  chargesPkr: number
  combinedPkr: number
}

function buildRows(shipments: ImportShipment[]): {
  lines: ImportPswChargesLine[]
  byShipment: ImportPswChargesShipmentRow[]
  pswTotal: number
  chargesTotal: number
  combinedTotal: number
} {
  const lines: ImportPswChargesLine[] = []
  const byShipment: ImportPswChargesShipmentRow[] = []
  let pswTotal = 0
  let chargesTotal = 0

  for (const sh of shipments) {
    const fx = Number(sh.fxRate) || 0
    const label = importDisplayName(sh)
    const supplier = String(sh.supplierName || "").trim() || "—"
    const bl = String(sh.blNumber || "").trim() || "—"
    const gd = String(sh.gdNumber || "").trim() || "—"
    const status = STATUS_LABELS[sh.status] || sh.status || "—"
    const charges = effectiveImportCharges(sh)
    let shPsw = 0
    let shCharges = 0

    for (const c of charges) {
      const amt = chargeAmountPkr(c, fx)
      if (amt <= 0.004) continue
      const category = chargeTypeLabel(c)
      const description = String(c.description || "").trim() || category
      if (isPswCharge(c)) {
        shPsw += amt
        lines.push({
          shipmentId: sh.id,
          shipmentLabel: label,
          supplier,
          bl,
          gd,
          status,
          kind: "PSW",
          category,
          description,
          amountPkr: amt,
          paid: Boolean(c.paid),
        })
      } else if (isImportOtherCharge(c)) {
        shCharges += amt
        lines.push({
          shipmentId: sh.id,
          shipmentLabel: label,
          supplier,
          bl,
          gd,
          status,
          kind: "Charge",
          category,
          description,
          amountPkr: amt,
          paid: Boolean(c.paid),
        })
      }
    }

    byShipment.push({
      id: sh.id,
      label,
      supplier,
      bl,
      gd,
      status,
      currency: String(sh.currency || "PKR"),
      fxRate: fx,
      pswPkr: shPsw,
      chargesPkr: shCharges,
      combinedPkr: shPsw + shCharges,
    })
    pswTotal += shPsw
    chargesTotal += shCharges
  }

  byShipment.sort((a, b) => b.combinedPkr - a.combinedPkr)
  return {
    lines,
    byShipment,
    pswTotal,
    chargesTotal,
    combinedTotal: pswTotal + chargesTotal,
  }
}

export async function downloadImportsPswChargesPdf(
  shipments: ImportShipment[],
  opts?: { exportedBy?: string; scopeLabel?: string },
) {
  if (!shipments.length) throw new Error("No imports to export.")
  const data = buildRows(shipments)
  const generated = new Date().toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const scope = opts?.scopeLabel || "All imports"

  const tables: PlainTable[] = [
    {
      title: "Summary",
      columns: [
        { header: "Metric", width: 90 },
        { header: "Value", align: "right", width: 50 },
      ],
      rows: [
        ["Imports", String(shipments.length)],
        ["PSW / customs duties", pkr(data.pswTotal)],
        ["Landing & other charges", pkr(data.chargesTotal)],
        ["Combined (PSW + charges)", pkr(data.combinedTotal)],
        ["Line items", String(data.lines.length)],
      ],
    },
    {
      title: "By import",
      columns: [
        { header: "Import", width: 28 },
        { header: "Supplier", width: 36 },
        { header: "B/L", width: 24, small: true },
        { header: "GD", width: 22, small: true },
        { header: "Status", width: 18 },
        { header: "PSW", align: "right", width: 22 },
        { header: "Charges", align: "right", width: 22 },
        { header: "Total", align: "right", width: 22 },
      ],
      rows: data.byShipment.map((r) => [
        r.label,
        r.supplier,
        r.bl,
        r.gd,
        r.status,
        pkr(r.pswPkr),
        pkr(r.chargesPkr),
        pkr(r.combinedPkr),
      ]),
      foot: [
        "",
        String(data.byShipment.length),
        "",
        "",
        "",
        pkr(data.pswTotal),
        pkr(data.chargesTotal),
        pkr(data.combinedTotal),
      ],
    },
    {
      title: "PSW duties detail",
      columns: [
        { header: "Import", width: 26 },
        { header: "Supplier", width: 30 },
        { header: "Type", width: 28 },
        { header: "Description", width: 40, small: true },
        { header: "Paid", width: 12 },
        { header: "Amount", align: "right", width: 24 },
      ],
      rows: data.lines.filter((l) => l.kind === "PSW").length
        ? data.lines
            .filter((l) => l.kind === "PSW")
            .map((l) => [
              l.shipmentLabel,
              l.supplier,
              l.category,
              l.description,
              l.paid ? "Yes" : "No",
              pkr(l.amountPkr),
            ])
        : [["No PSW duty lines", "", "", "", "", ""]],
      foot: data.lines.some((l) => l.kind === "PSW")
        ? ["", "", "", "", "", pkr(data.pswTotal)]
        : undefined,
    },
    {
      title: "Charges detail",
      columns: [
        { header: "Import", width: 26 },
        { header: "Supplier", width: 30 },
        { header: "Type", width: 28 },
        { header: "Description", width: 40, small: true },
        { header: "Paid", width: 12 },
        { header: "Amount", align: "right", width: 24 },
      ],
      rows: data.lines.filter((l) => l.kind === "Charge").length
        ? data.lines
            .filter((l) => l.kind === "Charge")
            .map((l) => [
              l.shipmentLabel,
              l.supplier,
              l.category,
              l.description,
              l.paid ? "Yes" : "No",
              pkr(l.amountPkr),
            ])
        : [["No charge lines", "", "", "", "", ""]],
      foot: data.lines.some((l) => l.kind === "Charge")
        ? ["", "", "", "", "", pkr(data.chargesTotal)]
        : undefined,
    },
  ]

  await downloadPlainReportPdf({
    title: "Imports — PSW & charges",
    subtitle: scope,
    meta: [
      `${shipments.length} import${shipments.length === 1 ? "" : "s"}${opts?.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
      `Generated  ${generated}  (Pakistan time)`,
    ],
    filename: `imports-psw-charges-${new Date().toISOString().slice(0, 10)}.pdf`,
    compact: true,
    landscape: true,
    tables,
    closingBanner: {
      title: "Combined totals",
      lines: [
        { label: "PSW / customs duties", value: pkr(data.pswTotal) },
        { label: "Landing & other charges", value: pkr(data.chargesTotal) },
        { label: "Combined · PSW + charges", value: pkr(data.combinedTotal) },
      ],
    },
  })
}

export async function downloadImportsPswChargesExcel(
  shipments: ImportShipment[],
  opts?: { exportedBy?: string; scopeLabel?: string },
) {
  if (!shipments.length) throw new Error("No imports to export.")
  const data = buildRows(shipments)
  const ExcelJSMod = await import("exceljs")
  const ExcelJS = ExcelJSMod.default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Voltrix ERP"
  wb.created = new Date()
  const scope = opts?.scopeLabel || "All imports"
  const generated = new Date().toLocaleString("en-PK")

  const paintHeader = (row: { eachCell: (cb: (cell: any) => void) => void; height?: number }) => {
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1FACA6" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
      cell.alignment = { vertical: "middle", wrapText: true }
    })
    row.height = 20
  }
  const money = (cell: any) => {
    cell.numFmt = "#,##0"
    cell.alignment = { horizontal: "right", vertical: "middle" }
  }
  const highlightRow = (row: any) => {
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F7F6" } }
      cell.font = { bold: true, size: 12, color: { argb: "FF0D7370" } }
    })
    row.height = 22
  }

  // Combined
  const combined = wb.addWorksheet("Combined", { properties: { tabColor: { argb: "FF1FACA6" } } })
  combined.addRow(["VOLTRIX — Imports PSW & charges"]).font = {
    bold: true,
    size: 16,
    color: { argb: "FF134E4A" },
  }
  combined.addRow([`Scope: ${scope}`])
  combined.addRow([
    `Generated: ${generated}${opts?.exportedBy ? ` · ${opts.exportedBy}` : ""}`,
  ])
  combined.addRow([])
  paintHeader(combined.addRow(["Metric", "Amount (PKR)"]))
  combined.addRow(["Imports", shipments.length])
  const r1 = combined.addRow(["PSW / customs duties", data.pswTotal])
  money(r1.getCell(2))
  const r2 = combined.addRow(["Landing & other charges", data.chargesTotal])
  money(r2.getCell(2))
  combined.addRow([])
  combined.addRow(["COMBINED TOTALS"]).font = { bold: true, size: 12, color: { argb: "FF0D7370" } }
  const c1 = combined.addRow(["PSW / customs duties", data.pswTotal])
  money(c1.getCell(2))
  highlightRow(c1)
  const c2 = combined.addRow(["Landing & other charges", data.chargesTotal])
  money(c2.getCell(2))
  highlightRow(c2)
  const c3 = combined.addRow(["Combined · PSW + charges", data.combinedTotal])
  money(c3.getCell(2))
  highlightRow(c3)
  combined.getColumn(1).width = 36
  combined.getColumn(2).width = 20

  // By import
  const byImp = wb.addWorksheet("By import", { properties: { tabColor: { argb: "FF0EA5E9" } } })
  byImp.addRow(["By import — PSW / charges / total"]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF134E4A" },
  }
  byImp.addRow([])
  paintHeader(
    byImp.addRow([
      "Import",
      "Supplier",
      "B/L",
      "GD",
      "Status",
      "Currency",
      "FX",
      "PSW (PKR)",
      "Charges (PKR)",
      "Total (PKR)",
    ]),
  )
  for (const r of data.byShipment) {
    const row = byImp.addRow([
      r.label,
      r.supplier,
      r.bl,
      r.gd,
      r.status,
      r.currency,
      r.fxRate || "",
      r.pswPkr,
      r.chargesPkr,
      r.combinedPkr,
    ])
    money(row.getCell(8))
    money(row.getCell(9))
    money(row.getCell(10))
  }
  const foot = byImp.addRow([
    "",
    `${data.byShipment.length} imports`,
    "",
    "",
    "",
    "",
    "TOTAL",
    data.pswTotal,
    data.chargesTotal,
    data.combinedTotal,
  ])
  foot.font = { bold: true }
  money(foot.getCell(8))
  money(foot.getCell(9))
  money(foot.getCell(10))
  highlightRow(foot)
  ;[18, 28, 18, 16, 14, 10, 10, 14, 14, 14].forEach((w, i) => {
    byImp.getColumn(i + 1).width = w
  })
  byImp.views = [{ state: "frozen", ySplit: 3 }]

  // PSW sheet
  const pswSheet = wb.addWorksheet("PSW duties", { properties: { tabColor: { argb: "FFF59E0B" } } })
  pswSheet.addRow(["PSW / customs duties — all imports"]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF134E4A" },
  }
  pswSheet.addRow([])
  paintHeader(
    pswSheet.addRow([
      "Import",
      "Supplier",
      "B/L",
      "GD",
      "Status",
      "Type",
      "Description",
      "Paid",
      "Amount (PKR)",
    ]),
  )
  const pswLines = data.lines.filter((l) => l.kind === "PSW")
  for (const l of pswLines) {
    const row = pswSheet.addRow([
      l.shipmentLabel,
      l.supplier,
      l.bl,
      l.gd,
      l.status,
      l.category,
      l.description,
      l.paid ? "Yes" : "No",
      l.amountPkr,
    ])
    money(row.getCell(9))
  }
  const pswFoot = pswSheet.addRow(["", "", "", "", "", "", "TOTAL", "", data.pswTotal])
  pswFoot.font = { bold: true }
  money(pswFoot.getCell(9))
  highlightRow(pswFoot)
  ;[18, 26, 16, 14, 12, 22, 32, 8, 14].forEach((w, i) => {
    pswSheet.getColumn(i + 1).width = w
  })
  pswSheet.views = [{ state: "frozen", ySplit: 3 }]

  // Charges sheet
  const chSheet = wb.addWorksheet("Charges", { properties: { tabColor: { argb: "FF8B5CF6" } } })
  chSheet.addRow(["Landing & other charges — all imports"]).font = {
    bold: true,
    size: 13,
    color: { argb: "FF134E4A" },
  }
  chSheet.addRow([])
  paintHeader(
    chSheet.addRow([
      "Import",
      "Supplier",
      "B/L",
      "GD",
      "Status",
      "Type",
      "Description",
      "Paid",
      "Amount (PKR)",
    ]),
  )
  const chargeLines = data.lines.filter((l) => l.kind === "Charge")
  for (const l of chargeLines) {
    const row = chSheet.addRow([
      l.shipmentLabel,
      l.supplier,
      l.bl,
      l.gd,
      l.status,
      l.category,
      l.description,
      l.paid ? "Yes" : "No",
      l.amountPkr,
    ])
    money(row.getCell(9))
  }
  const chFoot = chSheet.addRow(["", "", "", "", "", "", "TOTAL", "", data.chargesTotal])
  chFoot.font = { bold: true }
  money(chFoot.getCell(9))
  highlightRow(chFoot)
  ;[18, 26, 16, 14, 12, 22, 32, 8, 14].forEach((w, i) => {
    chSheet.getColumn(i + 1).width = w
  })
  chSheet.views = [{ state: "frozen", ySplit: 3 }]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `imports-psw-charges-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
