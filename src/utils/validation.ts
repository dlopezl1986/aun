const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

/** Usernames for device-only accounts: 3–30 chars, lowercase letters, digits, dot, dash, underscore. */
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value.trim().toLowerCase());
}

/** Email, or username when the auth backend allows it (local mode). */
export function isValidLogin(value: string, allowUsername: boolean): boolean {
  return value.includes('@') ? isValidEmail(value) : allowUsername && isValidUsername(value);
}
