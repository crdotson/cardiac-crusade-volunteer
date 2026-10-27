# User Sign-in & Creation Tracking Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Record user creation dates and last login timestamps in PostgreSQL, and display them in the User Management UI.

**Architecture:** Database schema migration in `server/index.js` `initDB()`, update `last_login` during password and WebAuthn/FIDO2 verification endpoints, expose `last_login` and `created_at` in `GET /api/users`, and render human-readable timestamps in `client/src/pages/Users.tsx`.

**Tech Stack:** Node.js, Express, PostgreSQL (`pg`), React, TypeScript, Vite.

---

### Task 1: Database Migration & Schema Updates in Backend

**Files:**
- Modify: `server/index.js:58-80`

**Step 1: Write migration SQL in `initDB()`**
- Add `last_login TIMESTAMP WITH TIME ZONE` and `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` to `CREATE TABLE IF NOT EXISTS users`.
- Add idempotent migration block:
```sql
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
```

**Step 2: Update Login Endpoints & `GET /api/users`**
- In `mainRouter.post('/api/login')`:
  After password matches, run:
  `await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);`
- In `mainRouter.post('/api/auth/fido2/login-verify')`:
  Include `last_login = CURRENT_TIMESTAMP` in the credential counter update query:
  `await pool.query('UPDATE users SET fido2_credentials = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(updatedCredentials), user.id]);`
- In `mainRouter.get('/api/users')`:
  Update `SELECT` queries for all 3 roles to include `u.last_login, u.created_at`.

---

### Task 2: Frontend User Hierarchy Table & Formatting

**Files:**
- Modify: `client/src/pages/Users.tsx`

**Step 1: Update `interface User`**
Add `last_login: string | null; created_at: string | null;`.

**Step 2: Add `formatDateTime` helper**
Format ISO date strings to human-readable strings like `Oct 26, 2026, 10:14 PM` using `Intl.DateTimeFormat` or `Date.toLocaleString()`, handling null/undefined with `"Never"`.

**Step 3: Update Table Headers and Rows**
Add "Created" and "Last Login" columns in the `User Hierarchy` table.

---

### Task 3: Verification & Project Notes

**Files:**
- Modify: `GEMINI.md`
- Run: `npm run build` in `client/`
- Test: Local backend / client verification
