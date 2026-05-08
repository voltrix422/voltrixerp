"use client"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Search, Trash2, UserCog, Phone, Mail, MapPin, Briefcase, Upload, FileText, Download, IdCard } from "lucide-react"

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

interface PayrollRow {
  staffId: string
  staffName: string
  role: string
  baseSalary: number
  currency: string
  adjustmentType: 'add' | 'deduct'
  adjustmentAmount: string
  adjustmentLabel: string
}

const DEPARTMENTS = ["Management", "Engineering", "Sales", "Finance", "HR", "Operations", "Marketing", "Support", "Other"]
const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED"]

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
  const [showFilters, setShowFilters] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetSuccess, setShowResetSuccess] = useState(false)
  const [showSalarySlip, setShowSalarySlip] = useState(false)
  const [showSalarySlipSuccess, setShowSalarySlipSuccess] = useState(false)
  const [showSalaryHistory, setShowSalaryHistory] = useState(false)
  const [salarySlips, setSalarySlips] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [salaryAdjustments, setSalaryAdjustments] = useState<{ id: string; type: 'add' | 'deduct'; amount: string; label: string }[]>([])
  const [newAdjustment, setNewAdjustment] = useState({ type: 'add' as 'add' | 'deduct', amount: '', label: '' })
  const [allSalarySlips, setAllSalarySlips] = useState<any[]>([])
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))
  const [showPayrollRun, setShowPayrollRun] = useState(false)
  const [showPayrollHistory, setShowPayrollHistory] = useState(false)
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([])

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
      doc.text('Email: info@voltrix-power.com', 55, 39)
      
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
      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779 | Email: info@voltrix-power.com', 105, 286, { align: 'center' })
      
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
  const [currency, setCurrency] = useState("USD")
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
  const monthPaidSlips = uniqueAllSalarySlips.filter((slip: any) => slip.month === payrollMonth)
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

  function openPayrollRun() {
    if (monthPaidSlips.length > 0) {
      alert(`Payroll already created for ${monthLabel(payrollMonth)}. Please select another month.`)
      return
    }
    const rows: PayrollRow[] = activeStaff.map((member) => ({
      staffId: member.id,
      staffName: member.name,
      role: member.role,
      baseSalary: Number(member.salary || 0),
      currency: member.currency || "PKR",
      adjustmentType: "add",
      adjustmentAmount: "",
      adjustmentLabel: "",
    }))
    setPayrollRows(rows)
    setShowPayrollRun(true)
  }

  function updatePayrollRow(staffId: string, patch: Partial<PayrollRow>) {
    setPayrollRows(prev => prev.map(row => row.staffId === staffId ? { ...row, ...patch } : row))
  }

  async function runPayrollAndDownload() {
    if (payrollRows.length === 0) return
    if (monthPaidSlips.length > 0) {
      alert(`Payroll already created for ${monthLabel(payrollMonth)}. Please select another month.`)
      return
    }
    try {
      const slipsToSave = payrollRows.map((row) => {
        const adjustmentNum = Number(row.adjustmentAmount || 0)
        const signedAdj = row.adjustmentAmount
          ? (row.adjustmentType === "add" ? adjustmentNum : -adjustmentNum)
          : 0
        const netSalary = Math.max(0, row.baseSalary + signedAdj)
        const adjustments = row.adjustmentAmount
          ? [{ id: `${Date.now()}-${row.staffId}`, type: row.adjustmentType, amount: String(adjustmentNum), label: row.adjustmentLabel || "Payroll Adjustment" }]
          : []
        return {
          staffName: row.staffName,
          staffRole: row.role,
          staffDepartment: staff.find(s => s.id === row.staffId)?.department || "—",
          month: payrollMonth,
          baseSalary: row.baseSalary,
          currency: row.currency,
          adjustments,
          netSalary,
          generatedDate: new Date().toISOString(),
          bankName: staff.find(s => s.id === row.staffId)?.bank_name || "",
          bankAccountNumber: staff.find(s => s.id === row.staffId)?.bank_account_number || "",
          bankAccountTitle: staff.find(s => s.id === row.staffId)?.bank_account_title || "",
          bankIban: (staff.find(s => s.id === row.staffId) as any)?.bank_iban || "",
        }
      })

      for (const slip of slipsToSave) {
        const response = await fetch('/api/hrm/salary-slips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slip)
        })
        if (response.status === 409) {
          throw new Error(`Payroll already created for ${monthLabel(payrollMonth)}.`)
        }
        if (!response.ok) {
          throw new Error('Failed to save payroll record')
        }
      }

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const primaryColor: [number, number, number] = [26, 159, 154]
      const textColor: [number, number, number] = [30, 41, 59]
      const borderColor: [number, number, number] = [203, 213, 225]

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(0, 0, 297, 28, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.text(`Monthly Payroll - ${monthLabel(payrollMonth)}`, 12, 12)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 12, 19)

      const total = slipsToSave.reduce((sum, s) => sum + Number(s.netSalary || 0), 0)
      doc.setFont("helvetica", "bold")
      doc.text(`Total Payroll: ${slipsToSave[0]?.currency || "PKR"} ${total.toLocaleString()}`, 285, 12, { align: "right" })
      doc.setFont("helvetica", "normal")
      doc.text(`Payment Status: Paid (${slipsToSave.length}/${slipsToSave.length})`, 285, 19, { align: "right" })

      const cols = {
        employee: 10,
        role: 48,
        bankName: 84,
        accountTitle: 120,
        ibanAccount: 164,
        base: 208,
        adjustment: 232,
        net: 256,
        status: 282,
      }

      let y = 36
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
      doc.setFillColor(241, 245, 249)
      doc.rect(10, y - 6, 277, 8, "FD")
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.text("Employee", cols.employee, y - 1)
      doc.text("Role", cols.role, y - 1)
      doc.text("Bank Name", cols.bankName, y - 1)
      doc.text("Account Title", cols.accountTitle, y - 1)
      doc.text("IBAN / Account", cols.ibanAccount, y - 1)
      doc.text("Base", cols.base, y - 1)
      doc.text("Adjustment", cols.adjustment, y - 1)
      doc.text("Net", cols.net, y - 1)
      doc.text("Status", cols.status, y - 1)
      y += 4

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      slipsToSave.forEach((slip, index) => {
        if (y > 195) {
          doc.addPage("a4", "landscape")
          y = 18
        }

        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252)
          doc.rect(10, y - 4.5, 277, 7.5, "F")
        }

        const adjustmentAmount = Number(slip.adjustments?.[0]?.amount || 0)
        const adjustmentSign = slip.adjustments?.[0]?.type === "deduct" ? "-" : "+"
        const adjustmentText = slip.adjustments?.length
          ? `${adjustmentSign}${slip.currency} ${adjustmentAmount.toLocaleString()}`
          : `${slip.currency} 0`

        const ibanOrAccount = String(slip.bankIban || slip.bankAccountNumber || "—")
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        doc.text(String(slip.staffName || "—").slice(0, 24), cols.employee, y)
        doc.text(String(slip.staffRole || "—").slice(0, 18), cols.role, y)
        doc.text(String(slip.bankName || "—").slice(0, 18), cols.bankName, y)
        doc.text(String(slip.bankAccountTitle || "—").slice(0, 22), cols.accountTitle, y)
        doc.text(ibanOrAccount.slice(0, 24), cols.ibanAccount, y)
        doc.text(`${slip.currency} ${Number(slip.baseSalary || 0).toLocaleString()}`, cols.base, y)
        doc.text(adjustmentText, cols.adjustment, y)
        doc.text(`${slip.currency} ${Number(slip.netSalary || 0).toLocaleString()}`, cols.net, y)
        doc.setTextColor(22, 163, 74)
        doc.text("Paid", cols.status, y)
        y += 7
      })

      doc.save(`Payroll-${payrollMonth}.pdf`)
      setShowPayrollRun(false)
      await fetchAllSalarySlips()
    } catch (error) {
      console.error("Payroll generation failed:", error)
      alert("Failed to generate payroll.")
    }
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
    setPhone(""); setAddress(""); setSalary(""); setCurrency("USD")
    setJoinDate(""); setStatus("active"); setNotes("")
    setBankName(""); setBankAccountNumber(""); setBankAccountTitle("")
    setPhotoFile(null); setPhotoPreview(""); setShowForm(false)
    setDocuments([])
    setNewDocName("")
    setEditingMember(null)
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

  // Points Progress Bar Component
  function PointsBar({ points }: { points: number }) {
    const getColor = () => {
      if (points <= 20) return 'bg-red-500'
      if (points <= 50) return 'bg-orange-500'
      if (points <= 70) return 'bg-yellow-500'
      return 'bg-emerald-500'
    }

    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={points <= 20 ? 'text-red-600 font-bold' : 'text-[hsl(var(--muted-foreground))]'}>
            {points} / 100 points
          </span>
          {points <= 20 && <span className="text-red-600 font-bold">CRITICAL</span>}
          {points <= 50 && points > 20 && <span className="text-orange-600 font-medium">Warning</span>}
          {points <= 70 && points > 50 && <span className="text-yellow-600 font-medium">Caution</span>}
        </div>
        <div className="h-2 w-full rounded-full bg-[hsl(var(--muted))]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
            style={{ width: `${points}%` }}
          />
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Staff Management</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Manage staff profiles, performance, and HR information</p>
        </div>
        <Button size="sm" className="h-9 px-4 text-sm gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white cursor-pointer rounded-lg" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New Staff
        </Button>
      </div>

      {/* Stats */}
      {staff.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Total Staff</p>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{staff.length}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Inactive</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{staff.length - activeCount}</p>
          </div>
        </div>
      )}

      {staff.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Monthly Payroll KPI</p>
              <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mt-1">
                {monthPaidSlips[0]?.currency || "PKR"} {monthPaidTotal.toLocaleString()}
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {monthPaidCount} employees paid in {monthLabel(payrollMonth)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="success" className="text-[10px] px-2 py-0.5">Paid: {monthPaidCount}</Badge>
                <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Unpaid: {monthUnpaidCount}</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent"
              />
              <Button size="sm" variant="outline" className="h-9 text-xs gap-2" onClick={() => setShowPayrollHistory(true)}>
                <FileText className="h-3.5 w-3.5" /> Payroll History
              </Button>
              <Button size="sm" className="h-9 text-xs gap-2 bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={openPayrollRun}>
                <Download className="h-3.5 w-3.5" /> Run Payroll & Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toggle */}
      {staff.length > 0 && (
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7" />
          </svg>
          Filter staff
        </button>
      )}

      {/* Filters */}
      {staff.length > 0 && showFilters && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 flex flex-wrap gap-2 items-center animate-in slide-in-from-top-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, email..."
              className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-3 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[#1a9f9a] focus:border-transparent">
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || filterDept !== "All" || filterStatus !== "All") && (
            <button onClick={() => { setSearch(""); setFilterDept("All"); setFilterStatus("All") }}
              className="h-9 px-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--muted))]/10">Clear</button>
          )}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto">{filtered.length} of {staff.length}</span>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[hsl(var(--border))]/30 rounded-xl bg-[hsl(var(--card))]">
          <div className="h-12 w-12 rounded-full bg-[hsl(var(--muted))]/30 flex items-center justify-center mx-auto mb-3">
            <UserCog className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No staff yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add your first staff member to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))]/30 rounded-lg bg-[hsl(var(--card))]">No staff match your filters.</div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Staff</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Points</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Contact</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Salary</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setViewMember(s)}
                  className={`border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/10 cursor-pointer transition-colors ${(s.points || 100) <= 20 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]/30 flex items-center justify-center ring-1 ring-[hsl(var(--border))]">
                        {s.photo_url
                          ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                          : <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{s.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{s.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[hsl(var(--foreground))]">{s.department}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === "active" ? "success" : "destructive"} className="text-xs px-2 py-1">{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 w-40">
                    <PointsBar points={s.points || 100} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[hsl(var(--foreground))]">{s.email || "—"}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.phone || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {s.salary > 0 ? (
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{s.currency} {s.salary.toLocaleString()}</p>
                    ) : (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">—</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost"
                        className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">{editingMember ? "Edit Staff Member" : "New Staff Member"}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={resetForm}><X className="h-5 w-5" /></Button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">

              {/* Photo */}
              <div className="flex items-center gap-4">
                <div onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center cursor-pointer hover:border-[#1a9f9a] overflow-hidden shrink-0 transition-colors bg-[hsl(var(--muted))]/10">
                  {photoPreview
                    ? <img src={photoPreview} alt="photo" className="h-full w-full object-cover" />
                    : <Upload className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">Photo</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Click circle to upload</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Full Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ahmed Khan"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Job Title *</label>
                  <input value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Engineer"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Salary</label>
                  <input value={salary} onChange={e => setSalary(e.target.value)} type="number" min="0" placeholder="0"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Join Date</label>
                  <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as "active" | "inactive")}
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="City, Country"
                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                </div>
                
                {/* Bank Details Section */}
                <div className="col-span-2 pt-2 border-t">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Bank Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[hsl(var(--foreground))]">Bank Name</label>
                      <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Meezan Bank"
                        className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[hsl(var(--foreground))]">Account Number</label>
                      <input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="e.g. 1234567890"
                        className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium text-[hsl(var(--foreground))]">Account Title</label>
                      <input value={bankAccountTitle} onChange={e => setBankAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ahmed Khan"
                        className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium text-[hsl(var(--foreground))]">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional info..."
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent resize-none" />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">Documents</label>
                <input ref={docFileRef} type="file" className="hidden" onChange={handleDocFileChange} />
                
                {/* Existing documents (in edit mode) */}
                {editingMember && editingMember.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Existing Documents</p>
                    {editingMember.documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <span className="flex-1 min-w-0 text-sm truncate">{doc.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {(doc.size / 1024).toFixed(0)}KB
                        </span>
                        <button type="button" onClick={() => {
                          const updated = editingMember.documents.filter((_, idx) => idx !== i)
                          setEditingMember({ ...editingMember, documents: updated })
                        }}
                          className="text-red-400 hover:text-red-600 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New documents to upload */}
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                    <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                    <input
                      value={doc.name}
                      onChange={e => updateDocName(i, e.target.value)}
                      placeholder="Document name"
                      className="flex-1 min-w-0 bg-transparent text-sm text-[hsl(var(--foreground))] focus:outline-none"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                      {(doc.file.size / 1024).toFixed(0)}KB
                    </span>
                    <button type="button" onClick={() => removeDoc(i)}
                      className="text-red-400 hover:text-red-600 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Add new document - label first, then upload */}
                <div className="flex items-center gap-2">
                  <input
                    value={newDocName}
                    onChange={e => setNewDocName(e.target.value)}
                    placeholder="Enter document name..."
                    className="flex-1 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handlePendingUpload}
                    disabled={!newDocName.trim()}
                    className="h-10 px-4 rounded-lg bg-[#1a9f9a] text-white text-sm font-medium hover:bg-[#158a85] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Upload className="h-4 w-4" /> Upload
                  </button>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Enter a name, then click Upload to select file (PDF, DOCX, images…)</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-10" onClick={resetForm}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1 h-10 bg-[#1a9f9a] hover:bg-[#158a85] text-white" disabled={saving}>
                  {saving ? "Saving..." : editingMember ? "Update Staff" : "Save Staff"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Staff Modal */}
      {viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewMember(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 rounded-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]/30 flex items-center justify-center border border-[hsl(var(--border))] cursor-pointer hover:ring-2 hover:ring-[#1a9f9a] transition-all"
                  onClick={() => viewMember.photo_url && setLightboxPhoto(viewMember.photo_url)}
                >
                  {viewMember.photo_url
                    ? <img src={viewMember.photo_url} alt={viewMember.name} className="h-full w-full object-cover" />
                    : <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{viewMember.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">{viewMember.name}</p>
                <Badge variant={viewMember.status === "active" ? "success" : "destructive"} className="text-[10px] px-1.5 py-0">{viewMember.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => downloadIdCard(viewMember)}>
                  <IdCard className="h-4 w-4" /> Download ID Card
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => openEditForm(viewMember)}>Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setViewMember(null)}><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Role & Department */}
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Role & Department</p>
                <p className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewMember.role}</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.department}</p>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                {viewMember.email && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                    <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewMember.email}</p>
                    </div>
                  </div>
                )}
                {viewMember.phone && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 px-4 py-3">
                    <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{viewMember.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Salary */}
              {viewMember.salary > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Salary</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => setShowSalarySlip(true)}>
                        <Download className="h-4 w-4" /> Generate
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => {
                        fetchSalarySlips(viewMember.name)
                        setShowSalaryHistory(true)
                      }}>
                        <FileText className="h-4 w-4" /> History
                      </Button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{viewMember.currency} {viewMember.salary.toLocaleString()}</p>
                  <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Salary History Snapshot</p>
                    {salarySlips.length === 0 ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">No paid history yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {salarySlips.slice(0, 3).map((slip: any) => (
                          <div key={slip.id} className="flex items-center justify-between text-xs">
                            <span className="text-[hsl(var(--foreground))]">{monthLabel(slip.month)}</span>
                            <span className="font-semibold text-emerald-600">{slip.currency} {Number(slip.netSalary || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Performance Points */}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Performance Points</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    (viewMember.points || 100) <= 20 ? 'bg-red-100 text-red-700' :
                    (viewMember.points || 100) <= 50 ? 'bg-orange-100 text-orange-700' :
                    (viewMember.points || 100) <= 70 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {(viewMember.points || 100)} / 100
                  </span>
                </div>
                <PointsBar points={viewMember.points || 100} />
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[hsl(var(--border))]">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Last reset: {viewMember.last_reset ? new Date(viewMember.last_reset).toLocaleDateString() : 'N/A'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updatePoints(viewMember.id, -5)}
                      disabled={(viewMember.points || 100) <= 0}
                      className="h-8 px-3 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => updatePoints(viewMember.id, 5)}
                      disabled={(viewMember.points || 100) >= 100}
                      className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      +5
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="h-8 px-3 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      Reset Performance
                    </button>
                  </div>
                </div>
              </div>

              {/* Warnings History */}
              {viewMember.warnings && viewMember.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                    Warnings ({viewMember.warnings.length})
                  </p>
                  <div className="space-y-2">
                    {viewMember.warnings.map((warning, i) => (
                      <div key={i} className={`rounded-lg border px-4 py-3 ${
                        warning.level === 3 ? 'bg-red-50 border-red-200' :
                        warning.level === 2 ? 'bg-orange-50 border-orange-200' :
                        'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            warning.level === 3 ? 'bg-red-500 text-white' :
                            warning.level === 2 ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-white'
                          }`}>
                            Warning #{warning.level}
                          </span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {new Date(warning.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-[hsl(var(--foreground))]">{warning.message}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          Points at warning: {warning.pointsAtWarning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Join Date */}
              {viewMember.join_date && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Join Date</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.join_date}</p>
                </div>
              )}

              {/* Address */}
              {viewMember.address && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Address</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{viewMember.address}</p>
                </div>
              )}

              {/* Bank Details */}
              {(viewMember.bank_name || viewMember.bank_account_number) && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Bank Details</p>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Bank Name</p>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{viewMember.bank_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Account Number</p>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{viewMember.bank_account_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Account Title</p>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{viewMember.bank_account_title || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewMember.notes && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap bg-[hsl(var(--muted))]/10 rounded-lg border border-[hsl(var(--border))] p-4">{viewMember.notes}</p>
                </div>
              )}

              {/* Documents */}
              {viewMember.documents?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Documents ({viewMember.documents.length})</p>
                  <div className="space-y-2">
                    {viewMember.documents.map((doc, i) => (
                      <a key={i} href={doc.data} download={doc.name}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/10 px-4 py-3 transition-colors group">
                        <FileText className="h-4 w-4 text-[#1a9f9a] shrink-0" />
                        <span className="text-sm flex-1 truncate">{doc.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{(doc.size / 1024).toFixed(0)}KB</span>
                        <Download className="h-4 w-4 text-[hsl(var(--muted-foreground))] group-hover:text-[#1a9f9a] shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1 pt-4 border-t border-[hsl(var(--border))]">
                <p>Created: {(viewMember.created_at || (viewMember as any).createdAt) ? new Date(viewMember.created_at || (viewMember as any).createdAt).toLocaleString() : 'N/A'}</p>
                <p>Created by: {viewMember.created_by || (viewMember as any).createdBy || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>
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
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            // Generate PDF for this salary slip
                            generateSalarySlipPDF(slip, viewMember.name)
                          }}
                        >
                          <Download className="h-4 w-4" /> Download
                        </Button>
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
      {showSalarySlip && viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSalarySlip(false)}>
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
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setShowSalarySlip(false)}><X className="h-5 w-5" /></Button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Month Selection */}
              <div>
                <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#1a9f9a] focus:border-transparent"
                />
              </div>

              {/* Base Salary */}
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Base Salary</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">Monthly Salary</span>
                  <span className="text-lg font-semibold text-[hsl(var(--foreground))]">{viewMember.currency} {viewMember.salary.toLocaleString()}</span>
                </div>
              </div>

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
                    <span className="text-[hsl(var(--muted-foreground))]">Base Salary</span>
                    <span className="font-medium">{viewMember.currency} {viewMember.salary.toLocaleString()}</span>
                  </div>
                  {salaryAdjustments.map(adj => (
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
                        {viewMember.currency} {
                          (viewMember.salary + salaryAdjustments.reduce((sum, adj) => {
                            return sum + (adj.type === 'add' ? parseFloat(adj.amount) : -parseFloat(adj.amount))
                          }, 0)).toLocaleString()
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowSalarySlip(false)
                  setSalaryAdjustments([])
                  setNewAdjustment({ type: 'add', amount: '', label: '' })
                }}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={async () => {
                    const existsForMonth = uniqueAllSalarySlips.some((slip: any) =>
                      String(slip.month || "") === selectedMonth &&
                      String(slip.staffName || "").trim().toLowerCase() === viewMember.name.trim().toLowerCase()
                    )
                    if (existsForMonth) {
                      alert(`Salary slip already created for ${viewMember.name} in ${monthLabel(selectedMonth)}.`)
                      return
                    }

                    // Generate salary slip PDF
                    const netSalary = viewMember.salary + salaryAdjustments.reduce((sum, adj) => {
                      return sum + (adj.type === 'add' ? parseFloat(adj.amount) : -parseFloat(adj.amount))
                    }, 0)
                    
                    // Create salary slip data
                    const salarySlipData = {
                      staffName: viewMember.name,
                      staffRole: viewMember.role,
                      staffDepartment: viewMember.department,
                      month: selectedMonth,
                      baseSalary: viewMember.salary,
                      currency: viewMember.currency,
                      adjustments: salaryAdjustments,
                      netSalary: netSalary,
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
                      doc.text('Email: info@voltrix-power.com', 55, 39)
                      
                      // SALARY SLIP title (Right side)
                      doc.setFontSize(22)
                      doc.setFont('helvetica', 'bold')
                      doc.text('SALARY SLIP', 205, 30, { align: 'right' })
                      
                      doc.setFontSize(9)
                      doc.setFont('helvetica', 'normal')
                      doc.text(new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), 205, 38, { align: 'right' })
                      
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
                      doc.text(new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), 155, 83)
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
                      doc.text(`${viewMember.currency} ${viewMember.salary.toLocaleString()}`, 190, currentY + 8, { align: 'right' })
                      
                      currentY += 20
                      
                      // Adjustments Section
                      if (salaryAdjustments.length > 0) {
                        // Adjustments header
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
                        doc.rect(15, currentY, 180, 8, 'F')
                        doc.setTextColor(255, 255, 255)
                        doc.setFontSize(10)
                        doc.setFont('helvetica', 'bold')
                        doc.text('SALARY ADJUSTMENTS', 20, currentY + 5)
                        
                        currentY += 12
                        doc.setTextColor(textColor[0], textColor[1], textColor[2])
                        
                        salaryAdjustments.forEach((adj, index) => {
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
                      doc.text(`${viewMember.currency} ${netSalary.toLocaleString()}`, 190, currentY + 13, { align: 'right' })
                      
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
                      doc.text('Phone: 051-8731661 | Mobile: +92 303 4927779 | Email: info@voltrix-power.com', 105, 286, { align: 'center' })
                      
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
                      setShowSalarySlip(false)
                      setShowSalarySlipSuccess(true)
                      setSalaryAdjustments([])
                      setNewAdjustment({ type: 'add', amount: '', label: '' })
                      
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

      {showPayrollRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPayrollRun(false)}>
          <div className="w-full max-w-6xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Payroll Review - {monthLabel(payrollMonth)}</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Review each employee salary, add/deduct amount, then generate one payroll report.</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPayrollRun(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="overflow-auto p-6">
              <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--muted))]/30 border-b border-[hsl(var(--border))]">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs">Employee</th>
                      <th className="text-left px-3 py-2 text-xs">Base Salary</th>
                      <th className="text-left px-3 py-2 text-xs">Type</th>
                      <th className="text-left px-3 py-2 text-xs">Amount</th>
                      <th className="text-left px-3 py-2 text-xs">Reason</th>
                      <th className="text-right px-3 py-2 text-xs">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRows.map((row) => {
                      const adjustmentNum = Number(row.adjustmentAmount || 0)
                      const signedAdj = row.adjustmentAmount ? (row.adjustmentType === "add" ? adjustmentNum : -adjustmentNum) : 0
                      const net = Math.max(0, row.baseSalary + signedAdj)
                      return (
                        <tr key={row.staffId} className="border-b border-[hsl(var(--border))]">
                          <td className="px-3 py-2">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{row.staffName}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.role}</p>
                          </td>
                          <td className="px-3 py-2 text-sm">{row.currency} {row.baseSalary.toLocaleString()}</td>
                          <td className="px-3 py-2">
                            <select
                              value={row.adjustmentType}
                              onChange={(e) => updatePayrollRow(row.staffId, { adjustmentType: e.target.value as 'add' | 'deduct' })}
                              className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                            >
                              <option value="add">+ Add</option>
                              <option value="deduct">- Deduct</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={row.adjustmentAmount}
                              onChange={(e) => updatePayrollRow(row.staffId, { adjustmentAmount: e.target.value })}
                              placeholder="0"
                              className="h-8 w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.adjustmentLabel}
                              onChange={(e) => updatePayrollRow(row.staffId, { adjustmentLabel: e.target.value })}
                              placeholder="Bonus / Penalty / Advance"
                              className="h-8 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-[hsl(var(--foreground))]">{row.currency} {net.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] px-6 py-4 flex items-center justify-between gap-3">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Total payout: {payrollRows[0]?.currency || "PKR"} {payrollRows.reduce((sum, row) => {
                  const n = Number(row.adjustmentAmount || 0)
                  const s = row.adjustmentAmount ? (row.adjustmentType === "add" ? n : -n) : 0
                  return sum + Math.max(0, row.baseSalary + s)
                }, 0).toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowPayrollRun(false)}>Cancel</Button>
                <Button className="bg-[#1a9f9a] hover:bg-[#158a85] text-white" onClick={runPayrollAndDownload}>Save & Download Payroll</Button>
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
                            <div key={slip.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{slip.staffName}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{slip.staffRole}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-emerald-600">{slip.currency} {Number(slip.netSalary || 0).toLocaleString()}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Paid</p>
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
    </div>
  )
}
