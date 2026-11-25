# Feedback Log & Configurable Email Notification Design

**Issue:** https://github.com/crdotson/cardiac-crusade-volunteer/issues/7  
**Date:** 2026-11-25

## Overview
Add an internal feedback log and configurable SMTP email notification system so any authenticated user can submit feedback from a dedicated `/feedback` page (accessed via a `?` icon next to the `⚙️` Settings icon in the navbar). Submitted feedback is persisted in PostgreSQL and emailed to all `Application Administrator` users via a configurable SMTP server defaulting to `192.168.205.12:25`.

## Architecture & Data Flow

### 1. Database Schema (`server/index.js` `initDB`)
- **`feedback` table**:
  - `id SERIAL PRIMARY KEY`
  - `user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`
  - `user_email VARCHAR(255) NOT NULL`
  - `user_name VARCHAR(255)`
  - `message TEXT NOT NULL`
  - `status VARCHAR(50) DEFAULT 'New'`
  - `email_sent BOOLEAN DEFAULT FALSE`
  - `email_error TEXT`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- **Default `settings` keys**:
  - `smtp_host`: `'192.168.205.12'`
  - `smtp_port`: `'25'`
  - `smtp_from`: `'noreply@cardiaccrusade.org'`
  - `smtp_user`: `''`
  - `smtp_pass`: `''`

### 2. Backend (`server/feedback-helpers.js`, `server/feedback-routes.js`, `server/index.js`)
- `GET /api/feedback` (authenticated):
  - `Application Administrator` receives all feedback rows ordered by `created_at DESC`.
  - Other roles receive only their own rows (`user_id = req.user.id`) ordered by `created_at DESC`.
- `POST /api/feedback` (authenticated):
  - Validates non-empty trimmed `message`.
  - Inserts feedback row into `feedback`.
  - Reads `smtp_*` settings and queries `users` for `role = 'Application Administrator'` emails.
  - Sends email via `nodemailer` (`host`, `port`, `secure: port === 465`, optional `auth` when `smtp_user` is provided, 5000ms connection timeout).
  - Updates `email_sent` and `email_error` on the `feedback` row; SMTP failure does not fail the HTTP request so feedback is never lost.
- `PATCH /api/feedback/:id` (Application Administrator only):
  - Updates `status` (`'New'` or `'Reviewed'`).
- `GET /api/settings`:
  - Filters out `smtp_*` keys for non-admin users so SMTP credentials are not exposed.

### 3. Frontend
- **`client/src/components/Navbar.tsx`**: Add a `?` (`HelpCircle`) icon link to `/feedback` next to the `⚙️` Settings link.
- **`client/src/pages/Feedback.tsx`** & **`client/src/App.tsx`**: Add `/feedback` private route with a free-form feedback textarea, submission handling, and feedback history (all entries + email delivery status + `New`/`Reviewed` toggle for `Application Administrator`; own submissions for other users).
- **`client/src/pages/Settings.tsx`**: Add SMTP configuration fields (`smtp_host`, `smtp_port`, `smtp_from`, `smtp_user`, `smtp_pass`) to the Admin Controls card.
