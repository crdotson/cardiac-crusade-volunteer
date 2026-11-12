import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createSignupRouter } from '../signup-routes.js';

describe('signup endpoints', () => {
    const secret = 'test-secret';
    const users = [];
    let server;
    let base;
    let verification = { verified: true, registrationInfo: { credential: {
        id: 'credential-id', publicKey: Buffer.from('public-key'), counter: 0,
    } } };
    const pool = {
        async query(sql, params = []) {
            if (sql.startsWith('SELECT id FROM users WHERE LOWER')) {
                return { rows: users.filter(user => user.email === params[0]) };
            }
            if (sql.startsWith('SELECT id FROM users WHERE role')) return { rows: [] };
            if (sql.startsWith('INSERT INTO users')) {
                const user = { id: users.length + 1, email: params[0], name: params[1], passwordHash: params[2], role: params[3], credentials: JSON.parse(params[5]) };
                users.push(user);
                return { rows: [user] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };

    before(async () => {
        const app = express();
        app.use(express.json());
        app.use(createSignupRouter({
            pool, jwtSecret: secret, rpId: 'example.com', origin: 'https://example.com',
            generateOptions: async options => {
                assert.equal(options.authenticatorSelection.residentKey, 'required');
                assert.equal(options.authenticatorSelection.userVerification, 'required');
                return { challenge: 'test-challenge' };
            },
            verifyResponse: async ({ expectedChallenge, expectedOrigin, expectedRPID }) => {
                assert.equal(expectedChallenge, 'test-challenge');
                assert.equal(expectedOrigin, 'https://example.com');
                assert.equal(expectedRPID, 'example.com');
                return verification;
            },
        }));
        server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        base = `http://127.0.0.1:${server.address().port}`;
    });
    after(() => new Promise(resolve => server.close(resolve)));

    async function post(path, body) {
        const response = await fetch(`${base}${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
    }

    async function options(email) {
        return post('/api/signup/passkey-options', { email });
    }

    test('does not create an account when options are requested or no sign-in method is provided', async () => {
        const result = await options('no-method@example.com');
        assert.equal(result.status, 200);
        assert.equal(users.length, 0);
        const signup = await post('/api/signup', { email: 'no-method@example.com' });
        assert.equal(signup.status, 400);
        assert.match(signup.body.message, /password or verified passkey/i);
        assert.equal(signup.cookie, null);
        assert.equal(users.length, 0);
    });

    test('rejects forged, expired, wrong-email, and unverified passkeys without creating an account', async () => {
        const { body } = await options('passkey@example.com');
        const response = { response: { transports: ['internal'] } };
        const expired = jwt.sign({ purpose: 'signup-passkey', email: 'passkey@example.com', challenge: 'test-challenge' }, secret, { expiresIn: -1 });
        const authToken = jwt.sign({ email: 'passkey@example.com', challenge: 'test-challenge' }, secret, { expiresIn: '1h' });
        for (const [email, signupToken] of [
            ['passkey@example.com', 'forged'],
            ['passkey@example.com', expired],
            ['passkey@example.com', authToken],
            ['other@example.com', body.signupToken],
        ]) {
            const result = await post('/api/signup', { email, passkey: { signupToken, response } });
            assert.equal(result.status, 400);
            assert.equal(result.cookie, null);
        }
        verification = { verified: false };
        const result = await post('/api/signup', { email: 'passkey@example.com', passkey: { signupToken: body.signupToken, response } });
        assert.equal(result.status, 400);
        const withPassword = await post('/api/signup', { email: 'passkey@example.com', password: 'password123', passkey: { signupToken: body.signupToken, response } });
        assert.equal(withPassword.status, 400);
        assert.equal(users.length, 0);
        verification = { verified: true, registrationInfo: { credential: {
            id: 'credential-id', publicKey: Buffer.from('public-key'), counter: 0,
        } } };
    });

    test('creates a passkey-only account atomically with its credential and issues a session', async () => {
        const { body } = await options(' PASSKEY@example.com ');
        const result = await post('/api/signup', {
            email: 'passkey@example.com', name: 'Volunteer',
            passkey: { signupToken: body.signupToken, response: { response: { transports: ['internal'] } } },
        });
        assert.equal(result.status, 200);
        assert.match(result.cookie, /token=/);
        const user = users.find(user => user.email === 'passkey@example.com');
        assert.equal(user.passwordHash, null);
        assert.equal(user.credentials[0].credentialID, 'credential-id');
        assert.deepEqual(user.credentials[0].transports, ['internal']);
        assert.equal((await post('/api/signup', { email: user.email, passkey: { signupToken: body.signupToken, response: { response: {} } } })).status, 400);
    });

    test('creates a password-only account after skipping passkey setup', async () => {
        const result = await post('/api/signup', { name: 'Volunteer', email: 'password@example.com', password: 'password123' });
        assert.equal(result.status, 200);
        assert.match(result.cookie, /token=/);
        const user = users.find(user => user.email === 'password@example.com');
        assert.equal(await bcrypt.compare('password123', user.passwordHash), true);
        assert.deepEqual(user.credentials, []);
    });

    test('creates an account with both a password and a verified passkey', async () => {
        const { body } = await options('both@example.com');
        const result = await post('/api/signup', {
            email: 'both@example.com', password: 'password123',
            passkey: { signupToken: body.signupToken, response: { response: {} } },
        });
        assert.equal(result.status, 200);
        const user = users.find(user => user.email === 'both@example.com');
        assert.equal(await bcrypt.compare('password123', user.passwordHash), true);
        assert.equal(user.credentials[0].credentialID, 'credential-id');
    });
});
