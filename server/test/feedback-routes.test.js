import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  buildSmtpTransportConfig,
  DEFAULT_SMTP_FROM,
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  validateFeedbackMessage,
} from '../feedback-helpers.js';
import { createFeedbackRouter } from '../feedback-routes.js';

describe('Feedback Helpers', () => {
  test('validateFeedbackMessage rejects missing or blank messages', () => {
    assert.throws(() => validateFeedbackMessage(''), /Feedback message is required/);
    assert.throws(() => validateFeedbackMessage('   \n  '), /Feedback message is required/);
    assert.throws(() => validateFeedbackMessage(null), /Feedback message is required/);
  });

  test('validateFeedbackMessage trims valid messages', () => {
    assert.equal(validateFeedbackMessage('  Great app!  '), 'Great app!');
  });

  test('buildSmtpTransportConfig defaults to 192.168.205.12:25 without auth', () => {
    const { transportOptions, from } = buildSmtpTransportConfig({});
    assert.equal(transportOptions.host, DEFAULT_SMTP_HOST);
    assert.equal(transportOptions.port, DEFAULT_SMTP_PORT);
    assert.equal(transportOptions.secure, false);
    assert.equal(transportOptions.auth, undefined);
    assert.equal(from, DEFAULT_SMTP_FROM);
  });

  test('buildSmtpTransportConfig applies custom host, port 465 secure, and auth', () => {
    const { transportOptions, from } = buildSmtpTransportConfig({
      smtp_host: 'smtp.example.org',
      smtp_port: '465',
      smtp_from: 'alerts@example.org',
      smtp_user: 'mailer',
      smtp_pass: 'secret',
    });
    assert.equal(transportOptions.host, 'smtp.example.org');
    assert.equal(transportOptions.port, 465);
    assert.equal(transportOptions.secure, true);
    assert.deepEqual(transportOptions.auth, { user: 'mailer', pass: 'secret' });
    assert.equal(from, 'alerts@example.org');
  });
});

describe('Feedback Routes', () => {
  let users = [];
  let settings = [];
  let feedbackRows = [];
  let sentMails = [];
  let transportConfigs = [];
  let shouldFailMail = false;
  let activeUserId = 1;
  let server;
  let base;

  const pool = {
    async query(sql, params = []) {
      if (sql.startsWith('SELECT id, email, name, role FROM users WHERE id = $1')) {
        const user = users.find((u) => u.id === params[0]);
        return { rows: user ? [user] : [] };
      }
      if (sql.startsWith("SELECT email FROM users WHERE role = 'Application Administrator'")) {
        return {
          rows: users
            .filter((u) => u.role === 'Application Administrator' && u.email)
            .map((u) => ({ email: u.email })),
        };
      }
      if (sql.startsWith('SELECT key, value FROM settings WHERE key IN')) {
        return { rows: settings };
      }
      if (sql.startsWith('INSERT INTO feedback')) {
        const row = {
          id: feedbackRows.length + 1,
          user_id: params[0],
          user_email: params[1],
          user_name: params[2],
          message: params[3],
          status: 'New',
          email_sent: false,
          email_error: null,
          created_at: new Date().toISOString(),
        };
        feedbackRows.push(row);
        return { rows: [row] };
      }
      if (sql.startsWith('UPDATE feedback SET email_sent = $1, email_error = $2 WHERE id = $3')) {
        const row = feedbackRows.find((f) => f.id === params[2]);
        if (!row) return { rows: [] };
        row.email_sent = params[0];
        row.email_error = params[1];
        return { rows: [row] };
      }
      if (sql.startsWith('SELECT * FROM feedback ORDER BY created_at DESC')) {
        return { rows: [...feedbackRows].reverse() };
      }
      if (sql.startsWith('SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC')) {
        return { rows: feedbackRows.filter((f) => f.user_id === params[0]).reverse() };
      }
      if (sql.startsWith('UPDATE feedback SET status = $1 WHERE id = $2')) {
        const row = feedbackRows.find((f) => f.id === Number(params[1]));
        if (!row) return { rows: [] };
        row.status = params[0];
        return { rows: [row] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  before(async () => {
    users = [
      { id: 1, email: 'volunteer@example.com', name: 'Jane Volunteer', role: 'Volunteer' },
      { id: 2, email: 'other@example.com', name: 'Bob Volunteer', role: 'Volunteer' },
      { id: 3, email: 'admin@example.com', name: 'Admin User', role: 'Application Administrator' },
    ];
    settings = [
      { key: 'smtp_host', value: '192.168.205.12' },
      { key: 'smtp_port', value: '25' },
      { key: 'smtp_from', value: 'noreply@cardiaccrusade.org' },
      { key: 'smtp_user', value: '' },
      { key: 'smtp_pass', value: '' },
    ];

    const app = express();
    app.use(express.json());
    const authenticateToken = (req, _res, next) => {
      const user = users.find((u) => u.id === activeUserId);
      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    };
    const authorizeRoles = (...roles) => (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      next();
    };
    const createTransport = (opts) => {
      transportConfigs.push(opts);
      return {
        async sendMail(mail) {
          if (shouldFailMail) {
            throw new Error('ECONNREFUSED 192.168.205.12:25');
          }
          sentMails.push(mail);
        },
      };
    };

    app.use(createFeedbackRouter({ pool, authenticateToken, authorizeRoles, createTransport }));
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  test('rejects empty feedback submission', async () => {
    activeUserId = 1;
    const res = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    assert.equal(res.status, 400);
  });

  test('saves feedback and emails Application Administrator using configured SMTP server', async () => {
    activeUserId = 1;
    shouldFailMail = false;
    sentMails = [];
    transportConfigs = [];

    const res = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Map zoom resets when claiming squares.' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.feedback.email_sent, true);
    assert.equal(body.feedback.email_error, null);
    assert.equal(transportConfigs[0].host, '192.168.205.12');
    assert.equal(transportConfigs[0].port, 25);
    assert.equal(sentMails.length, 1);
    assert.equal(sentMails[0].to, 'admin@example.com');
    assert.match(sentMails[0].text, /Map zoom resets when claiming squares\./);
  });

  test('still logs feedback when SMTP delivery fails', async () => {
    activeUserId = 2;
    shouldFailMail = true;

    const res = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Offline relay test feedback' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.feedback.email_sent, false);
    assert.match(body.feedback.email_error, /ECONNREFUSED/);
  });

  test('GET /api/feedback returns only own feedback for non-admin and all feedback for admin', async () => {
    activeUserId = 1;
    const volRes = await fetch(`${base}/api/feedback`);
    assert.equal(volRes.status, 200);
    const volList = await volRes.json();
    assert.equal(volList.length, 1);
    assert.equal(volList[0].user_id, 1);

    activeUserId = 3;
    const adminRes = await fetch(`${base}/api/feedback`);
    assert.equal(adminRes.status, 200);
    const adminList = await adminRes.json();
    assert.equal(adminList.length, 2);
  });

  test('PATCH /api/feedback/:id enforces admin role and updates status', async () => {
    activeUserId = 1;
    const forbiddenRes = await fetch(`${base}/api/feedback/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Reviewed' }),
    });
    assert.equal(forbiddenRes.status, 403);

    activeUserId = 3;
    const okRes = await fetch(`${base}/api/feedback/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Reviewed' }),
    });
    assert.equal(okRes.status, 200);
    const updated = await okRes.json();
    assert.equal(updated.status, 'Reviewed');
  });
});
