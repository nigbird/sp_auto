// Client-safe: shared by the set-password form and the API that enforces it.
export const MIN_PASSWORD_LENGTH = 8;

/** Returns a message describing what's wrong with the password, or null if it is acceptable. */
export function checkPasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return null;
}
