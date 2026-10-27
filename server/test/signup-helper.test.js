import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSignupPayload, determineRollUpId } from '../signup-helpers.js';

describe('Sign-up Helpers', () => {
    describe('determineRollUpId', () => {
        test('selects first City Coordinator when one exists', () => {
            const coords = [{ id: 42, role: 'City Coordinator' }, { id: 99, role: 'City Coordinator' }];
            const admins = [{ id: 1, role: 'Application Administrator' }];
            const result = determineRollUpId(coords, admins);
            assert.equal(result, 42);
        });

        test('falls back to Application Administrator when no City Coordinator exists', () => {
            const coords = [];
            const admins = [{ id: 1, role: 'Application Administrator' }];
            const result = determineRollUpId(coords, admins);
            assert.equal(result, 1);
        });

        test('returns null when neither City Coordinator nor Administrator exists', () => {
            const coords = [];
            const admins = [];
            const result = determineRollUpId(coords, admins);
            assert.equal(result, null);
        });
    });

    describe('validateSignupPayload', () => {
        test('rejects empty or missing email', () => {
            assert.throws(() => validateSignupPayload({ email: '', password: 'password123' }), /Email is required/);
            assert.throws(() => validateSignupPayload({ email: '   ', password: 'password123' }), /Email is required/);
            assert.throws(() => validateSignupPayload({ password: 'password123' }), /Email is required/);
        });

        test('rejects invalid email formats', () => {
            assert.throws(() => validateSignupPayload({ email: 'invalid-email', password: 'password123' }), /Invalid email address/);
        });

        test('rejects password shorter than 8 characters when password is provided', () => {
            assert.throws(() => validateSignupPayload({ email: 'test@example.com', password: 'short' }), /Password must be at least 8 characters/);
        });

        test('accepts valid email and password, normalizing email', () => {
            const result = validateSignupPayload({ email: '  User@Example.COM  ', password: 'validPassword123' });
            assert.equal(result.email, 'user@example.com');
            assert.equal(result.hasPassword, true);
        });

        test('accepts passkey-only signup with no password', () => {
            const result = validateSignupPayload({ email: 'user@example.com', password: '' });
            assert.equal(result.email, 'user@example.com');
            assert.equal(result.hasPassword, false);

            const resultNull = validateSignupPayload({ email: 'user@example.com', password: null });
            assert.equal(resultNull.hasPassword, false);
        });
    });
});
