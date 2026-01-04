import { ErrorCodes, createAppError } from '../errors';

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Accept various formats, normalize to digits only
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 11;
}

export function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

export function formatPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `(${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  return phone;
}

export function validateRequired(value: string | null | undefined, fieldName: string) {
  if (!value || value.trim() === '') {
    throw createAppError(
      ErrorCodes.DATA_REQUIRED_FIELD,
      `${fieldName} is required`,
      `Please enter your ${fieldName.toLowerCase()}`,
      { field: fieldName }
    );
  }
}

export function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}
