"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, Users, Wallet } from "lucide-react"
import { currentPayrollMonth, monthLabel } from "@/lib/generate-salary-slip-pdf"
import { FinanceStaffSalaries } from "@/components/finance/finance-staff-salaries"
import { FinanceSalesSalaries } from "@/components/finance/finance-sales-salaries"

type PayrollSection = "staff" | "sales"

export function FinancePayroll({
  initialSection = "staff",
}: {
  initialSection?: PayrollSection
}) {
  const [section, setSection] = useState<PayrollSection>(initialSection)
  const [payrollMonth, setPayrollMonth] = useState(currentPayrollMonth())

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#1faca6]" />
            Salaries & payroll
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-2xl">
            Generate and store salary slips for all company staff and sales agents. Records are
            saved in the database and PDF slips can be downloaded anytime.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
            Pay period
          </label>
          <input
            type="month"
            value={payrollMonth}
            onChange={(e) => setPayrollMonth(e.target.value)}
            className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{monthLabel(payrollMonth)}</span>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg border bg-[hsl(var(--muted))]/20 w-fit">
        <button
          type="button"
          onClick={() => setSection("staff")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium cursor-pointer ${
            section === "staff"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          All staff
        </button>
        <button
          type="button"
          onClick={() => setSection("sales")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium cursor-pointer ${
            section === "sales"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Sales agents
        </button>
      </div>

      {section === "staff" ? (
        <FinanceStaffSalaries payrollMonth={payrollMonth} />
      ) : (
        <FinanceSalesSalaries payrollMonth={payrollMonth} />
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Staff profiles are managed in{" "}
        <Link href="/hrm" className="text-[#1faca6] hover:underline">
          HRM
        </Link>
        . Sales agent compensation is set in{" "}
        <Link href="/crm/sales-agents" className="text-[#1faca6] hover:underline">
          CRM → Sales agents
        </Link>
        .
      </p>
    </div>
  )
}
