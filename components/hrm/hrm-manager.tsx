"use client"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Search, Trash2, UserCog, Phone, Mail, MapPin, Briefcase, Upload, FileText, Download, IdCard, Wallet, Banknote, Eye } from "lucide-react"
import { StaffKpiSection } from "@/components/hrm/staff-kpi-section"
import { StaffSalaryAdvanceModal } from "@/components/hrm/staff-salary-advance-modal"
import { MakeSalariesModal } from "@/components/hrm/make-salaries-modal"
import { StaffEmployeeDetail } from "@/components/hrm/staff-employee-detail"
import { StaffEditModal } from "@/components/hrm/staff-edit-modal"
import { fetchSalaryAdvanceSummary, recoverSalaryAdvances } from "@/lib/hrm-salary-advances"
import {
  buildEffectiveSalaryAdjustments,
  calculateProRatedSalary,
  computeNetSalary,
  effectiveStaffEobiAmount,
  effectiveStaffMedicalAmount,
  effectiveStaffTaxAmount,
  monthDateBounds,
  normalizeStaffPayLines,
  payPeriodLabel,
  periodStartForJoinDate,
  resolveBasicSalary,
  type StaffPayLine,
} from "@/lib/hrm-salary-calc"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { downloadStaffExcel } from "@/lib/hrm-excel-export"

const STORAGE_KEY = "erp_hrm_staff"
const DB_NAME = "erp_hrm_db"
const DB_VERSION = 1
const DOCS_STORE = "documents"

interface StaffDocument {
  name: string
  data: string // base64
  type: string
  size: number
}

interface StaffWarning {
  level: 0 | 1 | 2 | 3
  message: string
  date: string
  pointsAtWarning: number
}

interface StaffMember {
  id: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  address: string
  salary: number
  employment_type?: string
  basic_salary?: number
  medical_allowance?: number
  medical_enabled?: boolean
  tax_amount?: number
  tax_enabled?: boolean
  eobi_amount?: number
  eobi_enabled?: boolean
  custom_allowances?: StaffPayLine[]
  custom_deductions?: StaffPayLine[]
  currency: string
  join_date: string
  status: "active" | "inactive"
  notes: string
  photo_url: string // Will be loaded from IndexedDB
  documents: StaffDocument[]
  points: number
  warnings: StaffWarning[]
  last_reset?: string
  created_by: string
  created_at: string
  bank_name?: string
  bank_account_number?: string
  bank_account_title?: string
}

const DEPARTMENTS = ["Management", "Engineering", "Sales", "Finance", "HR", "Operations", "Marketing", "Support", "Other"]
const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED"]
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Probation", "Part-time", "Intern", "Consultant"]

function newPayLine(label = "", amount = ""): StaffPayLine & { amountInput?: string } {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    amount: parseFloat(amount) || 0,
    enabled: true,
  }
}

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE)
      }
    }
  })
}

async function saveDocuments(staffId: string, docs: StaffDocument[]) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.put(docs, staffId)
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.error("Error saving documents:", error)
    throw error
  }
}

async function loadDocuments(staffId: string): Promise<StaffDocument[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readonly")
    const store = tx.objectStore(DOCS_STORE)
    return new Promise((resolve) => {
      const request = store.get(staffId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => resolve([])
    })
  } catch (error) {
    console.error("Error loading documents:", error)
    return []
  }
}

async function savePhoto(staffId: string, photoData: string) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.put(photoData, `${staffId}_photo`)
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.error("Error saving photo:", error)
    throw error
  }
}

async function loadPhoto(staffId: string): Promise<string> {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readonly")
    const store = tx.objectStore(DOCS_STORE)
    return new Promise((resolve) => {
      const request = store.get(`${staffId}_photo`)
      request.onsuccess = () => resolve(request.result || "")
      request.onerror = () => resolve("")
    })
  } catch (error) {
    console.error("Error loading photo:", error)
    return ""
  }
}

async function deleteDocuments(staffId: string) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, "readwrite")
    const store = tx.objectStore(DOCS_STORE)
    store.delete(staffId)
    store.delete(`${staffId}_photo`)
  } catch {
    // ignore
  }
}

export function HrmManager() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMember, setViewMember] = useState<StaffMember | null>(null)
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("All")
  const [filterStatus, setFilterStatus] = useState("All")
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetSuccess, setShowResetSuccess] = useState(false)
  const [showSalarySlip, setShowSalarySlip] = useState(false)
  const [showSalarySlipSuccess, setShowSalarySlipSuccess] = useState(false)
  const [showSalaryHistory, setShowSalaryHistory] = useState(false)
  const [salarySlips, setSalarySlips] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [salaryAdjustments, setSalaryAdjustments] = useState<{ id: string; type: 'add' | 'deduct'; amount: string; label: string }[]>([])
  const [newAdjustment, setNewAdjustment] = useState({ type: 'add' as 'add' | 'deduct', amount: '', label: '' })
  const [payPeriodMode, setPayPeriodMode] = useState<"full_month" | "custom_range">("full_month")
  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")
  const [deductAdvance, setDeductAdvance] = useState(false)
  const [allSalarySlips, setAllSalarySlips] = useState<any[]>([])
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))
  const [showPayrollHistory, setShowPayrollHistory] = useState(false)
  const [exportingStaff, setExportingStaff] = useState(false)
  const [makeSalariesInitialMonth, setMakeSalariesInitialMonth] = useState<string | undefined>()
  const [advanceByStaff, setAdvanceByStaff] = useState<Record<string, number>>({})
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showMakeSalariesModal, setShowMakeSalariesModal] = useState(false)

  async function refreshAdvanceSummary() {
    try {
      const summary = await fetchSalaryAdvanceSummary()
      const map: Record<string, number> = {}
      for (const row of summary) {
        map[row.staffId] = row.outstanding
      }
      setAdvanceByStaff(map)
    } catch {
      setAdvanceByStaff({})
    }
  }

  function periodStartForMember(member: StaffMember, month: string): string {
    return periodStartForJoinDate(month, member.join_date)
  }

  function resolveSalarySlipFigures(member: StaffMember) {
    const outstandingAdvance = advanceByStaff[member.id] || 0
    const payableBase = resolveBasicSalary(member.salary, member.basic_salary)
    const proRate =
      payPeriodMode === "custom_range" && periodFrom && periodTo
        ? calculateProRatedSalary(payableBase, periodFrom, periodTo)
        : null
    const effectiveBase = proRate?.amount ?? payableBase
    const effectiveAdjustments = buildEffectiveSalaryAdjustments(salaryAdjustments, {
      deductAdvance,
      outstandingAdvance,
      taxAmount: Number(member.tax_amount) || 0,
      taxEnabled: Boolean(member.tax_enabled),
      eobiAmount: Number(member.eobi_amount) || 0,
      eobiEnabled: Boolean(member.eobi_enabled),
      medicalAllowance: Number(member.medical_allowance) || 0,
      medicalEnabled: Boolean(member.medical_enabled),
      customAllowances: member.custom_allowances,
      customDeductions: member.custom_deductions,
    })
    const netSalary = computeNetSalary(effectiveBase, effectiveAdjustments)
    const payPeriodText = payPeriodLabel(selectedMonth, payPeriodMode, periodFrom, periodTo)
    return { outstandingAdvance, proRate, effectiveBase, effectiveAdjustments, netSalary, payPeriodText }
  }

  function mergeStaffLocal(memberId: string, saved: Partial<StaffMember>) {
    setStaff(prev =>
      prev.map(s =>
        s.id === memberId
          ? { ...s, ...saved, documents: s.documents, photo_url: s.photo_url }
          : s,
      ),
    )
    setViewMember(prev =>
      prev && prev.id === memberId
        ? { ...prev, ...saved, documents: prev.documents, photo_url: prev.photo_url }
        : prev,
    )
  }

  function openSalarySlipModal() {
    if (!viewMember) return
    const month = new Date().toISOString().slice(0, 7)
    const bounds = monthDateBounds(month)
    setSelectedMonth(month)
    setPayPeriodMode("full_month")
    setPeriodFrom(periodStartForMember(viewMember, month))
    setPeriodTo(bounds.to)
    setSalaryAdjustments([])
    setNewAdjustment({ type: "add", amount: "", label: "" })
    setDeductAdvance((advanceByStaff[viewMember.id] || 0) > 0)
    setShowSalarySlip(true)
  }

  function resetSalarySlipModal() {
    setShowSalarySlip(false)
    setSalaryAdjustments([])
    setNewAdjustment({ type: "add", amount: "", label: "" })
    setPayPeriodMode("full_month")
    setPeriodFrom("")
    setPeriodTo("")
    setDeductAdvance(false)
  }

  function handleSalaryMonthChange(month: string) {
    setSelectedMonth(month)
    if (viewMember) {
      setPeriodFrom(periodStartForMember(viewMember, month))
      setPeriodTo(monthDateBounds(month).to)
    }
  }

  // Fetch salary slips for staff member
  async function fetchSalarySlips(staffName: string) {
    try {
      const response = await fetch(`/api/hrm/salary-slips?staffName=${encodeURIComponent(staffName)}`)
      if (response.ok) {
        const slips = await response.json()
        setSalarySlips(slips)
      } else {
        throw new Error('Database fetch failed')
      }
    } catch (error) {
      console.warn('Database fetch failed, using localStorage fallback:', error)
      // Fallback to localStorage
      const allSlips = JSON.parse(localStorage.getItem('salary_slips') || '[]')
      const staffSlips = allSlips.filter((slip: any) => slip.staffName === staffName)
      setSalarySlips(staffSlips)
    }
  }

  async function fetchAllSalarySlips() {
    try {
      const response = await fetch('/api/hrm/salary-slips')
      if (response.ok) {
        const slips = await response.json()
        setAllSalarySlips(slips)
      }
    } catch {}
  }

  function monthLabel(month: string) {
    return new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Generate PDF for existing salary slip
  async function generateSalarySlipPDF(slip: any, staffName: string) {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      
      // Set up colors
      const primaryColor = [31, 172, 166] // #1faca6
      const darkColor = [20, 143, 139] // Darker teal
      const textColor = [40, 40, 40]
      const lightGray = [248, 250, 252]
      const borderColor = [226, 232, 240]
      
      // Add elegant header background with gradient effect
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(0, 0, 210, 55, 'F')
      
      // Add logo (if available)
      try {
        const logoImg = new Image()
        logoImg.src = '/logo.png'
        await new Promise((resolve) => {
          logoImg.onload = resolve
          logoImg.onerror = resolve
        })
        if (logoImg.complete && logoImg.naturalHeight !== 0) {
          doc.addImage(logoImg, 'PNG', 15, 10, 35, 35)
        }
      } catch (e) {
        console.log('Logo not loaded')
      }
      
      // Company Information (Left side)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('VOLTRIX BATTERIES', 55, 18)
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Head Office', 55, 24)
      doc.text('Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', 55, 29)
      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779', 55, 34)
      doc.text('Email: sale@voltrixbatteries.com', 55, 39)
      
      // SALARY SLIP title (Right side)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('SALARY SLIP', 205, 30, { align: 'right' })
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date(slip.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), 205, 38, { align: 'right' })
      
      // Reset text color
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      
      // Decorative line under header
      doc.setLineWidth(0.5)
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.line(15, 60, 195, 60)
      
      // Employee Information Section
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
      doc.roundedRect(15, 68, 180, 60, 2, 2, 'F')
      
      // Section header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(15, 68, 180, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('EMPLOYEE INFORMATION', 20, 73)
      
      // Employee details
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      
      // Left column
      doc.text('Employee Name:', 20, 83)
      doc.text('Role:', 20, 91)
      doc.text('Department:', 20, 99)
      doc.text('Employee Status:', 20, 107)
      
      // Left column values
      doc.setFont('helvetica', 'normal')
      doc.text(slip.staffName, 60, 83)
      doc.text(slip.staffRole, 60, 91)
      doc.text(slip.staffDepartment, 60, 99)
      doc.text('Active', 60, 107)
      
      // Right column
      doc.setFont('helvetica', 'bold')
      doc.text('Pay Period:', 120, 83)
      doc.text('Generated On:', 120, 91)
      doc.text('Currency:', 120, 99)
      
      // Right column values
      doc.setFont('helvetica', 'normal')
      doc.text(new Date(slip.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), 155, 83)
      doc.text(new Date(slip.generatedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }), 155, 91)
      doc.text(slip.currency, 155, 99)
      
      // Bank Details (if available)
      if (slip.bankName || slip.bankAccountNumber) {
        doc.setFont('helvetica', 'bold')
        doc.text('Bank Name:', 20, 115)
        doc.text('Account Number:', 20, 123)
        doc.setFont('helvetica', 'normal')
        doc.text(slip.bankName || '—', 60, 115)
        doc.text(slip.bankAccountNumber || '—', 60, 123)
        if (slip.bankAccountTitle) {
          doc.setFont('helvetica', 'bold')
          doc.text('Account Title:', 120, 115)
          doc.setFont('helvetica', 'normal')
          doc.text(slip.bankAccountTitle, 155, 115)
        }
      }
      
      // Salary Breakdown Section
      let currentY = (slip.bankName || slip.bankAccountNumber) ? 140 : 125
      
      // Base Salary
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
      doc.roundedRect(15, currentY, 180, 12, 2, 2, 'F')
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.text('BASE SALARY', 20, currentY + 8)
      doc.setFontSize(12)
      doc.text(`${slip.currency} ${slip.baseSalary.toLocaleString()}`, 190, currentY + 8, { align: 'right' })
      
      currentY += 20
      
      // Adjustments Section
      if (slip.adjustments && slip.adjustments.length > 0) {
        // Adjustments header
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(15, currentY, 180, 8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('SALARY ADJUSTMENTS', 20, currentY + 5)
        
        currentY += 12
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        
        slip.adjustments.forEach((adj: any, index: number) => {
          const amount = parseFloat(adj.amount)
          const isAddition = adj.type === 'add'
          
          // Alternating row background
          if (index % 2 === 0) {
            doc.setFillColor(252, 252, 252)
            doc.rect(15, currentY - 4, 180, 9, 'F')
          }
          
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.text(adj.label, 20, currentY)
          
          // Amount with color coding
          doc.setFont('helvetica', 'bold')
          if (isAddition) {
            doc.setTextColor(34, 197, 94) // Green
            doc.text(`+ ${slip.currency} ${amount.toLocaleString()}`, 190, currentY, { align: 'right' })
          } else {
            doc.setTextColor(239, 68, 68) // Red
            doc.text(`- ${slip.currency} ${amount.toLocaleString()}`, 190, currentY, { align: 'right' })
          }
          doc.setTextColor(textColor[0], textColor[1], textColor[2])
          
          currentY += 9
        })
        
        currentY += 5
      }
      
      // Divider line
      doc.setLineWidth(0.5)
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.line(15, currentY, 195, currentY)
      currentY += 10
      
      // Net Salary Section - Highlighted Box
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('NET SALARY (TOTAL PAYABLE)', 20, currentY + 13)
      doc.setFontSize(16)
      doc.text(`${slip.currency} ${slip.netSalary.toLocaleString()}`, 190, currentY + 13, { align: 'right' })
      
      // Reset text color
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      
      // Important Note Section
      currentY += 35
      doc.setFillColor(255, 251, 235) // Light yellow
      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F')
      doc.setDrawColor(251, 191, 36) // Yellow border
      doc.setLineWidth(0.5)
      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'S')
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(146, 64, 14) // Brown text
      doc.text('IMPORTANT NOTE:', 20, currentY + 7)
      doc.setFont('helvetica', 'normal')
      doc.text('This salary slip is computer-generated and does not require a signature.', 20, currentY + 12)
      doc.text('Please verify all details and contact HR for any discrepancies.', 20, currentY + 16)
      
      // Footer section with company info
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.setLineWidth(0.3)
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.line(15, 270, 195, 270)
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      doc.text('Voltrix Batteries - Human Resources Management System', 105, 276, { align: 'center' })
      doc.text('Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', 105, 281, { align: 'center' })
      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779 | Email: sale@voltrixbatteries.com', 105, 286, { align: 'center' })
      
      // Save and download
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Salary-Slip-${staffName.replace(/\s+/g, '-')}-${slip.month}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating salary slip. Please try again.')
    }
  }

  // form
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("Management")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [salary, setSalary] = useState("")
  const [taxAmount, setTaxAmount] = useState("")
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [eobiAmount, setEobiAmount] = useState("")
  const [eobiEnabled, setEobiEnabled] = useState(false)
  const [employmentType, setEmploymentType] = useState("Permanent")
  const [basicSalary, setBasicSalary] = useState("")
  const [medicalAllowance, setMedicalAllowance] = useState("")
  const [medicalEnabled, setMedicalEnabled] = useState(false)
  const [customAllowances, setCustomAllowances] = useState<StaffPayLine[]>([])
  const [customDeductions, setCustomDeductions] = useState<StaffPayLine[]>([])
  const [currency, setCurrency] = useState("USD")
  const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null)
  const [togglingPayKey, setTogglingPayKey] = useState<string | null>(null)
  const [joinDate, setJoinDate] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  const [notes, setNotes] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankAccountTitle, setBankAccountTitle] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  // documents
  const [documents, setDocuments] = useState<{ file: File; name: string }[]>([])
  const [newDocName, setNewDocName] = useState("")
  const pendingDocFileRef = useRef<File | null>(null)

  function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const file = files[0]
    const name = newDocName.trim() || file.name.replace(/\.[^.]+$/, "")
    setDocuments(prev => [...prev, { file, name }])
    setNewDocName("")
    pendingDocFileRef.current = null
    e.target.value = ""
  }

  function updateDocName(index: number, name: string) {
    setDocuments(prev => prev.map((d, i) => i === index ? { ...d, name } : d))
  }

  function removeDoc(index: number) {
    setDocuments(prev => prev.filter((_, i) => i !== index))
  }

  function handlePendingUpload() {
    if (!newDocName.trim()) {
      alert("Please enter a document name first")
      return
    }
    docFileRef.current?.click()
  }

  function openEditForm(member: StaffMember) {
    setEditingMember(member)
    setName(member.name)
    setRole(member.role)
    setDepartment(member.department)
    setEmail(member.email)
    setPhone(member.phone)
    setAddress(member.address)
    setSalary(member.salary.toString())
    setEmploymentType(member.employment_type || "Permanent")
    setBasicSalary(member.basic_salary ? String(member.basic_salary) : "")
    setMedicalAllowance(member.medical_allowance ? String(member.medical_allowance) : "")
    setMedicalEnabled(Boolean(member.medical_enabled))
    setTaxAmount(member.tax_amount ? String(member.tax_amount) : "")
    setTaxEnabled(Boolean(member.tax_enabled))
    setEobiAmount(member.eobi_amount ? String(member.eobi_amount) : "")
    setEobiEnabled(Boolean(member.eobi_enabled))
    setCustomAllowances(normalizeStaffPayLines(member.custom_allowances))
    setCustomDeductions(normalizeStaffPayLines(member.custom_deductions))
    setCurrency(member.currency)
    setJoinDate(member.join_date)
    setStatus(member.status)
    setNotes(member.notes)
    setBankName(member.bank_name || "")
    setBankAccountNumber(member.bank_account_number || "")
    setBankAccountTitle(member.bank_account_title || "")
    setPhotoPreview(member.photo_url)
    setDocuments([]) // Existing docs will be shown separately
    setShowForm(true)
    setViewMember(null)
  }

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/hrm/staff')
        const staffData = await res.json()
        // Load documents and photos from IndexedDB for each staff member
        const staffWithDocs = await Promise.all(
          staffData.map(async (s: any) => ({
            ...s,
            documents: await loadDocuments(s.id),
            photo_url: await loadPhoto(s.id)
          }))
        )
        setStaff(staffWithDocs)
        await fetchAllSalarySlips()
        await refreshAdvanceSummary()
      } catch (error) {
        console.error('Failed to load staff:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (viewMember) fetchSalarySlips(viewMember.name)
  }, [viewMember?.id])

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !search || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    const matchDept = filterDept === "All" || s.department === filterDept
    const matchStatus = filterStatus === "All" || s.status === filterStatus
    return matchSearch && matchDept && matchStatus
  })

  const activeStaff = staff.filter(s => s.status === "active")
  const uniqueAllSalarySlips = Object.values(
    allSalarySlips.reduce<Record<string, any>>((acc, slip: any) => {
      const key = `${String(slip.staffName || "").trim().toLowerCase()}__${String(slip.month || "")}`
      const prev = acc[key]
      const prevDate = new Date(prev?.generatedDate || prev?.createdAt || 0).getTime()
      const currDate = new Date(slip?.generatedDate || slip?.createdAt || 0).getTime()
      if (!prev || currDate >= prevDate) acc[key] = slip
      return acc
    }, {})
  )
  const finalizedSalarySlips = uniqueAllSalarySlips.filter(
    (slip: any) => String(slip.status || "finalized") === "finalized",
  )
  const monthPaidSlips = finalizedSalarySlips.filter((slip: any) => slip.month === payrollMonth)
  const monthPaidTotal = monthPaidSlips.reduce((sum: number, slip: any) => sum + (Number(slip.netSalary) || 0), 0)
  const monthPaidStaffNames = new Set(monthPaidSlips.map((slip: any) => String(slip.staffName || "")))
  const monthPaidCount = monthPaidStaffNames.size
  const monthUnpaidCount = Math.max(0, activeStaff.filter(s => !monthPaidStaffNames.has(s.name)).length)
  const payrollHistoryByMonth = uniqueAllSalarySlips.reduce<Record<string, any[]>>((acc, slip: any) => {
    const key = String(slip.month || "")
    if (!acc[key]) acc[key] = []
    acc[key].push(slip)
    return acc
  }, {})
  const sortedPayrollMonths = Object.keys(payrollHistoryByMonth).sort((a, b) => b.localeCompare(a))
  const uniqueStaffSalarySlips = Object.values(
    salarySlips.reduce<Record<string, any>>((acc, slip: any) => {
      const key = String(slip.month || "")
      const prev = acc[key]
      const prevDate = new Date(prev?.generatedDate || prev?.createdAt || 0).getTime()
      const currDate = new Date(slip?.generatedDate || slip?.createdAt || 0).getTime()
      if (!prev || currDate >= prevDate) acc[key] = slip
      return acc
    }, {})
  ).sort((a: any, b: any) => String(b.month || "").localeCompare(String(a.month || "")))

  function openMakeSalaries(month?: string) {
    setMakeSalariesInitialMonth(month || payrollMonth)
    setShowMakeSalariesModal(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !role) return
    setSaving(true)

    try {
      let photo_url = photoPreview
      if (photoFile) {
        photo_url = await new Promise<string>(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(photoFile)
        })
      }

      const memberId = editingMember?.id || `staff_${Date.now()}`
      
      // encode new documents
      const encodedDocs: StaffDocument[] = await Promise.all(
        documents.map(({ file, name: docName }) =>
          new Promise<StaffDocument>(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve({
              name: docName || file.name,
              data: reader.result as string,
              type: file.type,
              size: file.size,
            })
            reader.readAsDataURL(file)
          })
        )
      )

      // Merge existing and new documents
      const allDocs = [...(editingMember?.documents || []), ...encodedDocs]
      
      // Try to save to IndexedDB, fallback to in-memory only
      try {
        if (photo_url) {
          await savePhoto(memberId, photo_url)
        }
        if (allDocs.length > 0) {
          await saveDocuments(memberId, allDocs)
        }
      } catch (dbError) {
        console.warn("IndexedDB not available, using memory storage only:", dbError)
      }

      // Save staff metadata to database
      const staffData = {
        id: memberId,
        name, role, department, email, phone, address,
        salary: parseFloat(salary) || 0,
        employment_type: employmentType,
        basic_salary: parseFloat(basicSalary) || 0,
        medical_allowance: parseFloat(medicalAllowance) || 0,
        medical_enabled: medicalEnabled,
        tax_amount: parseFloat(taxAmount) || 0,
        tax_enabled: taxEnabled,
        eobi_amount: parseFloat(eobiAmount) || 0,
        eobi_enabled: eobiEnabled,
        custom_allowances: customAllowances.map(l => ({
          id: l.id,
          label: l.label.trim() || "Allowance",
          amount: Math.max(0, Number(l.amount) || 0),
          enabled: l.enabled !== false,
        })),
        custom_deductions: customDeductions.map(l => ({
          id: l.id,
          label: l.label.trim() || "Deduction",
          amount: Math.max(0, Number(l.amount) || 0),
          enabled: l.enabled !== false,
        })),
        currency, joinDate, status, notes,
        bank_name: bankName,
        bank_account_number: bankAccountNumber,
        bank_account_title: bankAccountTitle,
        createdBy: editingMember?.created_by || user?.name || "Unknown",
        createdAt: editingMember?.created_at || new Date().toISOString(),
      }
      const res = await fetch('/api/hrm/staff', {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
      })
      const savedMember = await res.json()

      // Update state with full data including documents and photo
      const updated = editingMember
        ? staff.map(s => s.id === memberId ? { ...savedMember, documents: allDocs, photo_url: photoPreview || "" } : s)
        : [{ ...savedMember, documents: allDocs, photo_url: photoPreview || "" }, ...staff]

      setStaff(updated)
      resetForm()
    } catch (error) {
      console.error("Error saving staff:", error)
      alert("Failed to save staff member. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName(""); setRole(""); setDepartment("Management"); setEmail("")
    setPhone(""); setAddress(""); setSalary(""); setTaxAmount(""); setTaxEnabled(false)
    setEobiAmount(""); setEobiEnabled(false)
    setEmploymentType("Permanent"); setBasicSalary(""); setMedicalAllowance(""); setMedicalEnabled(false)
    setCustomAllowances([]); setCustomDeductions([]); setCurrency("USD")
    setJoinDate(""); setStatus("active"); setNotes("")
    setBankName(""); setBankAccountNumber(""); setBankAccountTitle("")
    setPhotoFile(null); setPhotoPreview(""); setShowForm(false)
    setDocuments([])
    setNewDocName("")
    setEditingMember(null)
  }

  async function patchStaffPay(member: StaffMember, key: string, body: Record<string, unknown>) {
    setTogglingPayKey(key)
    try {
      const res = await fetch("/api/hrm/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, ...body }),
      })
      if (!res.ok) throw new Error("Failed to update pay setting")
      const saved = await res.json()
      mergeStaffLocal(member.id, {
        ...saved,
        employment_type: saved.employment_type || member.employment_type || "Permanent",
        basic_salary: Number(saved.basic_salary) || 0,
        medical_allowance: Number(saved.medical_allowance) || 0,
        medical_enabled: Boolean(saved.medical_enabled),
        tax_amount: Number(saved.tax_amount) || 0,
        tax_enabled: Boolean(saved.tax_enabled),
        eobi_amount: Number(saved.eobi_amount) || 0,
        eobi_enabled: Boolean(saved.eobi_enabled),
        custom_allowances: normalizeStaffPayLines(saved.custom_allowances),
        custom_deductions: normalizeStaffPayLines(saved.custom_deductions),
      })
    } catch (error) {
      console.error("Error updating pay setting:", error)
      alert("Failed to update pay setting. Please try again.")
    } finally {
      setTogglingPayKey(null)
    }
  }

  async function handleToggleStaffTax(member: StaffMember, nextEnabled: boolean) {
    await patchStaffPay(member, "tax", {
      tax_enabled: nextEnabled,
      tax_amount: Number(member.tax_amount) || 0,
    })
  }

  async function handleToggleStaffEobi(member: StaffMember, nextEnabled: boolean) {
    await patchStaffPay(member, "eobi", {
      eobi_enabled: nextEnabled,
      eobi_amount: Number(member.eobi_amount) || 0,
    })
  }

  async function handleToggleStaffMedical(member: StaffMember, nextEnabled: boolean) {
    await patchStaffPay(member, "medical", {
      medical_enabled: nextEnabled,
      medical_allowance: Number(member.medical_allowance) || 0,
    })
  }

  async function handleToggleCustomAllowance(member: StaffMember, lineId: string, enabled: boolean) {
    const next = normalizeStaffPayLines(member.custom_allowances).map(line =>
      line.id === lineId ? { ...line, enabled } : line,
    )
    await patchStaffPay(member, `allowance:${lineId}`, { custom_allowances: next })
  }

  async function handleToggleCustomDeduction(member: StaffMember, lineId: string, enabled: boolean) {
    const next = normalizeStaffPayLines(member.custom_deductions).map(line =>
      line.id === lineId ? { ...line, enabled } : line,
    )
    await patchStaffPay(member, `deduction:${lineId}`, { custom_deductions: next })
  }

  async function handleDeleteSalarySlip(slip: { id: string; month?: string; staffName?: string }) {
    if (!slip?.id) return
    const monthText = slip.month
      ? new Date(slip.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "this month"
    if (!confirm(`Delete salary history for ${slip.staffName || "this staff"} — ${monthText}? This cannot be undone.`)) {
      return
    }
    setDeletingSlipId(slip.id)
    try {
      const res = await fetch(`/api/hrm/salary-slips?id=${encodeURIComponent(slip.id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Failed to delete")
      }
      setSalarySlips(prev => prev.filter((s: any) => s.id !== slip.id))
      setAllSalarySlips(prev => prev.filter((s: any) => s.id !== slip.id))
      try {
        const local = JSON.parse(localStorage.getItem("salary_slips") || "[]") as any[]
        localStorage.setItem(
          "salary_slips",
          JSON.stringify(local.filter(s => s.id !== slip.id)),
        )
      } catch {
        // ignore localStorage errors
      }
      await refreshAdvanceSummary()
    } catch (error) {
      console.error("Error deleting salary slip:", error)
      alert(error instanceof Error ? error.message : "Failed to delete salary history")
    } finally {
      setDeletingSlipId(null)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/hrm/staff?id=${id}`, { method: 'DELETE' })
      const updated = staff.filter(s => s.id !== id)
      setStaff(updated)
      deleteDocuments(id) // Clean up IndexedDB (docs + photo)
      if (viewMember?.id === id) setViewMember(null)
    } catch (error) {
      console.error('Failed to delete staff:', error)
    }
  }

  const activeCount = staff.filter(s => s.status === "active").length

  function exportStaffExcel() {
    if (!staff.length) return
    setExportingStaff(true)
    try {
      downloadStaffExcel(staff, user?.name)
    } finally {
      setExportingStaff(false)
    }
  }

  // Points management
  function getWarningMessage(level: 0 | 1 | 2 | 3, points: number): string {
    const messages = {
      0: '',
      1: `First Warning: Your performance points have decreased to ${points}. Please improve your work performance to avoid further disciplinary action.`,
      2: `Second Warning: Your points are now at ${points}. This is a serious concern. Immediate improvement is required.`,
      3: `Final Warning: Your points have reached a critical level (${points}). HR will contact you for a formal review.`
    }
    return messages[level]
  }

  function checkWarningLevel(points: number): 0 | 1 | 2 | 3 {
    if (points <= 20) return 3
    if (points <= 50) return 2
    if (points <= 70) return 1
    return 0
  }

  async function updatePoints(memberId: string, delta: number) {
    const member = staff.find(s => s.id === memberId)
    if (!member) return

    const newPoints = Math.max(0, Math.min(100, (member.points || 100) + delta))
    const oldWarningLevel = checkWarningLevel(member.points || 100)
    const newWarningLevel = checkWarningLevel(newPoints)

    // Generate warning if level changed (only for levels 1-3)
    let newWarnings = [...(member.warnings || [])]
    if (newWarningLevel > oldWarningLevel && newWarningLevel > 0) {
      const warning: StaffWarning = {
        level: newWarningLevel,
        message: getWarningMessage(newWarningLevel, newPoints),
        date: new Date().toISOString(),
        pointsAtWarning: newPoints
      }
      newWarnings.push(warning)
    }

    const updatedMember = { ...member, points: newPoints, warnings: newWarnings }

    try {
      const res = await fetch('/api/hrm/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: memberId,
          points: newPoints,
          warnings: newWarnings
        })
      })
      if (res.ok) {
        setStaff(prev => prev.map(s => s.id === memberId ? updatedMember : s))
        if (viewMember?.id === memberId) {
          setViewMember(updatedMember)
        }
      }
    } catch (error) {
      console.error('Failed to update points:', error)
    }
  }

  function shouldResetPoints(lastReset?: string): boolean {
    if (!lastReset) return true
    const last = new Date(lastReset)
    const now = new Date()
    // Check if we're in a new month
    return last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()
  }

  async function resetMonthlyPoints() {
    const updates = staff.filter(s => shouldResetPoints(s.last_reset))
    if (updates.length === 0) return

    const now = new Date().toISOString()
    const updatedStaff = [...staff]

    for (const member of updates) {
      try {
        const res = await fetch('/api/hrm/staff', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: member.id,
            points: 100,
            warnings: [], // Clear warnings on reset
            lastReset: now
          })
        })
        if (res.ok) {
          // Update local state instead of reloading
          const idx = updatedStaff.findIndex(s => s.id === member.id)
          if (idx !== -1) {
            updatedStaff[idx] = { ...updatedStaff[idx], points: 100, warnings: [], last_reset: now }
          }
        }
      } catch (error) {
        console.error(`Failed to reset points for ${member.name}:`, error)
      }
    }
    setStaff(updatedStaff)
  }

  // Check for monthly reset on load (disabled for now)
  // useEffect(() => {
  //   if (staff.length === 0) return
  //   const hasExpired = staff.some(s => shouldResetPoints(s.last_reset))
  //   if (hasExpired) {
  //     resetMonthlyPoints()
  //   }
  // }, [staff])

  function PointsBar({ points }: { points: number }) {
    const color =
      points <= 20 ? "bg-red-500" :
      points <= 50 ? "bg-orange-500" :
      points <= 70 ? "bg-yellow-500" :
      "bg-emerald-500"

    return (
      <div className="w-full max-w-[120px]">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={`text-[10px] tabular-nums ${points <= 20 ? "text-red-600 font-semibold" : "text-[hsl(var(--muted-foreground))]"}`}>
            {points}/100
          </span>
          {points <= 20 && <span className="text-[9px] text-red-600 font-semibold">Low</span>}
        </div>
        <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, points))}%` }} />
        </div>
      </div>
    )
  }

  function downloadIdCard(member: StaffMember) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Vertical ID card dimensions (standard vertical: 54mm x 85.6mm ~ 638x1012 pixels at 300dpi)
    canvas.width = 638
    canvas.height = 1012

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(0.5, '#16213e')
    gradient.addColorStop(1, '#0f3460')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Decorative pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.fillRect(i, 0, 2, canvas.height)
    }

    // Company logo
    const logoImg = new Image()
    logoImg.crossOrigin = 'anonymous'
    
    const drawCard = () => {
      // Draw logo if loaded, otherwise use text
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const logoSize = 100
        const logoX = (canvas.width - logoSize) / 2
        ctx.drawImage(logoImg, logoX, 30, logoSize, logoSize)
      } else {
        // Fallback logo
        ctx.fillStyle = '#e94560'
        ctx.beginPath()
        ctx.arc(canvas.width / 2, 80, 50, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 48px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('V', canvas.width / 2, 85)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      // Company name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('VOLTRIX', canvas.width / 2, 150)
      ctx.textAlign = 'left'

      // Circular staff photo (avatar)
      const photoCenterX = canvas.width / 2
      const photoCenterY = 320
      const photoRadius = 100
      
      // Photo background circle
      ctx.fillStyle = '#2a2a4a'
      ctx.beginPath()
      ctx.arc(photoCenterX, photoCenterY, photoRadius + 10, 0, Math.PI * 2)
      ctx.fill()

      const drawStaffPhoto = () => {
        if (member.photo_url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.save()
            ctx.beginPath()
            ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(img, photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2)
            ctx.restore()
            finishCard()
          }
          img.onerror = () => {
            drawPlaceholderAvatar()
            finishCard()
          }
          img.src = member.photo_url
        } else {
          drawPlaceholderAvatar()
          finishCard()
        }
      }

      const drawPlaceholderAvatar = () => {
        ctx.fillStyle = '#3a3a5a'
        ctx.beginPath()
        ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e94560'
        ctx.font = 'bold 50px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(), photoCenterX, photoCenterY)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      const finishCard = () => {
        // Employee name (first letter capital)
        const capitalizedName = member.name.charAt(0).toUpperCase() + member.name.slice(1).toLowerCase()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 32px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(capitalizedName, canvas.width / 2, photoCenterY + photoRadius + 60)

        // Role (first letter capital)
        const capitalizedRole = member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase()
        ctx.fillStyle = '#e94560'
        ctx.font = '20px Arial'
        ctx.fillText(capitalizedRole, canvas.width / 2, photoCenterY + photoRadius + 95)

        // Department (simple text)
        ctx.fillStyle = '#a0a0a0'
        ctx.font = '16px Arial'
        ctx.fillText(member.department, canvas.width / 2, photoCenterY + photoRadius + 125)

        // Employee ID (small, one line)
        const infoY = photoCenterY + photoRadius + 160
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('ID: #' + String(member.id).padStart(6, '0'), canvas.width / 2, infoY)
        ctx.textAlign = 'left'

        // Download
        const link = document.createElement('a')
        link.download = `${member.name.replace(/\s+/g, '_')}_ID_Card.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }

      drawStaffPhoto()
    }

    logoImg.onload = drawCard
    logoImg.onerror = drawCard
    logoImg.src = '/logo.png'
  }

  const slipFigures = showSalarySlip && viewMember ? resolveSalarySlipFigures(viewMember) : null

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">Staff</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {staff.length > 0
              ? `${activeCount} active · ${staff.length - activeCount} inactive · ${filtered.length} shown`
              : "Manage staff profiles and payroll"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {staff.length > 0 && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 cursor-pointer"
                onClick={() => openMakeSalaries(payrollMonth)}
              >
                <Banknote className="h-3.5 w-3.5" />
                Make Salaries
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 cursor-pointer" onClick={() => setShowPayrollHistory(true)}>
                <FileText className="h-3.5 w-3.5" /> History
              </Button>
              <CrmExcelExportButton
                onExport={exportStaffExcel}
                exporting={exportingStaff}
                label="Export"
                className="h-8 text-xs gap-1.5"
              />
            </>
          )}
          <Button size="sm" className="h-8 px-3 text-xs gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white cursor-pointer" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New Staff
          </Button>
        </div>
      </div>

      {/* Compact stats + payroll */}
      {staff.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total</p>
            <p className="text-lg font-semibold text-[hsl(var(--foreground))] leading-tight mt-0.5">{staff.length}</p>
          </div>
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Active</p>
            <p className="text-lg font-semibold text-emerald-600 leading-tight mt-0.5">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Inactive</p>
            <p className="text-lg font-semibold text-rose-600 leading-tight mt-0.5">{staff.length - activeCount}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Payroll · {monthLabel(payrollMonth)}</p>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate mt-0.5">
                {monthPaidSlips[0]?.currency || "PKR"} {monthPaidTotal.toLocaleString()}
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                Paid {monthPaidCount} · Unpaid {monthUnpaidCount}
              </p>
            </div>
            <input
              type="month"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] shrink-0"
            />
          </div>
        </div>
      )}

      {/* Always-visible filters */}
      {staff.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, role, email..."
              className="w-full h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-8 pr-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a]"
            />
          </div>
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a]"
          >
            <option value="All">All departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a]"
          >
            <option value="All">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterDept !== "All" || filterStatus !== "All") && (
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterDept("All"); setFilterStatus("All") }}
              className="h-8 px-2.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded-md hover:bg-[hsl(var(--muted))]/20 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Staff table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))]">
          <div className="h-11 w-11 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-3">
            <UserCog className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No staff yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-4">Add your first staff member to get started</p>
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New Staff
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
          No staff match your filters.
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/25">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider sticky left-0 bg-[hsl(var(--muted))]/25">Staff</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Department</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider w-36">Points</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Contact</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Salary</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setViewMember(s)}
                    className={`hover:bg-[hsl(var(--muted))]/15 cursor-pointer transition-colors ${(s.points || 100) <= 20 ? "bg-red-50/70 dark:bg-red-950/15" : ""}`}
                  >
                    <td className="px-3 py-2.5 sticky left-0 bg-[hsl(var(--card))]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden bg-[#1a9f9a]/10 flex items-center justify-center text-[#1a9f9a]">
                          {s.photo_url
                            ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                            : <span className="text-[10px] font-semibold">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{s.name}</p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{s.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[hsl(var(--foreground))] whitespace-nowrap">{s.department}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                          : "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <PointsBar points={s.points || 100} />
                    </td>
                    <td className="px-3 py-2.5 min-w-[140px]">
                      <p className="text-xs text-[hsl(var(--foreground))] truncate max-w-[180px]">{s.email || "—"}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{s.phone || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {s.salary > 0 ? (
                        <>
                          <p className="text-xs font-medium text-[hsl(var(--foreground))] tabular-nums">
                            {s.currency} {s.salary.toLocaleString()}
                          </p>
                          {(advanceByStaff[s.id] || 0) > 0 && (
                            <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                              Adv. {(advanceByStaff[s.id] || 0).toLocaleString()}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">—</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="View"
                          className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                          onClick={e => { e.stopPropagation(); setViewMember(s) }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete"
                          className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <StaffEditModal
          editing={Boolean(editingMember)}
          saving={saving}
          departments={DEPARTMENTS}
          employmentTypes={EMPLOYMENT_TYPES}
          currencies={CURRENCIES}
          name={name}
          setName={setName}
          role={role}
          setRole={setRole}
          department={department}
          setDepartment={setDepartment}
          email={email}
          setEmail={setEmail}
          phone={phone}
          setPhone={setPhone}
          address={address}
          setAddress={setAddress}
          salary={salary}
          setSalary={setSalary}
          basicSalary={basicSalary}
          setBasicSalary={setBasicSalary}
          employmentType={employmentType}
          setEmploymentType={setEmploymentType}
          medicalAllowance={medicalAllowance}
          setMedicalAllowance={setMedicalAllowance}
          medicalEnabled={medicalEnabled}
          setMedicalEnabled={setMedicalEnabled}
          taxAmount={taxAmount}
          setTaxAmount={setTaxAmount}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
          eobiAmount={eobiAmount}
          setEobiAmount={setEobiAmount}
          eobiEnabled={eobiEnabled}
          setEobiEnabled={setEobiEnabled}
          customAllowances={customAllowances}
          setCustomAllowances={setCustomAllowances}
          customDeductions={customDeductions}
          setCustomDeductions={setCustomDeductions}
          currency={currency}
          setCurrency={setCurrency}
          joinDate={joinDate}
          setJoinDate={setJoinDate}
          status={status}
          setStatus={setStatus}
          notes={notes}
          setNotes={setNotes}
          bankName={bankName}
          setBankName={setBankName}
          bankAccountNumber={bankAccountNumber}
          setBankAccountNumber={setBankAccountNumber}
          bankAccountTitle={bankAccountTitle}
          setBankAccountTitle={setBankAccountTitle}
          photoPreview={photoPreview}
          fileRef={fileRef}
          onFileChange={handleFileChange}
          documents={documents}
          newDocName={newDocName}
          setNewDocName={setNewDocName}
          docFileRef={docFileRef}
          onDocFileChange={handleDocFileChange}
          onPendingUpload={handlePendingUpload}
          updateDocName={updateDocName}
          removeDoc={removeDoc}
          existingDocuments={editingMember?.documents || []}
          onRemoveExistingDoc={(i) => {
            if (!editingMember) return
            const updated = editingMember.documents.filter((_, idx) => idx !== i)
            setEditingMember({ ...editingMember, documents: updated })
          }}
          onAddAllowance={() => setCustomAllowances(prev => [...prev, newPayLine("Allowance")])}
          onAddDeduction={() => setCustomDeductions(prev => [...prev, newPayLine("Deduction")])}
          onSubmit={handleSubmit}
          onClose={resetForm}
        />
      )}

      {viewMember && (
        <StaffEmployeeDetail
          member={viewMember}
          isAdmin={isErpAdmin(user?.role)}
          actorName={user?.name ?? "Admin"}
          outstandingAdvance={advanceByStaff[viewMember.id] || 0}
          salarySlips={salarySlips}
          togglingKey={togglingPayKey}
          onClose={() => setViewMember(null)}
          onEdit={() => openEditForm(viewMember)}
          onDownloadIdCard={() => downloadIdCard(viewMember)}
          onOpenAdvance={() => setShowAdvanceModal(true)}
          onGenerateSlip={openSalarySlipModal}
          onOpenHistory={() => {
            fetchSalarySlips(viewMember.name)
            setShowSalaryHistory(true)
          }}
          onOpenPhoto={() => viewMember.photo_url && setLightboxPhoto(viewMember.photo_url)}
          onToggleMedical={(enabled) => handleToggleStaffMedical(viewMember, enabled)}
          onToggleTax={(enabled) => handleToggleStaffTax(viewMember, enabled)}
          onToggleEobi={(enabled) => handleToggleStaffEobi(viewMember, enabled)}
          onToggleCustomAllowance={(id, enabled) => handleToggleCustomAllowance(viewMember, id, enabled)}
          onToggleCustomDeduction={(id, enabled) => handleToggleCustomDeduction(viewMember, id, enabled)}
          onUpdatePoints={(delta) => updatePoints(viewMember.id, delta)}
          onResetPoints={() => setShowResetConfirm(true)}
          PointsBar={PointsBar}
          monthLabel={monthLabel}
        />
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setLightboxPhoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={lightboxPhoto} alt="Employee photo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4 h-10 w-10 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setLightboxPhoto(null)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowResetConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Reset Performance Points</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-[hsl(var(--foreground))]">
                  Are you sure you want to reset <span className="font-semibold">{viewMember.name}</span>'s performance points to 100 and clear all warnings?
                </p>
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Current Points:</span>
                    <span className="font-semibold text-[hsl(var(--foreground))]">{viewMember.points || 100}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Current Warnings:</span>
                    <span className="font-semibold text-[hsl(var(--foreground))]">{viewMember.warnings?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[hsl(var(--border))]">
                    <span className="text-[hsl(var(--muted-foreground))]">After Reset:</span>
                    <span className="font-semibold text-green-600">100 Points, 0 Warnings</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={async () => {
                    const updatedMember = { ...viewMember, points: 100, warnings: [], lastReset: new Date().toISOString() }
                    const resetData = {
                      id: viewMember.id,
                      points: 100,
                      warnings: [],
                      lastReset: new Date().toISOString()
                    }
                    
                    console.log('Resetting performance points with data:', resetData)
                    
                    // Update in database
                    fetch('/api/hrm/staff', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(resetData)
                    }).then(async res => {
                      console.log('API response status:', res.status)
                      const responseText = await res.text()
                      console.log('API response text:', responseText)
                      
                      if (res.ok) {
                        try {
                          const updatedStaff = JSON.parse(responseText)
                          console.log('Successfully updated staff:', updatedStaff)
                          // Update local state
                          setStaff(prev => prev.map(s => s.id === viewMember.id ? updatedMember : s))
                          setViewMember(updatedMember)
                        } catch (parseError) {
                          console.error('Error parsing response:', parseError)
                          // Update local state anyway
                          setStaff(prev => prev.map(s => s.id === viewMember.id ? updatedMember : s))
                          setViewMember(updatedMember)
                        }
                        // Show success modal
                        setShowResetConfirm(false)
                        setShowResetSuccess(true)
                      } else {
                        console.error('API error response:', responseText)
                        alert(`Failed to reset performance points: ${responseText}`)
                      }
                    }).catch(error => {
                      console.error('Error resetting points:', error)
                      alert(`Failed to reset performance points: ${error.message}`)
                    })
                  }}
                >
                  Reset Performance
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Success Modal */}
      {showResetSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowResetSuccess(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Performance Points Reset Successfully!</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Staff member's performance has been restored</p>
                </div>
              </div>
              
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">New Points:</span>
                  <span className="font-semibold text-green-600">100</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Warnings Cleared:</span>
                  <span className="font-semibold text-green-600">0</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Reset Date:</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => setShowResetSuccess(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary Slip Success Modal */}
      {showSalarySlipSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSalarySlipSuccess(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Salary Slip Generated Successfully!</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">PDF downloaded and saved to system</p>
                </div>
              </div>
              
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Status:</span>
                  <span className="font-semibold text-green-600">Completed</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Format:</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">PDF Document</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Saved:</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">Yes</span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => setShowSalarySlipSuccess(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary History Modal */}
      {showSalaryHistory && viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSalaryHistory(false)}>
          <div className="w-full max-w-3xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Salary Slip History</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{viewMember.name} - {viewMember.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setShowSalaryHistory(false)}><X className="h-5 w-5" /></Button>
            </div>
            
            <div className="overflow-y-auto p-6">
              {uniqueStaffSalarySlips.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))]/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No salary slips found for {viewMember.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Generate a salary slip to see it here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {uniqueStaffSalarySlips.map((slip: any) => (
                    <div key={slip.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-[hsl(var(--foreground))]">
                                {new Date(slip.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </h4>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Generated: {new Date(slip.generatedDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-[hsl(var(--muted-foreground))]">Base Salary:</span>
                              <span className="ml-2 font-medium">{slip.currency} {slip.baseSalary.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[hsl(var(--muted-foreground))]">Net Salary:</span>
                              <span className="ml-2 font-semibold text-green-600">{slip.currency} {slip.netSalary.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          {slip.adjustments && slip.adjustments.length > 0 && (
                            <div className="text-xs">
                              <span className="text-[hsl(var(--muted-foreground))]">Adjustments: </span>
                              {slip.adjustments.map((adj: any, index: number) => (
                                <span key={index} className="ml-1">
                                  {adj.type === 'add' ? '+' : '-'}{slip.currency} {adj.amount}
                                  {index < slip.adjustments.length - 1 && ', '}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              generateSalarySlipPDF(slip, viewMember.name)
                            }}
                          >
                            <Download className="h-4 w-4" /> Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={deletingSlipId === slip.id}
                            onClick={() => handleDeleteSalarySlip(slip)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingSlipId === slip.id ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Salary Slip Generation Modal */}
      {showSalarySlip && viewMember && slipFigures && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetSalarySlipModal}>
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Generate Salary Slip</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{viewMember.name} - {viewMember.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={resetSalarySlipModal}><X className="h-5 w-5" /></Button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Month Selection */}
              <div>
                <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => handleSalaryMonthChange(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                />
              </div>

              {/* Pay period */}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-3">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Pay Period</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPayPeriodMode("full_month")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${
                      payPeriodMode === "full_month"
                        ? "border-[#1a9f9a] bg-[#1a9f9a]/10 text-[#1a9f9a]"
                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20"
                    }`}
                  >
                    Full month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayPeriodMode("custom_range")
                      setPeriodFrom(periodStartForMember(viewMember, selectedMonth))
                      setPeriodTo(monthDateBounds(selectedMonth).to)
                    }}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${
                      payPeriodMode === "custom_range"
                        ? "border-[#1a9f9a] bg-[#1a9f9a]/10 text-[#1a9f9a]"
                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/20"
                    }`}
                  >
                    Custom date range
                  </button>
                </div>
                {payPeriodMode === "custom_range" && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">From</label>
                      <input
                        type="date"
                        value={periodFrom}
                        onChange={(e) => setPeriodFrom(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">To</label>
                      <input
                        type="date"
                        value={periodTo}
                        onChange={(e) => setPeriodTo(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm"
                      />
                    </div>
                    {slipFigures.proRate && slipFigures.proRate.daysWorked > 0 && (
                      <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))]">
                        Pro-rated: {slipFigures.proRate.description} — {viewMember.currency} {slipFigures.effectiveBase.toLocaleString()}
                      </p>
                    )}
                    {viewMember.join_date && periodFrom === viewMember.join_date.slice(0, 10) && (
                      <p className="col-span-2 text-xs text-amber-700">
                        Start date set from join date ({new Date(viewMember.join_date).toLocaleDateString()}).
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Base Salary */}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Base Salary</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Contract monthly salary</span>
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">{viewMember.currency} {viewMember.salary.toLocaleString()}</span>
                  </div>
                  {payPeriodMode === "custom_range" && (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">Payable for selected period</span>
                      <span className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewMember.currency} {slipFigures.effectiveBase.toLocaleString()}</span>
                    </div>
                  )}
                  {payPeriodMode === "full_month" && (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">Full month payable</span>
                      <span className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewMember.currency} {slipFigures.effectiveBase.toLocaleString()}</span>
                    </div>
                  )}
                  {effectiveStaffMedicalAmount({
                    medicalAllowance: viewMember.medical_allowance,
                    medicalEnabled: viewMember.medical_enabled,
                  }) > 0 ? (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">Medical (applied)</span>
                      <span className="text-sm font-semibold text-emerald-700">
                        + {viewMember.currency}{" "}
                        {effectiveStaffMedicalAmount({
                          medicalAllowance: viewMember.medical_allowance,
                          medicalEnabled: viewMember.medical_enabled,
                        }).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                  {effectiveStaffTaxAmount({
                    taxAmount: viewMember.tax_amount,
                    taxEnabled: viewMember.tax_enabled,
                  }) > 0 ? (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">Tax (applied)</span>
                      <span className="text-sm font-semibold text-rose-600">
                        − {viewMember.currency}{" "}
                        {effectiveStaffTaxAmount({
                          taxAmount: viewMember.tax_amount,
                          taxEnabled: viewMember.tax_enabled,
                        }).toLocaleString()}
                      </span>
                    </div>
                  ) : (Number(viewMember.tax_amount) || 0) > 0 ? (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">Tax</span>
                      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                        Off ({viewMember.currency} {Number(viewMember.tax_amount).toLocaleString()} not deducted)
                      </span>
                    </div>
                  ) : null}
                  {effectiveStaffEobiAmount({
                    eobiAmount: viewMember.eobi_amount,
                    eobiEnabled: viewMember.eobi_enabled,
                  }) > 0 ? (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">EOBI (applied)</span>
                      <span className="text-sm font-semibold text-rose-600">
                        − {viewMember.currency}{" "}
                        {effectiveStaffEobiAmount({
                          eobiAmount: viewMember.eobi_amount,
                          eobiEnabled: viewMember.eobi_enabled,
                        }).toLocaleString()}
                      </span>
                    </div>
                  ) : (Number(viewMember.eobi_amount) || 0) > 0 ? (
                    <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">EOBI</span>
                      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                        Off ({viewMember.currency} {Number(viewMember.eobi_amount).toLocaleString()} not deducted)
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Advance recovery */}
              {slipFigures.outstandingAdvance > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductAdvance}
                      onChange={(e) => setDeductAdvance(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Deduct outstanding salary advance</p>
                      <p className="text-sm text-amber-800 mt-0.5">
                        {viewMember.currency} {slipFigures.outstandingAdvance.toLocaleString()} will be recovered from this salary.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Adjustments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Adjustments</h4>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Add bonuses or deductions</span>
                </div>
                
                {/* Add Adjustment Form */}
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={newAdjustment.type}
                      onChange={(e) => setNewAdjustment(prev => ({ ...prev, type: e.target.value as 'add' | 'deduct' }))}
                      className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                    >
                      <option value="add">+ Add</option>
                      <option value="deduct">- Deduct</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={newAdjustment.amount}
                      onChange={(e) => setNewAdjustment(prev => ({ ...prev, amount: e.target.value }))}
                      className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g., Overtime)"
                      value={newAdjustment.label}
                      onChange={(e) => setNewAdjustment(prev => ({ ...prev, label: e.target.value }))}
                      className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (newAdjustment.amount && newAdjustment.label) {
                        setSalaryAdjustments(prev => [...prev, {
                          id: Date.now().toString(),
                          type: newAdjustment.type,
                          amount: newAdjustment.amount,
                          label: newAdjustment.label
                        }])
                        setNewAdjustment({ type: 'add', amount: '', label: '' })
                      }
                    }}
                    disabled={!newAdjustment.amount || !newAdjustment.label}
                  >
                    Add Adjustment
                  </Button>
                </div>

                {/* Adjustments List */}
                {salaryAdjustments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {salaryAdjustments.map(adj => (
                      <div key={adj.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold ${adj.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                            {adj.type === 'add' ? '+' : '-'} {viewMember.currency} {parseFloat(adj.amount).toLocaleString()}
                          </span>
                          <span className="text-sm text-[hsl(var(--muted-foreground))]">{adj.label}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-600"
                          onClick={() => setSalaryAdjustments(prev => prev.filter(a => a.id !== adj.id))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Salary Summary</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {payPeriodMode === "custom_range" ? "Pro-rated base salary" : "Base salary"}
                    </span>
                    <span className="font-medium">{viewMember.currency} {slipFigures.effectiveBase.toLocaleString()}</span>
                  </div>
                  {slipFigures.effectiveAdjustments.map(adj => (
                    <div key={adj.id} className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--muted-foreground))]">{adj.label}</span>
                      <span className={`font-medium ${adj.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                        {adj.type === 'add' ? '+' : '-'} {viewMember.currency} {parseFloat(adj.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Net Salary</span>
                      <span className="text-lg font-bold text-[hsl(var(--foreground))]">
                        {viewMember.currency} {slipFigures.netSalary.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={resetSalarySlipModal}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={async () => {
                    if (payPeriodMode === "custom_range") {
                      if (!periodFrom || !periodTo) {
                        alert("Please select both start and end dates for the pay period.")
                        return
                      }
                      if (periodTo < periodFrom) {
                        alert("End date must be on or after the start date.")
                        return
                      }
                    }

                    const figures = resolveSalarySlipFigures(viewMember)

                    const existsForMonth = uniqueAllSalarySlips.some((slip: any) =>
                      String(slip.month || "") === selectedMonth &&
                      String(slip.staffName || "").trim().toLowerCase() === viewMember.name.trim().toLowerCase() &&
                      String(slip.status || "finalized") === "finalized"
                    )
                    if (existsForMonth) {
                      alert(`Salary slip already created for ${viewMember.name} in ${monthLabel(selectedMonth)}.`)
                      return
                    }

                    const monthBounds = monthDateBounds(selectedMonth)
                    const salarySlipData = {
                      staffLocalId: viewMember.id,
                      staffName: viewMember.name,
                      staffRole: viewMember.role,
                      staffDepartment: viewMember.department,
                      month: selectedMonth,
                      periodStart: payPeriodMode === "custom_range" ? periodFrom : monthBounds.from,
                      periodEnd: payPeriodMode === "custom_range" ? periodTo : monthBounds.to,
                      baseSalary: figures.effectiveBase,
                      currency: viewMember.currency,
                      adjustments: figures.effectiveAdjustments,
                      netSalary: figures.netSalary,
                      status: "finalized",
                      generatedDate: new Date().toISOString(),
                      bankName: viewMember.bank_name || "",
                      bankAccountNumber: viewMember.bank_account_number || "",
                      bankAccountTitle: viewMember.bank_account_title || "",
                    }
                    
                    // Generate PDF salary slip
                    console.log('Generating salary slip:', salarySlipData)
                    
                    try {
                      // Import jspdf dynamically
                      const { jsPDF } = await import('jspdf')
                      const doc = new jsPDF()
                      
                      // Set up colors
                      const primaryColor = [31, 172, 166] // #1faca6
                      const darkColor = [20, 143, 139] // Darker teal
                      const textColor = [40, 40, 40]
                      const lightGray = [248, 250, 252]
                      const borderColor = [226, 232, 240]
                      
                      // Add elegant header background with gradient effect
                      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
                      doc.rect(0, 0, 210, 55, 'F')
                      
                      // Add logo (if available)
                      try {
                        const logoImg = new Image()
                        logoImg.src = '/logo.png'
                        await new Promise((resolve) => {
                          logoImg.onload = resolve
                          logoImg.onerror = resolve
                        })
                        if (logoImg.complete && logoImg.naturalHeight !== 0) {
                          doc.addImage(logoImg, 'PNG', 15, 10, 35, 35)
                        }
                      } catch (e) {
                        console.log('Logo not loaded')
                      }
                      
                      // Company Information (Left side)
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(16)
                      doc.setFont('helvetica', 'bold')
                      doc.text('VOLTRIX BATTERIES', 55, 18)
                      
                      doc.setFontSize(7)
                      doc.setFont('helvetica', 'normal')
                      doc.text('Head Office', 55, 24)
                      doc.text('Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', 55, 29)
                      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779', 55, 34)
                      doc.text('Email: sale@voltrixbatteries.com', 55, 39)
                      
                      // SALARY SLIP title (Right side)
                      doc.setFontSize(22)
                      doc.setFont('helvetica', 'bold')
                      doc.text('SALARY SLIP', 205, 30, { align: 'right' })
                      
                      doc.setFontSize(9)
                      doc.setFont('helvetica', 'normal')
                      doc.text(figures.payPeriodText, 205, 38, { align: 'right' })
                      
                      // Reset text color
                      doc.setTextColor(textColor[0], textColor[1], textColor[2])
                      
                      // Decorative line under header
                      doc.setLineWidth(0.5)
                      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
                      doc.line(15, 60, 195, 60)
                      
                      // Employee Information Section
                      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
                      doc.roundedRect(15, 68, 180, 60, 2, 2, 'F')
                      
                      // Section header
                      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
                      doc.rect(15, 68, 180, 8, 'F')
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(10)
                      doc.setFont('helvetica', 'bold')
                      doc.text('EMPLOYEE INFORMATION', 20, 73)
                      
                      // Employee details
                      doc.setTextColor(textColor[0], textColor[1], textColor[2])
                      doc.setFontSize(9)
                      doc.setFont('helvetica', 'bold')
                      
                      // Left column
                      doc.text('Employee Name:', 20, 83)
                      doc.text('Role:', 20, 91)
                      doc.text('Department:', 20, 99)
                      doc.text('Employee Status:', 20, 107)
                      
                      // Left column values
                      doc.setFont('helvetica', 'normal')
                      doc.text(viewMember.name, 60, 83)
                      doc.text(viewMember.role, 60, 91)
                      doc.text(viewMember.department, 60, 99)
                      doc.text('Active', 60, 107)
                      
                      // Right column
                      doc.setFont('helvetica', 'bold')
                      doc.text('Pay Period:', 120, 83)
                      doc.text('Generated On:', 120, 91)
                      doc.text('Currency:', 120, 99)
                      
                      // Right column values
                      doc.setFont('helvetica', 'normal')
                      doc.text(figures.payPeriodText, 155, 83)
                      doc.text(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }), 155, 91)
                      doc.text(viewMember.currency, 155, 99)
                      
                      // Bank Details (if available)
                      if (viewMember.bank_name || viewMember.bank_account_number) {
                        doc.setFont('helvetica', 'bold')
                        doc.text('Bank Name:', 20, 115)
                        doc.text('Account Number:', 20, 123)
                        
                        doc.setFont('helvetica', 'normal')
                        doc.text(viewMember.bank_name || '—', 60, 115)
                        doc.text(viewMember.bank_account_number || '—', 60, 123)
                        
                        if (viewMember.bank_account_title) {
                          doc.setFont('helvetica', 'bold')
                          doc.text('Account Title:', 120, 115)
                          doc.setFont('helvetica', 'normal')
                          doc.text(viewMember.bank_account_title, 155, 115)
                        }
                      }
                      
                      // Salary Breakdown Section
                      let currentY = (viewMember.bank_name || viewMember.bank_account_number) ? 140 : 125
                      
                      // Base Salary
                      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
                      doc.roundedRect(15, currentY, 180, 12, 2, 2, 'F')
                      
                      doc.setFontSize(11)
                      doc.setFont('helvetica', 'bold')
                      doc.setTextColor(textColor[0], textColor[1], textColor[2])
                      doc.text('BASE SALARY', 20, currentY + 8)
                      doc.setFontSize(12)
                      doc.text(`${viewMember.currency} ${figures.effectiveBase.toLocaleString()}`, 190, currentY + 8, { align: 'right' })
                      if (payPeriodMode === "custom_range" && figures.proRate) {
                        doc.setFontSize(8)
                        doc.setFont('helvetica', 'normal')
                        doc.text(`Contract: ${viewMember.currency} ${viewMember.salary.toLocaleString()} (${figures.proRate.description})`, 20, currentY + 11)
                      }
                      
                      currentY += payPeriodMode === "custom_range" && figures.proRate ? 24 : 20
                      
                      // Adjustments Section
                      if (figures.effectiveAdjustments.length > 0) {
                        // Adjustments header
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
                        doc.rect(15, currentY, 180, 8, 'F')
                        doc.setTextColor(255, 255, 255)
                        doc.setFontSize(10)
                        doc.setFont('helvetica', 'bold')
                        doc.text('SALARY ADJUSTMENTS', 20, currentY + 5)
                        
                        currentY += 12
                        doc.setTextColor(textColor[0], textColor[1], textColor[2])
                        
                        figures.effectiveAdjustments.forEach((adj, index) => {
                          const amount = parseFloat(adj.amount)
                          const isAddition = adj.type === 'add'
                          
                          // Alternating row background
                          if (index % 2 === 0) {
                            doc.setFillColor(252, 252, 252)
                            doc.rect(15, currentY - 4, 180, 9, 'F')
                          }
                          
                          doc.setFontSize(9)
                          doc.setFont('helvetica', 'normal')
                          doc.text(adj.label, 20, currentY)
                          
                          // Amount with color coding
                          doc.setFont('helvetica', 'bold')
                          if (isAddition) {
                            doc.setTextColor(34, 197, 94) // Green
                            doc.text(`+ ${viewMember.currency} ${amount.toLocaleString()}`, 190, currentY, { align: 'right' })
                          } else {
                            doc.setTextColor(239, 68, 68) // Red
                            doc.text(`- ${viewMember.currency} ${amount.toLocaleString()}`, 190, currentY, { align: 'right' })
                          }
                          doc.setTextColor(textColor[0], textColor[1], textColor[2])
                          
                          currentY += 9
                        })
                        
                        currentY += 5
                      }
                      
                      // Divider line
                      doc.setLineWidth(0.5)
                      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
                      doc.line(15, currentY, 195, currentY)
                      currentY += 10
                      
                      // Net Salary Section - Highlighted Box
                      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
                      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F')
                      
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(13)
                      doc.setFont('helvetica', 'bold')
                      doc.text('NET SALARY (TOTAL PAYABLE)', 20, currentY + 13)
                      doc.setFontSize(16)
                      doc.text(`${viewMember.currency} ${figures.netSalary.toLocaleString()}`, 190, currentY + 13, { align: 'right' })
                      
                      // Reset text color
                      doc.setTextColor(textColor[0], textColor[1], textColor[2])
                      
                      // Important Note Section
                      currentY += 35
                      doc.setFillColor(255, 251, 235) // Light yellow
                      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'F')
                      doc.setDrawColor(251, 191, 36) // Yellow border
                      doc.setLineWidth(0.5)
                      doc.roundedRect(15, currentY, 180, 20, 2, 2, 'S')
                      
                      doc.setFontSize(8)
                      doc.setFont('helvetica', 'bold')
                      doc.setTextColor(146, 64, 14) // Brown text
                      doc.text('IMPORTANT NOTE:', 20, currentY + 7)
                      doc.setFont('helvetica', 'normal')
                      doc.text('This salary slip is computer-generated and does not require a signature.', 20, currentY + 12)
                      doc.text('Please verify all details and contact HR for any discrepancies.', 20, currentY + 16)
                      
                      // Footer section with company info
                      doc.setTextColor(textColor[0], textColor[1], textColor[2])
                      doc.setLineWidth(0.3)
                      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
                      doc.line(15, 270, 195, 270)
                      
                      doc.setFontSize(8)
                      doc.setFont('helvetica', 'italic')
                      doc.setTextColor(100, 100, 100)
                      doc.text('Voltrix Batteries - Human Resources Management System', 105, 276, { align: 'center' })
                      doc.text('Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad', 105, 281, { align: 'center' })
                      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779 | Email: sale@voltrixbatteries.com', 105, 286, { align: 'center' })
                      
                      // Save and download
                      const pdfBlob = doc.output('blob')
                      const url = URL.createObjectURL(pdfBlob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `Salary-Slip-${viewMember.name.replace(/\s+/g, '-')}-${selectedMonth}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      
                      // Save to system (with localStorage fallback)
                      try {
                        const response = await fetch('/api/hrm/salary-slips', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(salarySlipData)
                        })
                        if (response.status === 409) {
                          alert(`Salary slip already created for ${viewMember.name} in ${monthLabel(selectedMonth)}.`)
                          return
                        }
                        if (!response.ok) throw new Error('Database save failed')

                        if (deductAdvance && figures.outstandingAdvance > 0) {
                          await recoverSalaryAdvances({
                            staffId: viewMember.id,
                            month: selectedMonth,
                            recoveredBy: user?.name || "Admin",
                          })
                          await refreshAdvanceSummary()
                        }
                      } catch (dbError) {
                        console.warn('Database save failed, using localStorage fallback:', dbError)
                        const existsInLocal = (JSON.parse(localStorage.getItem('salary_slips') || '[]') as any[]).some((slip: any) =>
                          String(slip.month || "") === selectedMonth &&
                          String(slip.staffName || "").trim().toLowerCase() === viewMember.name.trim().toLowerCase()
                        )
                        if (existsInLocal) {
                          alert(`Salary slip already created for ${viewMember.name} in ${monthLabel(selectedMonth)}.`)
                          return
                        }
                        // Fallback to localStorage
                        const existingSlips = JSON.parse(localStorage.getItem('salary_slips') || '[]')
                        const newSlip = {
                          ...salarySlipData,
                          id: Date.now().toString(),
                          createdAt: new Date().toISOString()
                        }
                        existingSlips.push(newSlip)
                        localStorage.setItem('salary_slips', JSON.stringify(existingSlips))
                      }
                      
                      // Show success and close modal
                      await fetchAllSalarySlips()
                      resetSalarySlipModal()
                      setShowSalarySlipSuccess(true)
                      
                    } catch (error) {
                      console.error('Error generating PDF:', error)
                      alert('Error generating salary slip. Please try again.')
                    }
                  }}
                >
                  Generate & Download Slip
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayrollHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPayrollHistory(false)}>
          <div className="w-full max-w-5xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Payroll History</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Paid employees and final amount by month</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPayrollHistory(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="overflow-auto p-6">
              {uniqueAllSalarySlips.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No payroll records yet.</p>
              ) : (
                <div className="space-y-3">
                  {sortedPayrollMonths.map((month) => {
                    const slips = payrollHistoryByMonth[month]
                    const subtotal = slips.reduce((sum, slip) => sum + Number(slip.netSalary || 0), 0)
                    const currency = slips[0]?.currency || "PKR"
                    return (
                      <div key={month} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                        <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{monthLabel(month)}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{slips.length} paid records</p>
                          </div>
                          <p className="text-sm font-semibold text-emerald-600">{currency} {subtotal.toLocaleString()}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {slips.map((slip: any) => (
                            <div key={slip.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{slip.staffName}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{slip.staffRole}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-emerald-600">{slip.currency} {Number(slip.netSalary || 0).toLocaleString()}</p>
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {slip.status === "draft" ? "Draft" : "Paid"}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Delete payment history"
                                  disabled={deletingSlipId === slip.id}
                                  onClick={() => handleDeleteSalarySlip(slip)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdvanceModal && viewMember && isErpAdmin(user?.role) && (
        <StaffSalaryAdvanceModal
          staff={{
            id: viewMember.id,
            name: viewMember.name,
            role: viewMember.role,
            currency: viewMember.currency || "PKR",
          }}
          givenBy={user?.name || "Admin"}
          onClose={() => setShowAdvanceModal(false)}
          onUpdate={refreshAdvanceSummary}
        />
      )}

      {showMakeSalariesModal && staff.length > 0 && (
        <MakeSalariesModal
          staff={staff}
          advanceByStaff={advanceByStaff}
          existingSlips={allSalarySlips}
          initialMonth={makeSalariesInitialMonth}
          recoveredBy={user?.name || "Admin"}
          onClose={() => setShowMakeSalariesModal(false)}
          onSaved={async () => {
            await fetchAllSalarySlips()
            await refreshAdvanceSummary()
          }}
        />
      )}
    </div>
  )
}
