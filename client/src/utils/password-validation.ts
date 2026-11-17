export interface PasswordValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validatePasswordChange(
  currentPassword?: string,
  newPassword?: string,
  confirmPassword?: string
): PasswordValidationResult {
  if (!currentPassword || !currentPassword.trim()) {
    return { isValid: false, error: 'Current password is required' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  if (newPassword !== confirmPassword) {
    return { isValid: false, error: 'New passwords do not match' };
  }
  return { isValid: true, error: null };
}
