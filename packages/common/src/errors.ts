export const ErrorCodes = {
  MISSING_API_KEY: { code: 'E001', httpStatus: 401, message: 'Missing API key' },
  INVALID_API_KEY: { code: 'E002', httpStatus: 401, message: 'Invalid API key' },
  KEY_EXPIRED:     { code: 'E003', httpStatus: 401, message: 'API key expired' },
  UNAUTHORIZED:    { code: 'E004', httpStatus: 401, message: 'Unauthorized' },
  CHAIN_NOT_SUPPORTED: { code: 'E005', httpStatus: 400, message: 'Chain not supported' },
  INVALID_REQUEST: { code: 'E006', httpStatus: 400, message: 'Invalid request' },
  USAGE_EXCEEDED:  { code: 'E007', httpStatus: 402, message: 'Usage limit exceeded for current plan' },
  SPONSOR_FAILED:  { code: 'E008', httpStatus: 500, message: 'Sponsorship failed' },
  STRIPE_NOT_CONFIGURED: { code: 'E009', httpStatus: 503, message: 'Stripe not configured' },
  WEBHOOK_NOT_CONFIGURED:{ code: 'E010', httpStatus: 503, message: 'Webhook not configured' },
  BILLING_ERROR:   { code: 'E011', httpStatus: 500, message: 'Billing error' },
  RATE_LIMITED:    { code: 'E012', httpStatus: 429, message: 'Too many requests' },
  FORBIDDEN:       { code: 'E013', httpStatus: 403, message: 'Forbidden' },
  IDEMPOTENCY_CONFLICT: { code: 'E014', httpStatus: 409, message: 'Idempotency key conflict' }
} as const

export type ErrorCodeKey = keyof typeof ErrorCodes
