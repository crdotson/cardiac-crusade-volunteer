# User Sign Up Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Enable self-registration on the login screen for volunteers with password, passkey, or both, rolling up to the City Coordinator.

**Architecture:** Add a `POST /api/signup` endpoint with automatic City Coordinator hierarchy resolution and JWT issuance, and a React `/signup` page with a two-step flow (account info & password -> optional passkey setup) linked from the login screen.

**Tech Stack:** React 19, TypeScript, Express, PostgreSQL, bcrypt, JWT, @simplewebauthn/browser & @simplewebauthn/server.

---

### Task 1: Backend Sign-Up Route & City Coordinator Hierarchy Resolution

**Files:**
- Modify: `server/index.js`
- Test: `server/test/signup-helper.test.js`

**Step 1: Write unit test for coordinator resolution and password handling**
Create `server/test/signup-helper.test.js` using Node's built-in test runner to verify:
- Logic for selecting coordinator ID: queries `role = 'City Coordinator'`, falls back to `role = 'Application Administrator'`, or null.
- Handling of signup payload: email validation, password hashing when provided vs null when passkey-only.

**Step 2: Run test to verify it fails**
Run: `node --test server/test/signup-helper.test.js`
Expected: FAIL (file or tested module not found)

**Step 3: Implement minimal code**
In `server/index.js`:
- Add `POST /api/signup`:
  1. Extract `{ email, name, password }` from `req.body`.
  2. Validate email presence and format.
  3. Check if email already exists in `users` (`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`). If so, return 400 with `'An account with this email already exists'`.
  4. Find coordinator ID:
     ```javascript
     let coordRes = await pool.query("SELECT id FROM users WHERE role = 'City Coordinator' ORDER BY id ASC LIMIT 1");
     let rollUpId = coordRes.rows[0]?.id;
     if (!rollUpId) {
         const adminRes = await pool.query("SELECT id FROM users WHERE role = 'Application Administrator' ORDER BY id ASC LIMIT 1");
         rollUpId = adminRes.rows[0]?.id || null;
     }
     ```
  5. If password provided, validate min length (8) and hash with `bcrypt.hash(password, 10)`. If empty/omitted, `password_hash = null`.
  6. Insert into `users`:
     ```javascript
     const userRes = await pool.query(
         'INSERT INTO users (email, name, password_hash, role, roll_up_to_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
         [email.trim().toLowerCase(), name ? name.trim() : null, hash, 'Volunteer', rollUpId]
     );
     ```
  7. Generate JWT token with `{ id: user.id, email: user.email, role: user.role }`, set httpOnly cookie `'token'`, and return `{ success: true, user: userRes.rows[0] }`.

**Step 4: Run tests & syntax check**
Run: `node --test server/test/signup-helper.test.js && node --check server/index.js`
Expected: PASS

**Step 5: Commit**
```bash
git add server/index.js server/test/signup-helper.test.js
git commit -m "feat(server): add /api/signup endpoint with coordinator hierarchy resolution"
```

---

### Task 2: Create React Sign Up Page (`/signup`) with Passkey Setup Prompt

**Files:**
- Create: `client/src/pages/Signup.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/Login.tsx`

**Step 1: Create `client/src/pages/Signup.tsx`**
Implement the component with 2 phases:
- **Phase 1: Registration Form**:
  - Full Name, Email, Password, Confirm Password.
  - Checkbox/toggle: "Sign up without password (Passkey only)".
  - Validation: passwords match, min 8 characters if provided.
  - Submits to `/api/signup`.
- **Phase 2: Passkey Prompt ("Faster and More Secure Sign-ins")**:
  - Rendered when Phase 1 succeeds.
  - Heading: "Set up a Passkey"
  - Subtext: "Would you like to create a passkey for faster and more secure sign-ins with Face ID, Touch ID, or your device lock?"
  - Button "Create Passkey": calls `POST api/auth/fido2/register-options`, `startRegistration`, `POST api/auth/fido2/register-verify`, then calls `checkAuth()` and `navigate('/map')`.
  - Button "Skip for Now": calls `checkAuth()` and `navigate('/map')`.
  - If WebAuthn fails or is cancelled, display an informative error and let the user retry or continue to dashboard.

**Step 2: Update `client/src/App.tsx`**
- Import `Signup` from `./pages/Signup`.
- Add public route `<Route path="/signup" element={<Signup />} />`.

**Step 3: Update `client/src/pages/Login.tsx`**
- Add a "Don't have an account? Sign Up" link at the bottom of the Login card.

**Step 4: Verify Frontend Build**
Run: `npm run build` in `client/`
Expected: PASS with 0 errors.

**Step 5: Commit**
```bash
git add client/src/pages/Signup.tsx client/src/pages/Login.tsx client/src/App.tsx
git commit -m "feat(client): implement signup page with passkey setup and login link"
```

---

### Task 3: End-to-End Verification & Documentation Update

**Files:**
- Modify: `GEMINI.md`
- Modify: `docs/plans/task.md`

**Step 1: Test Verification**
- Run `node --check server/index.js`
- Run `npm run build` in `client/`
- Run server unit tests `node --test server/test/signup-helper.test.js`

**Step 2: Update Project Log in `GEMINI.md`**
- Document the new `/api/signup` endpoint, passkey onboarding flow, and volunteer hierarchy auto-assignment.

**Step 3: Commit**
```bash
git add GEMINI.md docs/plans/task.md
git commit -m "docs: record signup feature implementation in GEMINI.md"
```
