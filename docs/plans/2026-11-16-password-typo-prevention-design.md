# Design: Password Settings - Typo Prevention Assistance

## Overview
Address GitHub [Issue #8](https://github.com/crdotson/cardiac-crusade-volunteer/issues/8): "Password Settings - Typo prevention assistance".
Currently, on the Settings page, changing passwords only provides "Current Password" and "New Password" fields without visibility toggles or a confirmation field.

This design introduces both password visibility toggles (`Eye` / `EyeOff` from `lucide-react`) and a "Confirm New Password" field with matching validation and password manager autocomplete support.

## UI & Layout
In `client/src/pages/Settings.tsx`:
- Render 3 password input fields in the Security card:
  1. **Current Password**
  2. **New Password**
  3. **Confirm New Password**
- Each input is wrapped in a container that includes an inline toggle button on the right side.
- Toggling the button flips the input's `type` between `"password"` and `"text"`.
- Uses `Eye` and `EyeOff` icons from `lucide-react`.
- Individual visibility states:
  - `showCurrentPassword` (boolean, defaults to `false`)
  - `showNewPassword` (boolean, defaults to `false`)
  - `showConfirmPassword` (boolean, defaults to `false`)
- Toggle buttons include `type="button"`, `tabIndex={-1}`, and descriptive `aria-label`s to prevent unintended form submissions and maintain accessibility.

## Password Manager Compatibility
To ensure password managers (1Password, Bitwarden, Apple Keychain, Google Password Manager) detect the update accurately without conflicts:
- Current Password:
  - `id="current-password"`, `name="current-password"`, `autoComplete="current-password"`
- New Password:
  - `id="new-password"`, `name="new-password"`, `autoComplete="new-password"`
- Confirm New Password:
  - `id="confirm-new-password"`, `name="confirm-new-password"`, `autoComplete="new-password"`

## Form Validation & Data Flow
1. **Validation on Submit (`handleChangePassword`):**
   - Check `newPassword.length >= 8`: If less than 8, set error to `"Password must be at least 8 characters long"` and return.
   - Check `newPassword === confirmPassword`: If mismatched, set error to `"New passwords do not match"` and return.
2. **API Call:**
   - Call `POST api/settings/change-password` with `{ currentPassword, newPassword }`.
3. **Success Handling:**
   - Display success message (`"Password updated successfully"`).
   - Clear form fields (`setCurrentPassword('')`, `setNewPassword('')`, `setConfirmPassword('')`).
   - Reset visibility states (`setShowCurrentPassword(false)`, `setShowNewPassword(false)`, `setShowConfirmPassword(false)`).

## Verification Plan
1. Execute `npm run build --prefix client` to verify no compilation or TypeScript errors.
2. Verify visual rendering and interaction:
   - Clicking visibility toggles shows and masks text.
   - Submitting mismatched passwords stops submission and presents the error message.
   - Submitting matching passwords sends the request and clears fields.
