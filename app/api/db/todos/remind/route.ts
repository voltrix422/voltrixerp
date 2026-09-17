import { NextResponse } from "next/server"
import { processTodoRecurrenceAndReminders } from "@/lib/todo-reminders"

export async function POST() {
  try {
    const result = await processTodoRecurrenceAndReminders()
    return NextResponse.json(result)
  } catch (err) {
    console.error("[todos/remind]", err)
    return NextResponse.json({ error: "Remind failed" }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
