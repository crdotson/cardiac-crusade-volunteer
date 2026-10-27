export function determineRollUpId(coordinatorRows = [], adminRows = []) {
    if (coordinatorRows.length > 0 && coordinatorRows[0]?.id) {
        return coordinatorRows[0].id;
    }
    if (adminRows.length > 0 && adminRows[0]?.id) {
        return adminRows[0].id;
    }
    return null;
}

export function validateSignupPayload({ email, password }) {
    if (!email || typeof email !== 'string' || !email.trim()) {
        throw new Error('Email is required');
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Invalid email address');
    }

    const hasPassword = Boolean(password && typeof password === 'string' && password.length > 0);
    if (hasPassword && password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }

    return {
        email: trimmedEmail,
        hasPassword
    };
}
