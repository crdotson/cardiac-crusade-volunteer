import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageUpload } from '../media-helpers.js';

describe('Media Helpers', () => {
    describe('validateImageUpload', () => {
        test('rejects missing data or mime_type', () => {
            assert.throws(() => validateImageUpload({}), /Image data and mime_type are required/);
            assert.throws(() => validateImageUpload({ mime_type: 'image/png' }), /Image data and mime_type are required/);
            assert.throws(() => validateImageUpload({ data: 'abc' }), /Image data and mime_type are required/);
        });

        test('rejects unsupported mime types', () => {
            assert.throws(() => validateImageUpload({
                data: 'dGVzdA==',
                mime_type: 'application/pdf',
                filename: 'doc.pdf'
            }), /Unsupported image type/);

            assert.throws(() => validateImageUpload({
                data: 'dGVzdA==',
                mime_type: 'text/html',
                filename: 'hack.html'
            }), /Unsupported image type/);
        });

        test('accepts valid png data with data URL prefix', () => {
            const raw = 'Hello World Image Data';
            const base64 = Buffer.from(raw).toString('base64');
            const dataUrl = `data:image/png;base64,${base64}`;

            const result = validateImageUpload({
                data: dataUrl,
                mime_type: 'IMAGE/PNG',
                filename: 'logo.png'
            });

            assert.equal(result.mimeType, 'image/png');
            assert.equal(result.cleanFilename, 'logo.png');
            assert.equal(result.buffer.toString(), raw);
        });

        test('rejects payloads exceeding 5MB', () => {
            // 5MB + 1 byte
            const oversized = Buffer.alloc(5 * 1024 * 1024 + 10);
            const base64 = oversized.toString('base64');

            assert.throws(() => validateImageUpload({
                data: base64,
                mime_type: 'image/jpeg',
                filename: 'huge.jpg'
            }), /Image size exceeds maximum limit of 5MB/);
        });

        test('sanitizes filename and provides default if missing', () => {
            const base64 = Buffer.from('image').toString('base64');
            const result = validateImageUpload({
                data: base64,
                mime_type: 'image/webp'
            });

            assert.equal(result.cleanFilename, 'image');
            assert.equal(result.mimeType, 'image/webp');
        });
    });
});
