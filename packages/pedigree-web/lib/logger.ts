/**
 * Structured logger for the Pedigree web application.
 *
 * Wraps console methods with structured JSON output on the server side.
 * Replaces direct console.log usage which is forbidden in shipped code.
 */

/** Structured context attached to log entries. */
type LogContext = Record<string, unknown>

/**
 * Logs an informational message with optional structured context.
 *
 * @param message - Human-readable log message.
 * @param context - Structured key-value pairs for observability.
 */
function info(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'test') return
  // eslint-disable-next-line no-console -- reason: logger is the approved console wrapper
  console.info(JSON.stringify({ level: 'info', message, ...context }))
}

/**
 * Logs a warning message with optional structured context.
 *
 * @param message - Human-readable log message.
 * @param context - Structured key-value pairs for observability.
 */
function warn(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'test') return
  // eslint-disable-next-line no-console -- reason: logger is the approved console wrapper
  console.warn(JSON.stringify({ level: 'warn', message, ...context }))
}

/**
 * Logs an error message with optional structured context.
 *
 * @param message - Human-readable log message.
 * @param context - Structured key-value pairs for observability.
 */
function error(message: string, context?: LogContext): void {
  // eslint-disable-next-line no-console -- reason: logger is the approved console wrapper
  console.error(JSON.stringify({ level: 'error', message, ...context }))
}

/** Application logger -- the only approved way to log in shipped code. */
export const logger = { info, warn, error } as const
