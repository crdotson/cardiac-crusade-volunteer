# User Sign Up Feature Design

## Overview
Enable self-registration on the Cardiac Crusade Volunteer web application. Users can sign up directly from the login screen, choose a password, add a WebAuthn passkey (or both), receive the `Volunteer` role, and be automatically assigned to roll up to the active City Coordinator (falling back to Application Administrator if no City Coordinator is configured).

## Architecture & Endpoints

### 1. Backend Route: `POST /api/signup`
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "optionalPasswordOrEmpty"
  }
  ```
- **Validation**:
  - `email` must be present and valid format.
  - Check `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`. Return `400 Bad Request` if email is already in use.
  - If `password` is provided, must be at least 8 characters. Hash using `bcrypt.hash(password, 10)`. If empty/null (passkey-only registration), store `password_hash = NULL`.
- **Role & Hierarchy Assignment**:
  - `role`: strictly `'Volunteer'`.
  - `roll_up_to_id`:
    - Query `SELECT id FROM users WHERE role = 'City Coordinator' ORDER BY id ASC LIMIT 1`.
    - If found, assign this ID.
    - If not found, fall back to `SELECT id FROM users WHERE role = 'Application Administrator' ORDER BY id ASC LIMIT 1`.
- **User Creation**:
  - `INSERT INTO users (email, name, password_hash, role, roll_up_to_id) VALUES (...) RETURNING id, email, name, role`.
- **Session Issuance**:
  - Generate JWT token with `{ id, email, role }` signed with `JWT_SECRET` (24h expiry).
  - Set `token` cookie with `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`.
  - Return `{ success: true, user: { id, email, name, role } }`.

### 2. Passkey Integration: `POST /api/auth/fido2/register-options` & `register-verify`
- Once the user record is created and the session cookie is set via `POST /api/signup`:
  - When the user chooses "Create Passkey", the frontend requests registration options via `api/auth/fido2/register-options` passing `email`.
  - The browser prompts WebAuthn credential generation (`startRegistration({ optionsJSON })`).
  - The frontend sends verification payload to `api/auth/fido2/register-verify`.
  - Credential is saved into the user's `fido2_credentials` array.

### 3. Frontend Architecture
- **Route**: Add `<Route path="/signup" element={<Signup />} />` in `App.tsx`.
- **Login Screen (`Login.tsx`)**:
  - Add link below the login actions: `"Don't have an account? Sign Up"`.
- **Sign Up Page (`Signup.tsx`)**:
  - **Step 1 (User Information & Password)**:
    - Input: Full Name.
    - Input: Email address.
    - Input: Password (with password toggle / minLength=8).
    - Input: Confirm Password.
    - Option / Toggle: "Sign up with Passkey only (no password)" for users who do not want a password.
    - "Sign Up" button triggers `POST /api/signup`.
  - **Step 2 (Passkey Prompt)**:
    - Prompt card displayed immediately after successful account creation:
      - Title: "Enable Passkey"
      - Description: "Would you like to create a passkey for faster and more secure sign-ins with Face ID, Touch ID, or your device lock?"
      - [Create Passkey] button: Calls WebAuthn `startRegistration` -> `register-verify` -> calls `checkAuth()` -> redirects to `/map`.
      - [Skip for Now] button: Calls `checkAuth()` -> redirects to `/map`.
    - Handles any WebAuthn cancellation gracefully without failing the account creation.

## Error Handling & Security
- Duplicate email returns friendly message: `"An account with this email already exists. Please log in."`.
- Passwords must be at least 8 characters if provided.
- If passkey creation fails or is cancelled by the user during Step 2, the user is offered a "Try Again" or "Skip to Dashboard" action so they are not blocked.
