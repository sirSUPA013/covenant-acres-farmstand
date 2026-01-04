/**
 * Error codes for troubleshooting
 * Format: CATEGORY-NUMBER
 *
 * Categories:
 * - ORD: Order-related errors
 * - SYNC: Sync/connectivity errors
 * - AUTH: Google auth errors
 * - DATA: Data validation errors
 * - CFG: Configuration errors
 * - NOTIF: Notification errors
 */

export const ErrorCodes = {
  // Order errors (ORD-1xx)
  ORD_NOT_FOUND: 'ORD-101',
  ORD_ALREADY_EXISTS: 'ORD-102',
  ORD_INVALID_STATUS: 'ORD-103',
  ORD_SLOT_CLOSED: 'ORD-104',
  ORD_FLAVOR_UNAVAILABLE: 'ORD-105',
  ORD_CAPACITY_EXCEEDED: 'ORD-106',
  ORD_CUTOFF_PASSED: 'ORD-107',
  ORD_MODIFICATION_DENIED: 'ORD-108',

  // Sync errors (SYNC-2xx)
  SYNC_OFFLINE: 'SYNC-201',
  SYNC_CONFLICT: 'SYNC-202',
  SYNC_SHEETS_ERROR: 'SYNC-203',
  SYNC_TIMEOUT: 'SYNC-204',
  SYNC_RATE_LIMITED: 'SYNC-205',

  // Auth errors (AUTH-3xx)
  AUTH_NOT_SIGNED_IN: 'AUTH-301',
  AUTH_TOKEN_EXPIRED: 'AUTH-302',
  AUTH_PERMISSION_DENIED: 'AUTH-303',
  AUTH_INVALID_CREDENTIALS: 'AUTH-304',

  // Data validation errors (DATA-4xx)
  DATA_INVALID_EMAIL: 'DATA-401',
  DATA_INVALID_PHONE: 'DATA-402',
  DATA_REQUIRED_FIELD: 'DATA-403',
  DATA_INVALID_DATE: 'DATA-404',
  DATA_INVALID_QUANTITY: 'DATA-405',

  // Configuration errors (CFG-5xx)
  CFG_MISSING_SHEETS_ID: 'CFG-501',
  CFG_INVALID_TEMPLATE: 'CFG-502',

  // Notification errors (NOTIF-6xx)
  NOTIF_EMAIL_FAILED: 'NOTIF-601',
  NOTIF_SMS_FAILED: 'NOTIF-602',
  NOTIF_TEMPLATE_ERROR: 'NOTIF-603',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  context?: Record<string, unknown>;
  timestamp: string;
  stack?: string;
}

export function createAppError(
  code: ErrorCode,
  message: string,
  userMessage: string,
  context?: Record<string, unknown>
): AppError {
  return {
    code,
    message,
    userMessage,
    context,
    timestamp: new Date().toISOString(),
  };
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.ORD_NOT_FOUND]: 'Order not found',
  [ErrorCodes.ORD_ALREADY_EXISTS]: 'Order already exists',
  [ErrorCodes.ORD_INVALID_STATUS]: 'Invalid order status transition',
  [ErrorCodes.ORD_SLOT_CLOSED]: 'This bake slot is no longer available',
  [ErrorCodes.ORD_FLAVOR_UNAVAILABLE]: 'This flavor is sold out for the selected date',
  [ErrorCodes.ORD_CAPACITY_EXCEEDED]: 'Not enough capacity for this order',
  [ErrorCodes.ORD_CUTOFF_PASSED]: 'The order cutoff time has passed',
  [ErrorCodes.ORD_MODIFICATION_DENIED]: 'This order cannot be modified',

  [ErrorCodes.SYNC_OFFLINE]: 'No internet connection. Changes saved locally.',
  [ErrorCodes.SYNC_CONFLICT]: 'Data was modified elsewhere. Refreshing...',
  [ErrorCodes.SYNC_SHEETS_ERROR]: 'Could not connect to Google Sheets',
  [ErrorCodes.SYNC_TIMEOUT]: 'Connection timed out. Please try again.',
  [ErrorCodes.SYNC_RATE_LIMITED]: 'Too many requests. Please wait a moment.',

  [ErrorCodes.AUTH_NOT_SIGNED_IN]: 'Please sign in to continue',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Session expired. Please sign in again.',
  [ErrorCodes.AUTH_PERMISSION_DENIED]: 'You do not have permission to access this',
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials',

  [ErrorCodes.DATA_INVALID_EMAIL]: 'Please enter a valid email address',
  [ErrorCodes.DATA_INVALID_PHONE]: 'Please enter a valid phone number',
  [ErrorCodes.DATA_REQUIRED_FIELD]: 'This field is required',
  [ErrorCodes.DATA_INVALID_DATE]: 'Please enter a valid date',
  [ErrorCodes.DATA_INVALID_QUANTITY]: 'Quantity must be at least 1',

  [ErrorCodes.CFG_MISSING_SHEETS_ID]: 'Google Sheets ID not configured',
  [ErrorCodes.CFG_INVALID_TEMPLATE]: 'Invalid notification template',

  [ErrorCodes.NOTIF_EMAIL_FAILED]: 'Failed to send email notification',
  [ErrorCodes.NOTIF_SMS_FAILED]: 'Failed to send SMS notification',
  [ErrorCodes.NOTIF_TEMPLATE_ERROR]: 'Error processing notification template',
};
