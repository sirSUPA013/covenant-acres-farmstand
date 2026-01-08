/**
 * API Error Codes - See ERROR_CODES.md for documentation
 */

export const ERROR_CODES = {
  // Order errors
  ORD_GENERAL: 'ORD-001',
  ORD_CAPACITY: 'ORD-106',
  ORD_SLOT_CLOSED: 'ORD-SLOT_CLOSED',

  // Validation errors
  DATA_INVALID: 'DATA-403',

  // Sync errors (Google Sheets)
  SYNC_BAKE_SLOTS: 'SYNC-203',
  SYNC_FLAVORS: 'SYNC-204',

  // Location errors
  LOC_FETCH: 'LOC-001',

  // History errors
  HIST_FETCH: 'HIST-001',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Create a standardized error response object
 */
export function createErrorResponse(
  error: string,
  code: ErrorCode,
  details?: string
): { error: string; code: ErrorCode; details?: string } {
  const response: { error: string; code: ErrorCode; details?: string } = { error, code };
  if (details) {
    response.details = details;
  }
  return response;
}

/**
 * HTTP status codes for each error type
 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  [ERROR_CODES.ORD_GENERAL]: 500,
  [ERROR_CODES.ORD_CAPACITY]: 400,
  [ERROR_CODES.ORD_SLOT_CLOSED]: 400,
  [ERROR_CODES.DATA_INVALID]: 400,
  [ERROR_CODES.SYNC_BAKE_SLOTS]: 500,
  [ERROR_CODES.SYNC_FLAVORS]: 500,
  [ERROR_CODES.LOC_FETCH]: 500,
  [ERROR_CODES.HIST_FETCH]: 500,
};
