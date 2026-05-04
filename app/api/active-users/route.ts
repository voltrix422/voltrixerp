import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for active users (in production, use Redis or database)
const activeUsers = new Map<string, {
  lastSeen: number
  userAgent?: string
  ip?: string
}>()

// Cleanup inactive users (older than 5 minutes)
function cleanupInactiveUsers() {
  const now = Date.now()
  const timeout = 5 * 60 * 1000 // 5 minutes
  
  for (const [sessionId, data] of activeUsers.entries()) {
    if (now - data.lastSeen > timeout) {
      activeUsers.delete(sessionId)
    }
  }
}

// GET: Retrieve current active user count
export async function GET() {
  cleanupInactiveUsers()
  
  return NextResponse.json({
    count: activeUsers.size,
    active: true
  })
}

// POST: Register/update user activity
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session-id')?.value || 
                    request.headers.get('x-session-id') ||
                    `${Date.now()}-${Math.random()}`
    
    const userAgent = request.headers.get('user-agent') || undefined
    const ip = request.headers.get('x-forwarded-for') || 
              request.headers.get('x-real-ip') || 
              'unknown'
    
    activeUsers.set(sessionId, {
      lastSeen: Date.now(),
      userAgent,
      ip
    })
    
    cleanupInactiveUsers()
    
    return NextResponse.json({
      count: activeUsers.size,
      sessionId,
      active: true
    })
  } catch (error) {
    console.error('Error tracking active user:', error)
    return NextResponse.json(
      { error: 'Failed to track user activity', active: false },
      { status: 500 }
    )
  }
}

// DELETE: Remove user from active list
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session-id')?.value || 
                    request.headers.get('x-session-id')
    
    if (sessionId && activeUsers.has(sessionId)) {
      activeUsers.delete(sessionId)
    }
    
    return NextResponse.json({
      count: activeUsers.size,
      active: true
    })
  } catch (error) {
    console.error('Error removing active user:', error)
    return NextResponse.json(
      { error: 'Failed to remove user', active: false },
      { status: 500 }
    )
  }
}
