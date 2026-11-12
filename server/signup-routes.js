import { randomBytes } from 'node:crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { validateSignupPayload, determineRollUpId } from './signup-helpers.js';

export function createSignupRouter({ pool, jwtSecret, rpId, origin, generateOptions = generateRegistrationOptions, verifyResponse = verifyRegistrationResponse }) {
    const router = express.Router();

    router.post('/api/signup/passkey-options', async (req, res) => {
        let email;
        try {
            ({ email } = validateSignupPayload({ email: req.body.email }));
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
            if (existing.rows.length) {
                return res.status(400).json({ message: 'An account with this email already exists' });
            }
            const options = await generateOptions({
                rpName: 'Cardiac Crusade',
                rpID: rpId,
                userID: randomBytes(32),
                userName: email,
                attestationType: 'none',
                authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
            });
            const signupToken = jwt.sign(
                { purpose: 'signup-passkey', email, challenge: options.challenge },
                jwtSecret,
                { expiresIn: '10m' }
            );
            res.json({ options, signupToken });
        } catch (err) {
            console.error('Error creating signup passkey options:', err);
            res.status(500).json({ message: 'Unable to start passkey setup' });
        }
    });

    router.post('/api/signup', async (req, res) => {
        const { email, password, name, passkey } = req.body;
        let validated;
        try {
            validated = validateSignupPayload({ email, password });
            if (name != null && typeof name !== 'string') throw new Error('Invalid name');
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        let credential = null;
        if (passkey) {
            let token;
            try {
                token = jwt.verify(passkey.signupToken, jwtSecret, { algorithms: ['HS256'] });
                if (token.purpose !== 'signup-passkey' || token.email !== validated.email || typeof token.challenge !== 'string') {
                    throw new Error('Invalid signup challenge');
                }
            } catch {
                return res.status(400).json({ success: false, message: 'Passkey setup expired or is invalid. Please try again.' });
            }

            try {
                const verification = await verifyResponse({
                    response: passkey.response,
                    expectedChallenge: token.challenge,
                    expectedOrigin: origin,
                    expectedRPID: rpId,
                });
                const registered = verification.registrationInfo?.credential;
                if (!verification.verified || !registered?.id || !registered.publicKey) {
                    return res.status(400).json({ success: false, message: 'Passkey verification failed. Please try again.' });
                }
                credential = {
                    credentialID: registered.id,
                    credentialPublicKey: Buffer.from(registered.publicKey).toString('base64'),
                    counter: registered.counter,
                    transports: passkey.response.response.transports || registered.transports || [],
                    createdAt: new Date().toISOString(),
                    deviceName: passkey.response.authenticatorAttachment || 'Primary Device',
                };
            } catch (err) {
                console.error('Signup passkey verification failed:', err);
                return res.status(400).json({ success: false, message: 'Passkey verification failed. Please try again.' });
            }
        }

        if (!validated.hasPassword && !credential) {
            return res.status(400).json({ success: false, message: 'A password or verified passkey is required' });
        }

        try {
            const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [validated.email]);
            if (existing.rows.length) {
                return res.status(400).json({ success: false, message: 'An account with this email already exists' });
            }
            const coords = await pool.query("SELECT id FROM users WHERE role = 'City Coordinator' ORDER BY id ASC LIMIT 1");
            const admins = await pool.query("SELECT id FROM users WHERE role = 'Application Administrator' ORDER BY id ASC LIMIT 1");
            const rollUpToId = determineRollUpId(coords.rows, admins.rows);
            const passwordHash = validated.hasPassword ? await bcrypt.hash(password, 10) : null;
            const insertRes = await pool.query(
                'INSERT INTO users (email, name, password_hash, role, roll_up_to_id, fido2_credentials) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role',
                [validated.email, name ? name.trim() : null, passwordHash, 'Volunteer', rollUpToId, JSON.stringify(credential ? [credential] : [])]
            );
            const user = insertRes.rows[0];
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '24h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            res.json({ success: true, user });
        } catch (err) {
            if (err.code === '23505') {
                return res.status(400).json({ success: false, message: 'An account with this email already exists' });
            }
            console.error('Error in /api/signup:', err);
            res.status(500).json({ success: false, message: 'Signup failed. Please try again.' });
        }
    });

    return router;
}
