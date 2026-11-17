import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordChange } from './password-validation.ts';

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
