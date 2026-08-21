export const passwordPolicyMinLength = 12;

export const passwordPolicyPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}';

export const passwordPolicyMessage =
  'Password must contain at least 12 characters, including at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (for example: ! @ # $ %).';

export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= passwordPolicyMinLength &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function normalizePasswordPolicyError(message: string | undefined): string | undefined {
  if (!message) return message;

  const normalized = message.toLowerCase();
  if (
    normalized.includes('password should contain at least one character of each') ||
    normalized.includes('password should be at least') ||
    normalized.includes('password must contain at least')
  ) {
    return passwordPolicyMessage;
  }

  return message;
}
