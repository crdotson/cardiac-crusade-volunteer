import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { normalizeAndValidateEmail } from '../account-helpers.js';
import { createAccountRouter } from '../account-routes.js';

describe('Account Helpers', () => {
    test('normalizeAndValidateEmail rejects missing or invalid emails', () => {
        assert.throws(() => normalizeAndValidateEmail(''), /Email is required/);
        assert.throws(() => normalizeAndValidateEmail('   '), /Email is required/);
        assert.throws(() => normalizeAndValidateEmail(null), /Email is required/);
        assert.throws(() => normalizeAndValidateEmail('not-an-email'), /Invalid email address/);
    });

    test('normalizeAndValidateEmail trims and lowercases valid emails', () => {
        assert.equal(normalizeAndValidateEmail('  User@Example.COM '), 'user@example.com');
    });
});

describe('account change-email endpoint', () => {
    const secret = 'test-secret';
    let users = [];
    let otpRows = [];
    let server;
    let base;
    let activeUserId = 1;

    const pool = {
        async query(sql, params = []) {
            if (sql.startsWith('SELECT id, email, password_hash, role FROM users WHERE id = $1')) {
                const user = users.find(u => u.id === params[0]);
                return { rows: user ? [user] : [] };
            }
            if (sql.startsWith('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2')) {
                const found = users.filter(u => u.email.toLowerCase() === params[0] && u.id !== params[1]);
                return { rows: found };
            }
            if (sql.startsWith('UPDATE users SET email = $1 WHERE id = $2')) {
                const user = users.find(u => u.id === params[1]);
                if (!user) return { rows: [] };
                user.email = params[0];
                return { rows: [{ id: user.id, email: user.email, role: user.role }] };
            }
            if (sql.startsWith('DELETE FROM otp_storage WHERE LOWER(email) = LOWER($1)')) {
                otpRows = otpRows.filter(row => row.email.toLowerCase() !== params[0].toLowerCase());
                return { rows: [] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };

    before(async () => {
        const passwordHash = await bcrypt.hash('CorrectPass123!', 10);
        users = [
            { id: 1, email: 'old@example.com', password_hash: passwordHash, role: 'Volunteer' },
            { id: 2, email: 'taken@example.com', password_hash: passwordHash, role: 'Volunteer' },
            { id: 3, email: 'passkey@example.com', password_hash: null, role: 'Volunteer' },
        ];
        otpRows = [
            { email: 'old@example.com', otp_hash: 'hash' },
        ];

        const app = express();
        app.use(express.json());
        const authenticateToken = (req, _res, next) => {
            const user = users.find(u => u.id === activeUserId);
            req.user = { id: user.id, email: user.email, role: user.role };
            next();
        };
        app.use(createAccountRouter({ pool, jwtSecret: secret, authenticateToken }));
        server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        base = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => server.close());

    test('rejects invalid email address', async () => {
        activeUserId = 1;
        const res = await fetch(`${base}/api/settings/change-email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newEmail: 'invalid', currentPassword: 'CorrectPass123!' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.match(body.message, /Invalid email address/);
    });

    test('rejects incorrect current password for password-based account', async () => {
        activeUserId = 1;
        const res = await fetch(`${base}/api/settings/change-email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newEmail: 'new@example.com', currentPassword: 'WrongPassword' }),
        });
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.match(body.message, /Incorrect current password/);
    });

    test('rejects email already belonging to another user', async () => {
        activeUserId = 1;
        const res = await fetch(`${base}/api/settings/change-email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newEmail: 'TAKEN@example.com', currentPassword: 'CorrectPass123!' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.match(body.message, /already exists/);
    });

    test('updates email, clears old OTPs, and refreshes JWT cookie', async () => {
        activeUserId = 1;
        const res = await fetch(`${base}/api/settings/change-email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newEmail: '  NewEmail@Example.COM ', currentPassword: 'CorrectPass123!' }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.user.email, 'newemail@example.com');
        assert.equal(body.user.hasPassword, true);
        assert.equal(users[0].email, 'newemail@example.com');
        assert.equal(otpRows.length, 0);

        const setCookie = res.headers.get('set-cookie');
        assert.ok(setCookie && setCookie.includes('token='));
        const tokenMatch = setCookie.match(/token=([^;]+)/);
        const decoded = jwt.verify(tokenMatch[1], secret);
        assert.equal(decoded.email, 'newemail@example.com');
        assert.equal(decoded.id, 1);
    });

    test('allows passkey-only user without password to update email', async () => {
        activeUserId = 3;
        const res = await fetch(`${base}/api/settings/change-email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ newEmail: 'passkey-new@example.com' }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.user.email, 'passkey-new@example.com');
        assert.equal(body.user.hasPassword, false);
    });
});
