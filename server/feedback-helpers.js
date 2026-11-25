import nodemailer from 'nodemailer';

export const DEFAULT_SMTP_HOST = '192.168.205.12';
export const DEFAULT_SMTP_PORT = 25;
export const DEFAULT_SMTP_FROM = 'noreply@cardiaccrusade.org';

export function validateFeedbackMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    const err = new Error('Feedback message is required');
    err.status = 400;
    throw err;
  }
  return message.trim();
}

export function buildSmtpTransportConfig(settings = {}) {
  const host = (settings.smtp_host || '').trim() || DEFAULT_SMTP_HOST;
  const parsedPort = Number.parseInt(settings.smtp_port, 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : DEFAULT_SMTP_PORT;
  const from = (settings.smtp_from || '').trim() || DEFAULT_SMTP_FROM;
  const user = (settings.smtp_user || '').trim();
  const pass = settings.smtp_pass || '';

  const transportOptions = {
    host,
    port,
    secure: port === 465,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  };

  if (user) {
    transportOptions.auth = { user, pass };
  }

  return { transportOptions, from };
}

export async function sendFeedbackNotification({
  pool,
  feedback,
  submitterRole,
  createTransport = nodemailer.createTransport,
}) {
  try {
    const settingsRes = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('smtp_host', 'smtp_port', 'smtp_from', 'smtp_user', 'smtp_pass')"
    );
    const settingsMap = {};
    for (const row of settingsRes.rows) {
      settingsMap[row.key] = row.value;
    }

    const adminsRes = await pool.query(
      "SELECT email FROM users WHERE role = 'Application Administrator' AND email IS NOT NULL"
    );
    const adminEmails = adminsRes.rows
      .map((row) => (row.email || '').trim())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return {
        emailSent: false,
        emailError: 'No Application Administrator email addresses configured',
      };
    }

    const { transportOptions, from } = buildSmtpTransportConfig(settingsMap);
    const transporter = createTransport(transportOptions);

    const submitterLabel = feedback.user_name
      ? `${feedback.user_name} (${feedback.user_email})`
      : feedback.user_email;

    await transporter.sendMail({
      from,
      to: adminEmails.join(', '),
      replyTo: feedback.user_email,
      subject: `Cardiac Crusade Feedback from ${submitterLabel}`,
      text: [
        `New feedback submitted in Cardiac Crusade`,
        ``,
        `From: ${submitterLabel}`,
        `Role: ${submitterRole || 'Unknown'}`,
        `Feedback ID: ${feedback.id}`,
        `Submitted At: ${feedback.created_at}`,
        ``,
        `Message:`,
        feedback.message,
      ].join('\n'),
    });

    return { emailSent: true, emailError: null };
  } catch (err) {
    return {
      emailSent: false,
      emailError: err?.message || 'Failed to send feedback email',
    };
  }
}
