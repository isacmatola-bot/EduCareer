export const passwordPolicyPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}';

export const passwordPolicyMessage =
  'Password must contain at least 8 characters, including uppercase, lowercase, a number, and a special character.';

export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function normalizePasswordPolicyError(message: string | undefined): string | undefined {
  if (!message) return message;

  if (
    message.startsWith('Password should contain at least one character of each:') ||
    message.toLowerCase().includes('password should contain at least one character of each')
  ) {
    return passwordPolicyMessage;
  }

  return message;
}
