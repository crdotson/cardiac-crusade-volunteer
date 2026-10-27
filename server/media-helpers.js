const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageUpload({ filename, mime_type, data }) {
    if (!data || !mime_type) {
        throw new Error('Image data and mime_type are required');
    }

    const normalizedMime = mime_type.trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        throw new Error('Unsupported image type. Allowed types: JPG, PNG, GIF, WEBP, SVG');
    }

    // Strip data URL scheme prefix if present (e.g. data:image/png;base64,...)
    const base64Data = data.replace(/^data:[^;]+;base64,/, '').trim();
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
        throw new Error('Image data is empty');
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error('Image size exceeds maximum limit of 5MB');
    }

    const cleanFilename = (filename ? filename.trim() : 'image').slice(0, 255);

    return {
        cleanFilename,
        mimeType: normalizedMime,
        buffer
    };
}
