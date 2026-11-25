import bcrypt from 'bcrypt';

export function normalizeAndValidateEmail(email) {
    if (!email || typeof email !== 'string' || !email.trim()) {
        const err = new Error('Email is required');
        err.status = 400;
        throw err;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        const err = new Error('Invalid email address');
        err.status = 400;
        throw err;
    }
    return trimmedEmail;
}

export async function updateUserEmail({ pool, userId, newEmail, currentPassword, requirePassword = true }) {
    const normalizedNewEmail = normalizeAndValidateEmail(newEmail);

    const userRes = await pool.query(
        'SELECT id, email, password_hash, role FROM users WHERE id = $1',
        [userId]
    );
    if (userRes.rows.length === 0) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    const user = userRes.rows[0];

    if (requirePassword && user.password_hash) {
        if (!currentPassword || typeof currentPassword !== 'string') {
            const err = new Error('Current password is required');
            err.status = 401;
            throw err;
        }
        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            const err = new Error('Incorrect current password');
            err.status = 401;
            throw err;
        }
    }

    if (normalizedNewEmail === (user.email || '').toLowerCase()) {
        const err = new Error('New email must be different from your current email');
        err.status = 400;
        throw err;
    }

    const existing = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2',
        [normalizedNewEmail, userId]
    );
    if (existing.rows.length > 0) {
        const err = new Error('An account with this email already exists');
        err.status = 400;
        throw err;
    }

    const previousEmail = user.email;

    const updateRes = await pool.query(
        'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, role',
        [normalizedNewEmail, userId]
    );
    const updatedUser = updateRes.rows[0];

    await pool.query('DELETE FROM otp_storage WHERE LOWER(email) = LOWER($1)', [previousEmail]);

    return {
        user: {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            hasPassword: Boolean(user.password_hash),
        },
        previousEmail,
    };
}
