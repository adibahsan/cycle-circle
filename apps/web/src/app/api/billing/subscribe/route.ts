import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError, ApiError } from '@vesta/shared/server/api-error'

// CaaS direct-debit billing is parked: the phone login is the BDApps subscription
// (docs/adr/0002-phone-login-is-the-bdapps-subscription.md). The old charge flow
// lives in git history; this route refuses before any DB or BDApps call.
export const POST = withAuth(async () => {
  try {
    throw new ApiError(503, 'CaaS billing is not available.', 'CAAS_DISABLED')
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
