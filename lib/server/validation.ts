import { z } from 'zod'
import { ApiError } from '@/lib/server/api-error'

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((i) => i.message).join('; ')
      throw new ApiError(400, `Validation error: ${messages}`, 'VALIDATION_ERROR')
    }
    throw new ApiError(400, 'Invalid request body', 'INVALID_BODY')
  }
}

export async function parseSearchParams<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  try {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((i) => i.message).join('; ')
      throw new ApiError(400, `Validation error: ${messages}`, 'VALIDATION_ERROR')
    }
    throw new ApiError(400, 'Invalid query parameters', 'INVALID_PARAMS')
  }
}
