import express from 'express';
import pg from 'pg';
const { Pool } = pg;
import bcrypt from 'bcrypt';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import 'dotenv/config';

const __dirname = import.meta.dirname;

const app = express();
app.set('trust proxy', 1); // Trust the reverse proxy
app.use(cors({
    origin: ['https://www.dotson97.org', 'https://test-cardiaccrusade.dotson97.org', 'http://localhost:1443'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const BASE_PATH = process.env.BASE_PATH || '/cardiac-crusade';
const mainRouter = express.Router();

// Global request logger (within router)
mainRouter.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'cardiac_crusade',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const RP_ID = process.env.RP_ID || 'www.dotson97.org';
const ORIGIN = process.env.ORIGIN || `https://${RP_ID}`;

async function initDB() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          password_hash VARCHAR(255),
          role VARCHAR(50) NOT NULL,
          roll_up_to_id INTEGER REFERENCES users(id),
          fido2_credentials JSONB DEFAULT '[]',
          social_ids JSONB DEFAULT '{}'
        );
      `);

      // Ensure 'name' column exists if table was already created
      await pool.query(`
        DO \$\$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN
            ALTER TABLE users ADD COLUMN name VARCHAR(255);
          END IF;
        END \$\$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_storage (
          email VARCHAR(255) PRIMARY KEY,
          otp_hash VARCHAR(255),
          expires_at TIMESTAMP,
          attempts INTEGER DEFAULT 0,
          blocked_until TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS locations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          lat DOUBLE PRECISION NOT NULL,
          lng DOUBLE PRECISION NOT NULL,
          phone VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Pending',
          category VARCHAR(100),
          assigned_volunteer_id INTEGER REFERENCES users(id),
          assigned_by_id INTEGER REFERENCES users(id),
          assignment_type VARCHAR(50),
          UNIQUE(name, address)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          location_id INTEGER REFERENCES locations(id),
          user_id INTEGER REFERENCES users(id),
          previous_status VARCHAR(50),
          new_status VARCHAR(50),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS assignments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          geom JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      const adminEmail = 'chris@dotson97.org';
      const adminPassword = 'changeme';
      
      const res = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
      if (res.rows.length === 0) {
        const hash = await bcrypt.hash(adminPassword, 10);
        await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [adminEmail, hash, 'Application Administrator']);
        console.log('Admin user created');
      }
      
      // Default settings
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['google_api_key', '']);
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['google_places_limit', '10']);
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['default_origin_city', 'Lexington, KY']);

      console.log('Database initialized');
      break;
    } catch (err) {
      console.error('Failed to initialize database, retrying...', err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

initDB();

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        console.log('No token found in cookies for request:', req.path);
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('JWT verification failed for request:', req.path, err.message);
            return res.sendStatus(403);
        }
        console.log(`Authenticated: ${user.email} (${user.role}) for ${req.path}`);
        req.user = user;
        next();
    });
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            console.log(`Role authorization failed for ${req.path}. Required: ${roles}, User: ${req.user.role}`);
            return res.status(403).json({ message: 'Access denied' });
        }
        console.log(`Authorized: ${req.user.email} for ${req.path}`);
        next();
    };
};

// --- FIDO2 Stubs & State ---
// In a real app, these challenges should be stored in the session or DB tied to a user/session.
// For this prototype, we'll use a simple in-memory map or just trust the client (not secure for production).
const currentChallenges = new Map();

// --- Auth Endpoints ---

mainRouter.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (!user.password_hash) {
                return res.status(401).json({ success: false, message: 'This account uses social or passkey login' });
            }
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
                res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
                res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

mainRouter.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// --- FIDO2 (WebAuthn) ---

mainRouter.post('/api/auth/fido2/register-options', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        const options = await generateRegistrationOptions({
            rpName: 'Cardiac Crusade',
            rpID: RP_ID,
            userID: user ? isoUint8Array.fromUTF8String(user.id.toString()) : isoUint8Array.fromUTF8String('new-user'),
            userName: email,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });

        currentChallenges.set(email, options.challenge);
        res.json(options);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/auth/fido2/register-verify', async (req, res) => {
    const { email, body, deviceName } = req.body;
    const expectedChallenge = currentChallenges.get(email);

    try {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });

        if (verification.verified) {
            const { registrationInfo } = verification;
            const credentialID = registrationInfo?.credential?.id;
            const credentialPublicKey = registrationInfo?.credential?.publicKey;
            const counter = registrationInfo?.credential?.counter;

            if (!credentialID || !credentialPublicKey) {
                console.error('Missing credentialID or credentialPublicKey in registrationInfo', JSON.stringify(registrationInfo));
                return res.status(400).json({ verified: false, message: 'Invalid registration info' });
            }

            const newCredential = {
                credentialID: typeof credentialID === 'string' ? credentialID : Buffer.from(credentialID).toString('base64url'),
                credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
                counter,
                transports: body.response.transports || registrationInfo?.credential?.transports || [],
                createdAt: new Date().toISOString(),
                deviceName: deviceName || body.authenticatorAttachment || 'Unknown Device',
            };

            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const updatedCredentials = [...(user.fido2_credentials || []), newCredential];
                await pool.query('UPDATE users SET fido2_credentials = $1 WHERE id = $2', [JSON.stringify(updatedCredentials), user.id]);
            } else {
                // If user doesn't exist, we might want to create one if registration is allowed
                return res.status(400).json({ verified: false, message: 'User must exist to register passkey in this prototype' });
            }

            res.json({ verified: true });
        } else {
            res.status(400).json({ verified: false });
        }
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/auth/fido2/login-options', async (req, res) => {
    const { email } = req.body;
    try {
        let user = null;
        if (email) {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            user = result.rows[0];
        }

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials: user ? (user.fido2_credentials || []).map(cred => ({
                id: Buffer.from(cred.credentialID, 'base64url'),
                type: 'public-key',
                transports: cred.transports,
            })) : [],
            userVerification: 'preferred',
        });

        currentChallenges.set(email || 'discoverable', options.challenge);
        res.json(options);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/auth/fido2/login-verify', async (req, res) => {
    const { email, body } = req.body;
    const expectedChallenge = currentChallenges.get(email || 'discoverable');

    try {
        let user;
        if (email) {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            user = result.rows[0];
        } else {
            // Discoverable login: search all users for this credentialID
            const result = await pool.query("SELECT * FROM users WHERE fido2_credentials @> $1", [JSON.stringify([{ credentialID: body.id }])]);
            user = result.rows[0];
        }

        if (!user) return res.status(400).json({ verified: false, message: 'User not found' });

        const dbCred = (user.fido2_credentials || []).find(c => c.credentialID === body.id);
        if (!dbCred) {
            console.error('Credential not found in user credentials list. body.id:', body.id);
            return res.status(400).json({ verified: false, message: 'Credential not found' });
        }

        console.log('Found dbCred:', JSON.stringify(dbCred));

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: Buffer.from(dbCred.credentialID, 'base64url'),
                publicKey: Buffer.from(dbCred.credentialPublicKey, 'base64'),
                counter: dbCred.counter || 0,
                transports: dbCred.transports || [],
            },
        });

        if (verification.verified) {
            // Update counter
            const updatedCredentials = user.fido2_credentials.map(c => 
                c.credentialID === body.id ? { ...c, counter: verification.authenticationInfo.newCounter } : c
            );
            await pool.query('UPDATE users SET fido2_credentials = $1 WHERE id = $2', [JSON.stringify(updatedCredentials), user.id]);

            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            res.json({ verified: true, user: { id: user.id, email: user.email, role: user.role } });
        } else {
            res.status(400).json({ verified: false });
        }
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.get('/api/auth/fido2/credentials', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT fido2_credentials FROM users WHERE id = $1', [req.user.id]);
        const credentials = result.rows[0].fido2_credentials || [];
        // Map to remove sensitive public key from the list view
        const list = credentials.map(c => ({
            id: c.credentialID,
            createdAt: c.createdAt || new Date(0).toISOString(),
            deviceName: c.deviceName || 'Unknown Device',
            transports: c.transports || [],
        }));
        res.json(list);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.delete('/api/auth/fido2/credentials/:id', authenticateToken, async (req, res) => {
    const credentialId = req.params.id;
    try {
        const result = await pool.query('SELECT fido2_credentials FROM users WHERE id = $1', [req.user.id]);
        const credentials = result.rows[0].fido2_credentials || [];
        const filtered = credentials.filter(c => c.credentialID !== credentialId);
        
        await pool.query('UPDATE users SET fido2_credentials = $1 WHERE id = $2', [JSON.stringify(filtered), req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

// --- OTP Logic ---

mainRouter.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
        }
        
        const user = userRes.rows[0];
        if (user.social_ids && Object.keys(user.social_ids).length > 0) {
            const providers = Object.keys(user.social_ids).join(', ');
            return res.json({ success: true, isSocial: true, message: `This account is linked to social login: ${providers}. Please login using those methods.` });
        }

        // Brute force protection check
        const otpRes = await pool.query('SELECT * FROM otp_storage WHERE email = $1', [email]);
        if (otpRes.rows.length > 0) {
            const otpData = otpRes.rows[0];
            if (otpData.blocked_until && new Date(otpData.blocked_until) > new Date()) {
                return res.status(429).json({ success: false, message: 'Too many attempts. Blocked for 5 minutes.' });
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        await pool.query(`
            INSERT INTO otp_storage (email, otp_hash, expires_at, attempts) 
            VALUES ($1, $2, $3, 0) 
            ON CONFLICT (email) DO UPDATE SET otp_hash = $2, expires_at = $3, attempts = 0, blocked_until = NULL
        `, [email, otpHash, expiresAt]);

        console.log(`OTP for ${email}: ${otp}`); // Log to console for development
        
        // In a real app, send email here
        // transporter.sendMail(...)

        res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const otpRes = await pool.query('SELECT * FROM otp_storage WHERE email = $1', [email]);
        if (otpRes.rows.length === 0) return res.status(400).json({ success: false, message: 'OTP not found' });

        const otpData = otpRes.rows[0];
        if (otpData.blocked_until && new Date(otpData.blocked_until) > new Date()) {
            return res.status(429).json({ success: false, message: 'Account temporarily blocked.' });
        }
        if (new Date(otpData.expires_at) < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        const match = await bcrypt.compare(otp, otpData.otp_hash);
        if (match) {
            await pool.query('DELETE FROM otp_storage WHERE email = $1', [email]);
            // In a real app, we might return a short-lived token to allow password reset
            const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = userRes.rows[0];
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role, isOtpVerified: true }, JWT_SECRET, { expiresIn: '15m' });
            res.json({ success: true, resetToken: token });
        } else {
            const newAttempts = otpData.attempts + 1;
            if (newAttempts >= 3) {
                const blockedUntil = new Date(Date.now() + 5 * 60000); // 5 mins
                await pool.query('UPDATE otp_storage SET attempts = $1, blocked_until = $2 WHERE email = $3', [newAttempts, blockedUntil, email]);
                res.status(429).json({ success: false, message: 'Too many incorrect attempts. Blocked for 5 minutes.' });
            } else {
                await pool.query('UPDATE otp_storage SET attempts = $1 WHERE email = $3', [newAttempts, email]);
                res.status(400).json({ success: false, message: 'Invalid OTP' });
            }
        }
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isOtpVerified) return res.status(401).json({ message: 'Invalid reset token' });

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, decoded.id]);
        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired reset token' });
    }
});

// --- Social Login Stubs ---
mainRouter.get('/api/auth/google', (req, res) => res.status(501).json({ message: 'Google Login stub' }));
mainRouter.get('/api/auth/facebook', (req, res) => res.status(501).json({ message: 'Facebook Login stub' }));

// --- Users Management (Phase 2) ---

mainRouter.get('/api/users', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    try {
        const { role, id } = req.user;
        let query = '';
        let params = [];

        if (role === 'Application Administrator') {
            query = `
                SELECT u.id, u.email, u.name, u.role, u.roll_up_to_id, r.email as roll_up_to_email 
                FROM users u 
                LEFT JOIN users r ON u.roll_up_to_id = r.id
            `;
        } else if (role === 'City Coordinator') {
            // City Coordinators see users they created OR users created by CHAARG leaders they supervise
            query = `
                SELECT u.id, u.email, u.name, u.role, u.roll_up_to_id, r.email as roll_up_to_email 
                FROM users u 
                LEFT JOIN users r ON u.roll_up_to_id = r.id
                WHERE u.roll_up_to_id = $1 
                OR u.roll_up_to_id IN (SELECT id FROM users WHERE roll_up_to_id = $1 AND role = 'CHAARG leader')
            `;
            params = [id];
        } else if (role === 'CHAARG leader') {
            query = `
                SELECT u.id, u.email, u.name, u.role, u.roll_up_to_id, r.email as roll_up_to_email 
                FROM users u 
                LEFT JOIN users r ON u.roll_up_to_id = r.id
                WHERE u.roll_up_to_id = $1
            `;
            params = [id];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/users', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { email, name, password, role } = req.body;
    const creatorRole = req.user.role;
    const creatorId = req.user.id;

    // Hierarchy validation
    if (creatorRole === 'City Coordinator' && !['CHAARG leader', 'Volunteer'].includes(role)) {
        return res.status(403).json({ message: 'City Coordinators can only create CHAARG leaders or Volunteers' });
    }
    if (creatorRole === 'CHAARG leader' && role !== 'Volunteer') {
        return res.status(403).json({ message: 'CHAARG leaders can only create Volunteers' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, name, password_hash, role, roll_up_to_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
            [email, name || null, hash, role, creatorId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/users/bulk', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { users } = req.body; // Array of { email, name, role, rolls_up_to_email }
    try {
        for (const u of users) {
            let supervisorId = null;
            if (u.rolls_up_to_email) {
                const supervisorRes = await pool.query('SELECT id FROM users WHERE email = $1', [u.rolls_up_to_email]);
                supervisorId = supervisorRes.rows[0]?.id || null;
            }
            const hash = await bcrypt.hash('changeme', 10); // Default password
            await pool.query(
                'INSERT INTO users (email, name, password_hash, role, roll_up_to_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
                [u.email, u.name || null, hash, u.role || 'Volunteer', supervisorId]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error in bulk users route:', err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.patch('/api/users/:id', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { email, name, role, roll_up_to_id } = req.body;
    const targetId = req.params.id;
    const requesterRole = req.user.role;

    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const targetUser = userRes.rows[0];

        // Role modification logic
        if (role && role !== targetUser.role) {
            if (requesterRole === 'CHAARG leader') {
                return res.status(403).json({ message: 'CHAARG leaders cannot change roles' });
            }
            if (requesterRole === 'City Coordinator') {
                if (!['City Coordinator', 'CHAARG leader', 'Volunteer'].includes(role)) {
                    return res.status(403).json({ message: 'City Coordinators can only assign City Coordinator, CHAARG leader, or Volunteer roles' });
                }
            }
            // Admins can set any role
        }

        const newEmail = email !== undefined ? email : targetUser.email;
        const newName = name !== undefined ? name : targetUser.name;
        const newRole = role !== undefined ? role : targetUser.role;
        const newRollUpTo = roll_up_to_id !== undefined ? roll_up_to_id : targetUser.roll_up_to_id;

        await pool.query(
            'UPDATE users SET email=$1, name=$2, role=$3, roll_up_to_id=$4 WHERE id=$5',
            [newEmail, newName, newRole, newRollUpTo, targetId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

// --- Settings Management ---

mainRouter.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/settings', authenticateToken, authorizeRoles('Application Administrator'), async (req, res) => {
    const { settings } = req.body; // { key1: value1, key2: value2 }
    try {
        for (const [key, value] of Object.entries(settings)) {
            await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/settings/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        
        if (user.password_hash) {
            const match = await bcrypt.compare(currentPassword, user.password_hash);
            if (!match) return res.status(401).json({ message: 'Incorrect current password' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

// --- Locations & Assignments (Phases 3 & 4) ---

import stringSimilarity from 'string-similarity';
import axios from 'axios';

mainRouter.get('/api/categories', (req, res) => {
    const categories = [
        "Airports", "Amusement Park", "Aquarium", "Apartment Complex", "Auditoriums", "Arena", "Bank", "Bar", 
        "Businesses", "Cafeterias", "Camping Site", "Casino", "Church", "Clinic", "College", "Community Center", 
        "Convention Center", "Correctional Facility", "Courthouse", "Dentist", "Doctor", "Factory", "Fire Station", 
        "Gas Station", "Golf Course", "Government Building", "Grocery or Supermarket", "Gym or Sports Club", 
        "Hospital", "Library", "Lodging / Hotel", "Long Term Care Facility", "Medical Care", "Movie Theater", 
        "Museum", "Music Venue", "Night Club", "Office", "Park", "Parking Area", "Police Station", "Post Office", 
        "Preschool / Nursery", "Public Transit Station", "Recreation Center", "Residential Home", "Restaurant", 
        "Retirement Community", "RV Park", "Schools", "Senior Center", "Shopping malls", "Stadium", "Theater", 
        "University", "Veterinarian", "Warehouse", "Water Park", "Zoo"
    ];
    res.json(categories);
});

mainRouter.get('/api/locations', authenticateToken, async (req, res) => {
    const { role, id } = req.user;
    try {
        let query = 'SELECT l.*, u.email as assigned_volunteer_email FROM locations l LEFT JOIN users u ON l.assigned_volunteer_id = u.id';
        let params = [];

        if (role === 'Application Administrator') {
            // See all
        } else if (role === 'City Coordinator') {
            query += ` WHERE l.assigned_volunteer_id IN (
                SELECT id FROM users WHERE roll_up_to_id = $1 OR id = $1
                OR roll_up_to_id IN (SELECT id FROM users WHERE roll_up_to_id = $1 AND role = 'CHAARG leader')
            ) OR l.assigned_volunteer_id IS NULL`;
            params = [id];
        } else if (role === 'CHAARG leader') {
            query += ` WHERE l.assigned_volunteer_id IN (SELECT id FROM users WHERE roll_up_to_id = $1 OR id = $1) OR l.assigned_volunteer_id IS NULL`;
            params = [id];
        } else if (role === 'Volunteer') {
            query += ' WHERE l.assigned_volunteer_id = $1';
            params = [id];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { name, address, lat, lng, phone, category, assigned_volunteer_id, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO locations (name, address, lat, lng, phone, category, status, assigned_volunteer_id, assignment_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [name, address, lat, lng, phone, category, status || 'Unvisited', assigned_volunteer_id || null, assigned_volunteer_id ? 'Manual' : null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error adding location:', err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.delete('/api/locations/:id', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    try {
        await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.get('/api/locations/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, v.email as volunteer_email, b.email as assigned_by_email 
            FROM locations l 
            LEFT JOIN users v ON l.assigned_volunteer_id = v.id 
            LEFT JOIN users b ON l.assigned_by_id = b.id 
            WHERE l.id = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Location not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.patch('/api/locations/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const locationId = req.params.id;
    const userId = req.user.id;

    try {
        const locRes = await pool.query('SELECT status FROM locations WHERE id = $1', [locationId]);
        if (locRes.rows.length === 0) return res.status(404).json({ message: 'Location not found' });
        const oldStatus = locRes.rows[0].status;

        await pool.query('UPDATE locations SET status = $1 WHERE id = $2', [status, locationId]);
        await pool.query('INSERT INTO audit_logs (location_id, user_id, previous_status, new_status) VALUES ($1, $2, $3, $4)', 
            [locationId, userId, oldStatus, status]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations/search', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { category, city = 'Lexington, KY' } = req.body;
    try {
        const keyRes = await pool.query("SELECT value FROM settings WHERE key = 'google_api_key'");
        const apiKey = keyRes.rows[0]?.value;
        if (!apiKey) return res.status(400).json({ message: 'Google API key not configured' });

        const limitRes = await pool.query("SELECT value FROM settings WHERE key = 'google_places_limit'");
        const limit = parseInt(limitRes.rows[0]?.value || '20');

        const currentLocs = await pool.query('SELECT name, address FROM locations');
        
        const query = `${category} in ${city}`;
        const response = await axios.post('https://places.googleapis.com/v1/places:searchText', 
            { textQuery: query, maxResultCount: limit },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber'
                }
            }
        );

        const results = response.data.places || [];
        const candidates = [];

        for (const place of results) {
            const name = place.displayName.text;
            const address = place.formattedAddress;
            const lat = place.location.latitude;
            const lng = place.location.longitude;
            const phone = place.internationalPhoneNumber || null;

            let isDuplicate = false;
            for (const existing of currentLocs.rows) {
                const nameSim = stringSimilarity.compareTwoStrings(name.toLowerCase(), existing.name.toLowerCase());
                const addrSim = stringSimilarity.compareTwoStrings(address.toLowerCase(), existing.address.toLowerCase());
                if (nameSim > 0.8 && addrSim > 0.8) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                candidates.push({ name, address, lat, lng, phone, category });
            }
        }

        res.json(candidates);
    } catch (err) {
        console.error('Error in search route:', err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations/search-nearby', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { lat, lng, radius } = req.body; // radius in meters
    try {
        const keyRes = await pool.query("SELECT value FROM settings WHERE key = 'google_api_key'");
        const apiKey = keyRes.rows[0]?.value;
        if (!apiKey) return res.status(400).json({ message: 'Google API key not configured' });

        const limitRes = await pool.query("SELECT value FROM settings WHERE key = 'google_places_limit'");
        const limit = parseInt(limitRes.rows[0]?.value || '20');

        const broadTypes = [
            'airport', 'amusement_park', 'aquarium', 'bank', 'bar', 'cafe',
            'casino', 'church', 'city_hall', 'courthouse', 'dentist', 'doctor',
            'fire_station', 'gas_station', 'gym', 'hospital', 'library', 'lodging',
            'medical_clinic', 'movie_theater', 'museum', 'night_club', 'park',
            'parking', 'police', 'post_office', 'restaurant', 'school', 'shopping_mall',
            'stadium', 'store', 'supermarket', 'transit_station', 'university',
            'veterinary_care', 'zoo'
        ];

        const response = await axios.post('https://places.googleapis.com/v1/places:searchNearby', 
            { 
                locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radius } },
                maxResultCount: limit,
                includedTypes: broadTypes
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.types'
                }
            }
        );

        const results = (response.data.places || []).map(p => ({
            name: p.displayName?.text || 'Unknown',
            address: p.formattedAddress || 'No Address',
            lat: p.location?.latitude,
            lng: p.location?.longitude,
            phone: p.internationalPhoneNumber || null,
            categories: p.types || []
        }));

        res.json(results);
    } catch (err) {
        const errorData = err.response?.data;
        console.error('CRITICAL: search-nearby failure:', JSON.stringify(errorData || err.message));
        if (errorData?.error?.status === 'PERMISSION_DENIED') {
            return res.status(403).json({ message: `Google API Error: ${errorData.error.message}. Please ensure "Places API (New)" is enabled.` });
        }
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations/confirm-import', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { locations } = req.body;
    try {
        // Fetch all current area assignments
        const assignmentsRes = await pool.query('SELECT user_id, geom FROM assignments');
        const assignments = assignmentsRes.rows;

        let importedCount = 0;
        for (const loc of locations) {
            let assignedVolunteerId = null;
            let assignmentType = null;

            // Check if location falls within any assignment rectangle
            for (const assign of assignments) {
                const { _northEast, _southWest } = assign.geom;
                if (loc.lat <= _northEast.lat && loc.lat >= _southWest.lat && 
                    loc.lng <= _northEast.lng && loc.lng >= _southWest.lng) {
                    assignedVolunteerId = assign.user_id;
                    assignmentType = 'Area';
                    break; // Use the first matching assignment found
                }
            }

            await pool.query(
                'INSERT INTO locations (name, address, lat, lng, phone, category, status, assigned_volunteer_id, assignment_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (name, address) DO NOTHING',
                [loc.name, loc.address, loc.lat, loc.lng, loc.phone, loc.category, 'Unvisited', assignedVolunteerId, assignmentType]
            );
            importedCount++;
        }
        res.json({ success: true, importedCount });
    } catch (err) {
        console.error('Error in confirm-import route:', err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations/geocode', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { address } = req.body;
    try {
        const keyRes = await pool.query("SELECT value FROM settings WHERE key = 'google_api_key'");
        const apiKey = keyRes.rows[0]?.value;
        if (!apiKey) return res.status(400).json({ message: 'Google API key not configured' });

        // Use Geocoding API as requested by the error handler configuration
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: apiKey
            }
        });

        if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
            console.error('Google Geocoding API Error:', response.data.status, response.data.error_message);
            return res.status(400).json({ message: `Could not find location for: ${address}. Google returned status: ${response.data.status}.` });
        }

        const geo = response.data.results[0];
        res.json({ 
            lat: geo.geometry.location.lat, 
            lng: geo.geometry.location.lng, 
            formatted_address: geo.formatted_address 
        });
    } catch (err) {
        console.error('CRITICAL: geocode failure:', JSON.stringify(err.response?.data || err.message));
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/assignments/area', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { volunteerId, bounds } = req.body; // bounds: { _northEast: {lat, lng}, _southWest: {lat, lng} }
    const assignedBy = req.user.id;

    try {
        const { _northEast, _southWest } = bounds;
        
        // Update locations within bounds
        const updateRes = await pool.query(`
            UPDATE locations 
            SET assigned_volunteer_id = $1, assigned_by_id = $2, assignment_type = 'Area' 
            WHERE lat <= $3 AND lat >= $4 AND lng <= $5 AND lng >= $6
            AND (assigned_volunteer_id IS NULL OR assignment_type = 'Area')
            RETURNING id
        `, [volunteerId, assignedBy, _northEast.lat, _southWest.lat, _northEast.lng, _southWest.lng]);

        // Save assignment geometry
        await pool.query('INSERT INTO assignments (user_id, geom) VALUES ($1, $2)', [volunteerId, JSON.stringify(bounds)]);

        res.json({ assignedCount: updateRes.rowCount });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.get('/api/users/assignable', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    try {
        const { role, id } = req.user;
        let query = '';
        let params = [];

        if (role === 'Application Administrator') {
            query = 'SELECT id, email, role FROM users';
        } else if (role === 'City Coordinator') {
            // Self + children + grandchildren
            query = `
                SELECT id, email, role FROM users 
                WHERE id = $1 
                OR roll_up_to_id = $1 
                OR roll_up_to_id IN (SELECT id FROM users WHERE roll_up_to_id = $1)
            `;
            params = [id];
        } else if (role === 'CHAARG leader') {
            // Self + children
            query = 'SELECT id, email, role FROM users WHERE id = $1 OR roll_up_to_id = $1';
            params = [id];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in assignable users route:', err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.post('/api/locations/:id/assign', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { volunteerId } = req.body;
    const locationId = req.params.id;
    const creatorId = req.user.id;
    const creatorRole = req.user.role;

    try {
        // Validation: Is the target user in the hierarchy?
        if (creatorRole !== 'Application Administrator') {
            let validQuery = '';
            if (creatorRole === 'City Coordinator') {
                validQuery = `
                    SELECT id FROM users 
                    WHERE id = $1 AND (
                        id = $2 OR roll_up_to_id = $2 
                        OR roll_up_to_id IN (SELECT id FROM users WHERE roll_up_to_id = $2)
                    )
                `;
            } else if (creatorRole === 'CHAARG leader') {
                validQuery = 'SELECT id FROM users WHERE id = $1 AND (id = $2 OR roll_up_to_id = $2)';
            }
            const validRes = await pool.query(validQuery, [volunteerId, creatorId]);
            if (validRes.rows.length === 0) {
                return res.status(403).json({ message: 'Target user is not in your hierarchy' });
            }
        }

        await pool.query(
            "UPDATE locations SET assigned_volunteer_id = $1, assigned_by_id = $2, assignment_type = 'Manual' WHERE id = $3",
            [volunteerId, creatorId, locationId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

mainRouter.get('/api/assignments/:userId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assignments WHERE user_id = $1', [req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in get assignments route:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Reporting (Phase 5) ---

mainRouter.get('/api/reporting/metrics', authenticateToken, async (req, res) => {
    const { role, id } = req.user;
    try {
        let userScopeQuery = '';
        let params = [];

        if (role === 'Application Administrator') {
            userScopeQuery = 'SELECT id, email, role, roll_up_to_id FROM users';
        } else if (role === 'City Coordinator') {
            userScopeQuery = `
                SELECT id, email, role, roll_up_to_id FROM users 
                WHERE roll_up_to_id = $1 
                OR roll_up_to_id IN (SELECT id FROM users WHERE roll_up_to_id = $1)
                OR id = $1
            `;
            params = [id];
        } else if (role === 'CHAARG leader') {
            userScopeQuery = 'SELECT id, email, role, roll_up_to_id FROM users WHERE roll_up_to_id = $1 OR id = $1';
            params = [id];
        } else {
            userScopeQuery = 'SELECT id, email, role, roll_up_to_id FROM users WHERE id = $1';
            params = [id];
        }

        const usersRes = await pool.query(userScopeQuery, params);
        const users = usersRes.rows;
        const userIds = users.map(u => u.id);

        if (userIds.length === 0) return res.json([]);

        const metricsRes = await pool.query(`
            SELECT 
                assigned_volunteer_id,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'AED Located and Mapped - Done') as mapped,
                COUNT(*) FILTER (WHERE status != 'AED Located and Mapped - Done' AND status != 'Pending') as in_progress,
                COUNT(*) FILTER (WHERE status = 'Pending') as pending
            FROM locations
            WHERE assigned_volunteer_id = ANY($1)
            GROUP BY assigned_volunteer_id
        `, [userIds]);

        const metricsMap = {};
        metricsRes.rows.forEach(row => {
            metricsMap[row.assigned_volunteer_id] = row;
        });

        const report = users.map(u => ({
            ...u,
            metrics: metricsMap[u.id] || { total: 0, mapped: 0, in_progress: 0, pending: 0 }
        }));

        res.json(report);
    } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
    }
});

// --- Backup/Restore Stubs ---
mainRouter.post('/api/admin/backup', authenticateToken, authorizeRoles('Application Administrator'), (req, res) => {
    res.json({ message: 'Backup initiated. (Stub)' });
});

mainRouter.post('/api/admin/restore', authenticateToken, authorizeRoles('Application Administrator'), (req, res) => {
    res.json({ message: 'Restore initiated. (Stub)' });
});

// Serve frontend static files
mainRouter.use(express.static(path.join(__dirname, '../client/dist'), { index: false }));
mainRouter.use((req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  try {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    // Inject the base tag and window variable
    const baseHref = BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`;
    const injection = `<base href="${baseHref}"><script>window.__BASE_PATH__ = "${BASE_PATH}";</script>`;
    indexHtml = indexHtml.replace('<head>', '<head>' + injection);
    res.send(indexHtml);
  } catch (err) {
    res.status(500).send('Error loading index.html');
  }
});

app.use(BASE_PATH, mainRouter);

// For development/direct access support, also mount on root or redirect
app.get('/', (req, res) => res.redirect(BASE_PATH));

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
