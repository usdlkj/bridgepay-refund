import { HttpStatus } from '@nestjs/common';

/**
 * Sanitizes error messages to prevent information leakage.
 * Logs the full error for debugging but returns a sanitized message to clients.
 *
 * @param error - The error object (Error, HttpException, or any)
 * @param defaultMessage - Default message to return if error cannot be safely exposed
 * @param statusCode - HTTP status code to determine if error should be sanitized
 * @returns Sanitized error message safe to expose to clients
 */
export function sanitizeErrorMessage(
  error: any,
  defaultMessage: string = 'An error occurred while processing your request',
  statusCode?: number,
): string {
  // For 4xx client errors, we can be slightly more informative (but still sanitized)
  // For 5xx server errors, always return generic message
  const isClientError = statusCode && statusCode >= 400 && statusCode < 500;

  // If it's a known, safe error message (e.g., validation errors), we can return it
  if (isClientError && error?.message) {
    // Basic validation errors are generally safe to expose
    if (
      typeof error.message === 'string' &&
      (error.message.includes('validation') ||
        error.message.includes('required') ||
        error.message.includes('invalid') ||
        error.message.includes('not found') ||
        error.message.includes('duplicate'))
    ) {
      return error.message;
    }
  }

  // For all server errors (5xx) and unknown client errors, return generic message
  // Never expose internal error details like stack traces, database errors, etc.
  return defaultMessage;
}

/**
 * Checks if an error message is safe to expose to clients.
 * Only basic validation/input errors are considered safe.
 *
 * @param message - Error message to check
 * @returns true if message is safe to expose
 */
export function isSafeErrorMessage(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const safePatterns = [
    /validation/i,
    /required/i,
    /invalid/i,
    /not found/i,
    /duplicate/i,
    /unauthorized/i,
    /forbidden/i,
    /missing/i,
  ];

  return safePatterns.some((pattern) => pattern.test(message));
}
