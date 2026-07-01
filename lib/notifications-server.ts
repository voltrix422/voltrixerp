import { prisma } from "@/lib/db"
import { sendNotificationEmail } from "@/lib/email"
import { roleHasAllModules } from "@/lib/auth"

export type NotificationType = "info" | "warning" | "success" | "error"

export type CreateNotificationInput = {
  title: string
  message?: string
  type?: NotificationType
  link?: string
}

type ErpModule =
  | "dashboard"
  | "purchase"
  | "finance"
  | "crm"
  | "inventory"
  | "dispatches"
  | "website"
  | "docs"
  | "hrm"
  | "branches"
  | "tickets"
  | "warranty"
  | "pos"

function parseModules(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

function parseNotificationEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(e => String(e).trim()).filter(Boolean)
}

async function getUserIdsByModule(module: ErpModule): Promise<string[]> {
  const users = await prisma.erpUser.findMany({
    select: { id: true, role: true, modules: true },
  })
  return users
    .filter(u => roleHasAllModules(u.role) || parseModules(u.modules).includes(module))
    .map(u => u.id)
}

async function sendEmailsForUser(userId: string, input: CreateNotificationInput) {
  const user = await prisma.erpUser.findUnique({
    where: { id: userId },
    select: {
      name: true,
      notificationEmails: true,
      emailNotificationsEnabled: true,
    },
  })
  if (!user?.emailNotificationsEnabled) return

  const emails = parseNotificationEmails(user.notificationEmails)
  if (!emails.length) return

  await sendNotificationEmail({
    to: emails,
    subject: `[Voltrix ERP] ${input.title}`,
    title: input.title,
    message: input.message || "",
    link: input.link,
  })
}

export async function notifyUser(userId: string, input: CreateNotificationInput) {
  const notification = await prisma.erpNotification.create({
    data: {
      userId,
      title: input.title,
      message: input.message || "",
      type: input.type || "info",
      link: input.link || "",
    },
  })

  void sendEmailsForUser(userId, input)
  return notification
}

export async function notifyUsers(userIds: string[], input: CreateNotificationInput) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (!unique.length) return []

  const notifications = await Promise.all(
    unique.map(userId => notifyUser(userId, input)),
  )
  return notifications
}

export async function notifyUsersByModule(module: ErpModule, input: CreateNotificationInput) {
  const userIds = await getUserIdsByModule(module)
  return notifyUsers(userIds, input)
}

export async function notifySuperadmins(input: CreateNotificationInput) {
  const users = await prisma.erpUser.findMany({
    where: { role: "superadmin" },
    select: { id: true },
  })
  return notifyUsers(
    users.map(u => u.id),
    input,
  )
}

export async function notifyOnPoStatusChange(
  poId: string,
  poNumber: string | null | undefined,
  oldStatus: string | null | undefined,
  newStatus: string,
  createdBy?: string | null,
) {
  const label = poNumber || poId

  if (newStatus === "sent_to_admin" && oldStatus !== "sent_to_admin") {
    await notifyUsersByModule("dashboard", {
      title: "Purchase order awaiting approval",
      message: `PO ${label} has been submitted and needs admin review.`,
      type: "warning",
      link: "/dashboard",
    })
    await notifyUsersByModule("purchase", {
      title: "PO sent for admin approval",
      message: `PO ${label} is now pending admin approval.`,
      type: "info",
      link: "/purchase",
    })
  }

  if (newStatus === "approved" && oldStatus !== "approved") {
    if (createdBy) {
      const creator = await prisma.erpUser.findFirst({
        where: {
          OR: [{ name: createdBy }, { email: createdBy }],
        },
        select: { id: true },
      })
      if (creator) {
        await notifyUser(creator.id, {
          title: "Purchase order approved",
          message: `PO ${label} has been approved.`,
          type: "success",
          link: "/purchase",
        })
      }
    }
  }

  if (newStatus === "rejected" && oldStatus !== "rejected") {
    if (createdBy) {
      const creator = await prisma.erpUser.findFirst({
        where: {
          OR: [{ name: createdBy }, { email: createdBy }],
        },
        select: { id: true },
      })
      if (creator) {
        await notifyUser(creator.id, {
          title: "Purchase order rejected",
          message: `PO ${label} was rejected.`,
          type: "error",
          link: "/purchase",
        })
      }
    }
  }

  if (newStatus === "pending_finance_record" && oldStatus !== "pending_finance_record") {
    await notifyUsersByModule("finance", {
      title: "Purchase awaiting finance record",
      message: `PO ${label} has been sent for finance record.`,
      type: "info",
      link: "/finance",
    })
  }

  if (newStatus === "finance_recorded" && oldStatus !== "finance_recorded") {
    if (createdBy) {
      const creator = await prisma.erpUser.findFirst({
        where: {
          OR: [{ name: createdBy }, { email: createdBy }],
        },
        select: { id: true },
      })
      if (creator) {
        await notifyUser(creator.id, {
          title: "Purchase recorded in finance",
          message: `PO ${label} has been accepted as a finance record.`,
          type: "success",
          link: "/purchase",
        })
      }
    }
  }
}

export async function notifyOnOrderStatusChange(
  orderId: string,
  orderNumber: string,
  clientName: string,
  oldStatus: string | null | undefined,
  newStatus: string,
  ownerUserId?: string | null,
) {
  if (newStatus === "pending_approval" && oldStatus !== "pending_approval") {
    await notifyUsersByModule("dashboard", {
      title: "Client order awaiting approval",
      message: `Order ${orderNumber} for ${clientName} needs approval.`,
      type: "warning",
      link: "/dashboard",
    })
    if (ownerUserId) {
      await notifyUser(ownerUserId, {
        title: "Order submitted for approval",
        message: `Your order ${orderNumber} for ${clientName} is pending admin approval.`,
        type: "info",
        link: "/crm",
      })
    }
  }

  if (newStatus === "approved" && oldStatus !== "approved" && ownerUserId) {
    await notifyUser(ownerUserId, {
      title: "Order approved",
      message: `Order ${orderNumber} for ${clientName} has been approved.`,
      type: "success",
      link: "/crm",
    })
  }

  if (newStatus === "rejected" && oldStatus !== "rejected" && ownerUserId) {
    await notifyUser(ownerUserId, {
      title: "Order rejected",
      message: `Order ${orderNumber} for ${clientName} was rejected.`,
      type: "error",
      link: "/crm",
    })
  }
}

export async function notifyOnBranchTransferRequest(
  requestId: string,
  summary: string,
  requestedBy: string,
) {
  await notifyUsersByModule("dashboard", {
    title: "Branch transfer awaiting approval",
    message: `${summary} — requested by ${requestedBy}.`,
    type: "warning",
    link: "/dashboard",
  })
  await notifyUsersByModule("inventory", {
    title: "Branch transfer pending",
    message: `${summary} — requested by ${requestedBy}.`,
    type: "info",
    link: "/inventory",
  })
}

export async function notifyOnBranchTransferReviewed(
  summary: string,
  approved: boolean,
  requestedBy: string,
) {
  const requester = await prisma.erpUser.findFirst({
    where: {
      OR: [{ name: requestedBy }, { email: requestedBy }],
    },
    select: { id: true },
  })
  if (!requester) return

  await notifyUser(requester.id, {
    title: approved ? "Branch transfer approved" : "Branch transfer rejected",
    message: `${summary} was ${approved ? "approved" : "rejected"}.`,
    type: approved ? "success" : "error",
    link: "/inventory",
  })
}

export async function notifyOnPettyCashPending(
  employeeName: string,
  amount: number,
  purpose: string,
  type: "allocation" | "receipt",
) {
  const label = type === "allocation" ? "Petty cash allocation" : "Petty cash receipt"
  await notifyUsersByModule("dashboard", {
    title: `${label} awaiting approval`,
    message: `${employeeName} — Rs ${amount.toLocaleString()} for ${purpose}.`,
    type: "warning",
    link: "/dashboard",
  })
  await notifyUsersByModule("finance", {
    title: `${label} pending review`,
    message: `${employeeName} — Rs ${amount.toLocaleString()} for ${purpose}.`,
    type: "info",
    link: "/finance",
  })
}

export async function notifyOnPettyCashReviewed(
  employeeId: string,
  approved: boolean,
  type: "allocation" | "receipt",
) {
  await notifyUser(employeeId, {
    title: approved
      ? `${type === "allocation" ? "Allocation" : "Receipt"} approved`
      : `${type === "allocation" ? "Allocation" : "Receipt"} rejected`,
    message: approved
      ? `Your petty cash ${type} has been approved.`
      : `Your petty cash ${type} was rejected.`,
    type: approved ? "success" : "error",
    link: "/petty-cash",
  })
}

export async function notifyOnTicketCreated(
  ticketNumber: string,
  subject: string,
  createdBy: string,
) {
  await notifyUsersByModule("tickets", {
    title: "New support ticket",
    message: `${ticketNumber}: ${subject} — created by ${createdBy}.`,
    type: "info",
    link: "/tickets",
  })
}

export async function notifyOnTicketAssigned(
  assignedToUserId: string,
  ticketNumber: string,
  subject: string,
) {
  await notifyUser(assignedToUserId, {
    title: "Ticket assigned to you",
    message: `${ticketNumber}: ${subject}`,
    type: "info",
    link: "/tickets",
  })
}

export async function notifyOnClientPendingApproval(
  clientName: string,
  ownerUserId: string,
) {
  await notifyUsersByModule("dashboard", {
    title: "New client awaiting approval",
    message: `Client "${clientName}" was submitted by a sales agent and needs approval.`,
    type: "warning",
    link: "/crm",
  })
  await notifyUser(ownerUserId, {
    title: "Client submitted for approval",
    message: `Your client "${clientName}" is pending admin approval.`,
    type: "info",
    link: "/crm",
  })
}
