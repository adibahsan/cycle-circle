import { logger } from './log'

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiError(
  statusCode: number,
  message: string,
  code?: string,
): Response {
  return Response.json({ error: { message, code } }, { status: statusCode })
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    // 4xx are expected outcomes (bad input, wrong OTP); 5xx/502s are worth an error line.
    if (error.statusCode >= 500) logger.error('api.error', error)
    return apiError(error.statusCode, error.message, error.code)
  }
  logger.error('api.unhandled', error)
  return apiError(500, 'Internal server error')
}
