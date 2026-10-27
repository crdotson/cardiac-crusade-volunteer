# Design Document: User Sign-in & Creation Tracking

## Overview
Track and display when users were created and when they last logged into the Cardiac Crusade application.

## Requirements
1. **Schema Migration:**
   - Add `last_login TIMESTAMP WITH TIME ZONE` (nullable) to the `users` table.
   - Add `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` to the `users` table.
   - Migrations must be idempotent so they run automatically and safely on application startup.

2. **Backend Authentication Tracking:**
   - On password login (`POST /api/login`), update `last_login = CURRENT_TIMESTAMP` for the authenticated user.
   - On passkey login (`POST /api/auth/fido2/login-verify`), update `last_login = CURRENT_TIMESTAMP` for the authenticated user.
   - In `GET /api/users`, include `last_login` and `created_at` in the query result for all supervisory roles (Application Administrator, City Coordinator, Volunteer leader).

3. **Frontend Display:**
   - In `client/src/pages/Users.tsx`, update `interface User` to include `last_login: string | null` and `created_at: string | null`.
   - Add formatted columns for "Created" and "Last Login" to the User Hierarchy table.
   - Display a human-friendly format (e.g., `Oct 26, 2026, 10:14 PM`), or `Never` if `last_login` is null.

## Error Handling & Backward Compatibility
- Existing user rows will have `last_login` as `null` until their next login, displaying as `"Never"`.
- Existing user rows will have `created_at` set to the timestamp when the migration runs (or `null` if pre-existing before default was populated).
- Any failed update on `last_login` should be logged without crashing the login flow if a transient DB error occurs.
