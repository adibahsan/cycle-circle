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
    return apiError(error.statusCode, error.message, error.code)
  }
  console.error('Unhandled error:', error)
  return apiError(500, 'Internal server error')
}
