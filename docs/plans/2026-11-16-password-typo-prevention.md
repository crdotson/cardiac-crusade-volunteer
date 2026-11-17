# Password Typo Prevention Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Provide password typo prevention on the Settings page via show/hide visibility toggles and a Confirm New Password field with password manager autocomplete attributes.

**Architecture:** Implement client-side validation logic and test it using Node's test runner, update `client/src/pages/Settings.tsx` to include password visibility toggles (`Eye` / `EyeOff` from `lucide-react`), standard password manager attributes, and a confirm password field with matching checks.

**Tech Stack:** React 19, TypeScript, `lucide-react`, Vite, Node test runner (`node:test`).

---

### Task 1: Password Change Validation Helper & Unit Tests

**Files:**
- Create: `client/src/utils/password-validation.ts`
- Create: `client/src/utils/password-validation.test.js`

**Step 1: Write unit tests for password change validation**
Create `client/src/utils/password-validation.test.js` using Node's test runner:
```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordChange } from './password-validation.js';

describe('Password Change Validation', () => {
    test('requires current password', () => {
        const result = validatePasswordChange('', 'newPassword123', 'newPassword123');
        assert.equal(result.isValid, false);
        assert.equal(result.error, 'Current password is required');
    });

    test('enforces minimum length of 8 characters for new password', () => {
        const result = validatePasswordChange('curr1234', 'short', 'short');
        assert.equal(result.isValid, false);
        assert.equal(result.error, 'Password must be at least 8 characters long');
    });

    test('enforces matching confirmation password', () => {
        const result = validatePasswordChange('curr1234', 'newPassword123', 'differentPassword');
        assert.equal(result.isValid, false);
        assert.equal(result.error, 'New passwords do not match');
    });

    test('validates successfully when all constraints are met', () => {
        const result = validatePasswordChange('curr1234', 'newPassword123', 'newPassword123');
        assert.equal(result.isValid, true);
        assert.equal(result.error, null);
    });
});
```

**Step 2: Run test to verify it fails**
Run: `node --test client/src/utils/password-validation.test.js`
Expected: FAIL (module not found)

**Step 3: Implement `client/src/utils/password-validation.ts`**
```typescript
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
```

**Step 4: Run test to verify it passes**
Run: `node --test client/src/utils/password-validation.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/utils/password-validation.ts client/src/utils/password-validation.test.js
git commit -m "feat(client): add password change validation helper and tests"
```

---

### Task 2: Update Settings Page with Visibility Toggles, Confirm Password & Autocomplete Attributes

**Files:**
- Modify: `client/src/pages/Settings.tsx`
- Modify: `client/src/index.css` (if needed for password toggle positioning)

**Step 1: Update `client/src/pages/Settings.tsx`**
1. Import `Eye`, `EyeOff` from `'lucide-react'`.
2. Import `validatePasswordChange` from `'../utils/password-validation'`.
3. Add state:
   - `const [confirmPassword, setConfirmPassword] = useState('');`
   - `const [showCurrentPassword, setShowCurrentPassword] = useState(false);`
   - `const [showNewPassword, setShowNewPassword] = useState(false);`
   - `const [showConfirmPassword, setShowConfirmPassword] = useState(false);`
4. Update `handleChangePassword`:
   - Validate with `validatePasswordChange(currentPassword, newPassword, confirmPassword)`.
   - If invalid, set error and exit early.
   - On success, reset `confirmPassword`, `currentPassword`, `newPassword`, and all visibility toggle states (`false`).
5. Render password input fields in relative containers:
   - Current Password:
     - `id="current-password"`, `name="current-password"`, `autoComplete="current-password"`
     - `type={showCurrentPassword ? "text" : "password"}`
     - Toggle button with `Eye` / `EyeOff`
   - New Password:
     - `id="new-password"`, `name="new-password"`, `autoComplete="new-password"`
     - `type={showNewPassword ? "text" : "password"}`
     - Toggle button with `Eye` / `EyeOff`
   - Confirm New Password:
     - `id="confirm-new-password"`, `name="confirm-new-password"`, `autoComplete="new-password"`
     - `type={showConfirmPassword ? "text" : "password"}`
     - Toggle button with `Eye` / `EyeOff`

**Step 2: Verify Frontend Build**
Run: `npm run build --prefix client`
Expected: PASS with 0 TypeScript/build errors.

**Step 3: Commit**
```bash
git add client/src/pages/Settings.tsx client/src/index.css
git commit -m "feat(settings): add password visibility toggle and confirm password field (issue #8)"
```
