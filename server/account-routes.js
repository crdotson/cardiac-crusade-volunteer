import express from 'express';
import jwt from 'jsonwebtoken';
import { updateUserEmail } from './account-helpers.js';

export function createAccountRouter({ pool, jwtSecret, authenticateToken }) {
    const router = express.Router();

    router.post('/api/settings/change-email', authenticateToken, async (req, res) => {
        const { newEmail, currentPassword } = req.body;
        try {
            const { user } = await updateUserEmail({
                pool,
                userId: req.user.id,
                newEmail,
                currentPassword,
                requirePassword: true,
            });

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                jwtSecret,
                { expiresIn: '24h' }
            );
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
            });

            res.json({ success: true, user });
        } catch (err) {
            if (err.status) {
                return res.status(err.status).json({ message: err.message });
            }
            if (err.code === '23505') {
                return res.status(400).json({ message: 'An account with this email already exists' });
            }
            console.error('Error in route:', req.path, err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
