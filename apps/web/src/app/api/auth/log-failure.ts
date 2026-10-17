import { ApiError } from '@vesta/shared/server/api-error'
import { logger } from '@vesta/shared/server/log'

/**
 * Customer-channel line for a refused action (4xx). 5xx and unexpected errors are
 * logged to the error channel by handleApiError, so they are skipped here.
 */
export function logCustomerRefusal(event: string, error: unknown, data?: Record<string, unknown>): void {
  if (error instanceof ApiError && error.statusCode < 500) {
    logger.customer(
      event,
      { ...data, ok: false, status: error.statusCode, code: error.code, message: error.message },
      { level: 'warn' },
    )
  }
}
