import type { Todo } from "@/lib/todos"
import { cadenceLabel, formatReminderTime, statusLabel } from "@/lib/todos"

type PersonBucket = {
  userId: string
  name: string
  open: number
  inProgress: number
  pending: number
  done: number
  overdue: number
  items: Todo[]
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isOverdue(todo: Todo) {
  if (todo.status === "done" || !todo.dueAt) return false
  const due = new Date(todo.dueAt)
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now()
}

function statusSortRank(status: string) {
  if (status === "pending_approval") return 0
  if (status === "open") return 1
  if (status === "in_progress") return 2
  if (status === "done") return 4
  return 3
}

function buildPeople(todos: Todo[]): PersonBucket[] {
  const map = new Map<string, PersonBucket>()
  for (const t of todos) {
    const key = t.assigneeUserId || t.assigneeName || "unknown"
    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        userId: t.assigneeUserId,
        name: t.assigneeName || "Unassigned",
        open: 0,
        inProgress: 0,
        pending: 0,
        done: 0,
        overdue: 0,
        items: [],
      }
      map.set(key, bucket)
    }
    bucket.items.push(t)
    if (t.status === "open") bucket.open += 1
    else if (t.status === "in_progress") bucket.inProgress += 1
    else if (t.status === "pending_approval") bucket.pending += 1
    else if (t.status === "done") bucket.done += 1
    if (isOverdue(t)) bucket.overdue += 1
  }
  for (const bucket of map.values()) {
    bucket.items.sort((a, b) => {
      const r = statusSortRank(String(a.status)) - statusSortRank(String(b.status))
      if (r !== 0) return r
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
      return ad - bd
    })
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export type TodosOverviewExportMeta = {
  exportedBy?: string
  filterLabel?: string
}

/** Admin bird's-eye PDF: people summary + every to-do with status / due / overdue / pending. */
export async function downloadTodosOverviewPdf(
  todos: Todo[],
  meta: TodosOverviewExportMeta = {},
) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableModule as any).default || autoTableModule

  const people = buildPeople(todos)
  const open = todos.filter((t) => t.status === "open").length
  const inProgress = todos.filter((t) => t.status === "in_progress").length
  const pending = todos.filter((t) => t.status === "pending_approval").length
  const done = todos.filter((t) => t.status === "done").length
  const overdue = todos.filter((t) => isOverdue(t)).length

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  const teal: [number, number, number] = [31, 172, 166]
  const black: [number, number, number] = [20, 20, 20]
  const muted: [number, number, number] = [100, 100, 100]

  let y = margin
  doc.setTextColor(...black)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Voltrix To-do — Bird's-eye overview", margin, y + 5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  const when = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  doc.text(`Exported ${when}${meta.exportedBy ? ` · ${meta.exportedBy}` : ""}`, pageW - margin, y + 5, {
    align: "right",
  })
  y += 10

  if (meta.filterLabel) {
    doc.setFontSize(8)
    doc.text(meta.filterLabel, margin, y)
    y += 5
  }

  const chips: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "Total", value: String(todos.length), color: black },
    { label: "Open", value: String(open), color: [180, 120, 20] },
    { label: "In progress", value: String(inProgress), color: [30, 110, 180] },
    { label: "Pending approval", value: String(pending), color: [110, 60, 170] },
    { label: "Overdue", value: String(overdue), color: [180, 40, 40] },
    { label: "Done", value: String(done), color: [20, 130, 90] },
    { label: "People", value: String(people.length), color: teal },
  ]

  const chipGap = 2.5
  const chipW = (pageW - margin * 2 - chipGap * (chips.length - 1)) / chips.length
  chips.forEach((chip, i) => {
    const x = margin + i * (chipW + chipGap)
    doc.setDrawColor(...chip.color)
    doc.setLineWidth(0.4)
    doc.setFillColor(252, 252, 252)
    doc.roundedRect(x, y, chipW, 12, 1.5, 1.5, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...muted)
    doc.text(chip.label, x + 2.5, y + 4)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(...chip.color)
    doc.text(chip.value, x + 2.5, y + 9.5)
  })
  y += 16

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...black)
  doc.text("By person", margin, y)
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Person", "Total", "Open", "In progress", "Pending", "Overdue", "Done"]],
    body: people.map((p) => [
      p.name,
      String(p.items.length),
      String(p.open),
      String(p.inProgress),
      String(p.pending),
      String(p.overdue),
      String(p.done),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: black,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: teal,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 250] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center", textColor: [180, 40, 40] },
      6: { halign: "center" },
    },
    didParseCell: (data: { section: string; column: { index: number }; cell: { text: string[]; styles: { textColor?: number[] } } }) => {
      if (data.section !== "body") return
      if (data.column.index === 5 && Number(data.cell.text[0] || 0) > 0) {
        data.cell.styles.textColor = [180, 40, 40]
      }
      if (data.column.index === 4 && Number(data.cell.text[0] || 0) > 0) {
        data.cell.styles.textColor = [110, 60, 170]
      }
    },
  })

  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 8

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...black)
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage()
    y = margin
  }
  doc.text("All to-dos (detail)", margin, y)
  y += 2

  const detailRows = people.flatMap((p) =>
    p.items.map((t) => {
      const overdueFlag = isOverdue(t)
      const flags: string[] = []
      if (overdueFlag) flags.push("OVERDUE")
      if (t.status === "pending_approval") flags.push("AWAITING APPROVAL")
      if (t.latePenaltyPoints > 0) flags.push(`Late −${t.latePenaltyPoints} pts`)
      const reminder = formatReminderTime(t.reminderTime)
      return [
        p.name,
        t.title || "—",
        statusLabel(String(t.status)),
        cadenceLabel(String(t.cadence)) + (reminder ? ` · ${reminder}` : ""),
        fmtWhen(t.dueAt),
        flags.join(" · ") || "—",
        t.assignedBy || "—",
      ]
    }),
  )

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Person", "To-do", "Status", "Cadence", "Due", "Flags", "Assigned by"]],
    body: detailRows.length
      ? detailRows
      : [["—", "No to-dos in this export", "—", "—", "—", "—", "—"]],
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: black,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 70 },
      2: { cellWidth: 28 },
      3: { cellWidth: 36 },
      4: { cellWidth: 34 },
      5: { cellWidth: 42 },
      6: { cellWidth: 30 },
    },
    didParseCell: (data: {
      section: string
      column: { index: number }
      row: { raw?: string[] }
      cell: { styles: { textColor?: number[]; fontStyle?: string } }
    }) => {
      if (data.section !== "body") return
      const flags = String(data.row.raw?.[5] || "")
      if (data.column.index === 2) {
        const status = String(data.row.raw?.[2] || "").toLowerCase()
        if (status.includes("pending")) data.cell.styles.textColor = [110, 60, 170]
        else if (status.includes("progress")) data.cell.styles.textColor = [30, 110, 180]
        else if (status === "open") data.cell.styles.textColor = [180, 120, 20]
        else if (status === "done") data.cell.styles.textColor = [20, 130, 90]
      }
      if (data.column.index === 5 && flags.includes("OVERDUE")) {
        data.cell.styles.textColor = [180, 40, 40]
        data.cell.styles.fontStyle = "bold"
      }
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(
      `Voltrix ERP · To-do overview · page ${i}/${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" },
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`Voltrix-Todos-Overview-${stamp}.pdf`)
}
