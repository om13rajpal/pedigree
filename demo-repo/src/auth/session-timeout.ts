/**
 * Session timeout management for authentication
 * Expires sessions after 30 minutes of inactivity
 */

export interface Session {
  id: string
  userId: string
  lastActivity: Date
  createdAt: Date
}

export interface SessionTimeoutConfig {
  timeoutMs: number
  checkIntervalMs?: number
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_CHECK_INTERVAL_MS = 60 * 1000 // 1 minute

/**
 * Checks if a session has expired based on inactivity timeout
 */
export function isSessionExpired(
  session: Session,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): boolean {
  const now = Date.now()
  const lastActivityTime = session.lastActivity.getTime()
  const inactivityDuration = now - lastActivityTime

  return inactivityDuration >= timeoutMs
}

/**
 * Updates the last activity timestamp for a session
 */
export function updateSessionActivity(session: Session): Session {
  return {
    ...session,
    lastActivity: new Date(),
  }
}

/**
 * Filters out expired sessions from a collection
 */
export function removeExpiredSessions(
  sessions: Session[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Session[] {
  return sessions.filter((session) => !isSessionExpired(session, timeoutMs))
}

/**
 * Session timeout manager class
 * Automatically cleans up expired sessions at regular intervals
 */
export class SessionTimeoutManager {
  private sessions: Map<string, Session>
  private config: Required<SessionTimeoutConfig>
  private cleanupInterval: ReturnType<typeof setInterval> | null

  constructor(config?: Partial<SessionTimeoutConfig>) {
    this.sessions = new Map()
    this.config = {
      timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      checkIntervalMs: config?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
    }
    this.cleanupInterval = null
  }

  /**
   * Starts the automatic cleanup process
   */
  start(): void {
    if (this.cleanupInterval) {
      return
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.checkIntervalMs)
  }

  /**
   * Stops the automatic cleanup process
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Adds or updates a session
   */
  setSession(session: Session): void {
    this.sessions.set(session.id, session)
  }

  /**
   * Retrieves a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return undefined
    }

    if (isSessionExpired(session, this.config.timeoutMs)) {
      this.sessions.delete(sessionId)
      return undefined
    }

    return session
  }

  /**
   * Updates session activity timestamp
   */
  touchSession(sessionId: string): boolean {
    const session = this.getSession(sessionId)

    if (!session) {
      return false
    }

    const updatedSession = updateSessionActivity(session)
    this.sessions.set(sessionId, updatedSession)
    return true
  }

  /**
   * Removes a session by ID
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  /**
   * Removes all expired sessions
   */
  cleanup(): number {
    let removedCount = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (isSessionExpired(session, this.config.timeoutMs)) {
        this.sessions.delete(sessionId)
        removedCount++
      }
    }

    return removedCount
  }

  /**
   * Gets the count of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }

  /**
   * Clears all sessions
   */
  clear(): void {
    this.sessions.clear()
  }
}

// Made with Bob
