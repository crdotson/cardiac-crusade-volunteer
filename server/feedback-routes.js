import express from 'express';
import { sendFeedbackNotification, validateFeedbackMessage } from './feedback-helpers.js';

export function createFeedbackRouter({ pool, authenticateToken, authorizeRoles, createTransport }) {
  const router = express.Router();

  router.get('/api/feedback', authenticateToken, async (req, res) => {
    try {
      const isAdmin = req.user.role === 'Application Administrator';
      const result = isAdmin
        ? await pool.query('SELECT * FROM feedback ORDER BY created_at DESC')
        : await pool.query('SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      res.json(result.rows);
    } catch (err) {
      console.error('Error in route:', req.path, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/feedback', authenticateToken, async (req, res) => {
    try {
      const message = validateFeedbackMessage(req.body?.message);

      const userRes = await pool.query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [req.user.id]
      );
      const userRecord = userRes.rows[0] || {
        id: req.user.id,
        email: req.user.email,
        name: null,
        role: req.user.role,
      };

      const insertRes = await pool.query(
        'INSERT INTO feedback (user_id, user_email, user_name, message) VALUES ($1, $2, $3, $4) RETURNING *',
        [userRecord.id, userRecord.email, userRecord.name || null, message]
      );
      const createdFeedback = insertRes.rows[0];

      const { emailSent, emailError } = await sendFeedbackNotification({
        pool,
        feedback: createdFeedback,
        submitterRole: userRecord.role || req.user.role,
        createTransport,
      });

      const updateRes = await pool.query(
        'UPDATE feedback SET email_sent = $1, email_error = $2 WHERE id = $3 RETURNING *',
        [emailSent, emailError, createdFeedback.id]
      );

      res.status(201).json({
        success: true,
        feedback: updateRes.rows[0] || { ...createdFeedback, email_sent: emailSent, email_error: emailError },
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      console.error('Error in route:', req.path, err);
      res.status(500).json({ error: err.message });
    }
  });

  router.patch(
    '/api/feedback/:id',
    authenticateToken,
    authorizeRoles('Application Administrator'),
    async (req, res) => {
      const { status } = req.body || {};
      if (status !== 'New' && status !== 'Reviewed') {
        return res.status(400).json({ message: "Status must be 'New' or 'Reviewed'" });
      }

      try {
        const result = await pool.query(
          'UPDATE feedback SET status = $1 WHERE id = $2 RETURNING *',
          [status, req.params.id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Feedback entry not found' });
        }
        res.json(result.rows[0]);
      } catch (err) {
        console.error('Error in route:', req.path, err);
        res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}
