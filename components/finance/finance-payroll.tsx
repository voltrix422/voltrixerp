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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#1faca6] shrink-0" />
            Salaries & payroll
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-2xl leading-relaxed">
            Generate and store salary slips for all company staff and sales agents. Records are
            saved in the database and PDF slips can be downloaded anytime.
          </p>
        </div>
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:items-end">
          <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
            Pay period
          </label>
          <input
            type="month"
            value={payrollMonth}
            onChange={(e) => setPayrollMonth(e.target.value)}
            className="h-9 w-full sm:w-auto rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{monthLabel(payrollMonth)}</span>
        </div>
      </div>

      <div className="flex w-full sm:w-fit gap-1 p-1 rounded-lg border bg-[hsl(var(--muted))]/20">
        <button
          type="button"
          onClick={() => setSection("staff")}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-md text-xs font-medium cursor-pointer ${
            section === "staff"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          All staff
        </button>
        <button
          type="button"
          onClick={() => setSection("sales")}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-md text-xs font-medium cursor-pointer ${
            section === "sales"
              ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
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
