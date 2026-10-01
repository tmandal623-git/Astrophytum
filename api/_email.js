// api/_email.js
// Sends transactional emails via Nodemailer (works with Gmail, SMTP, SendGrid, etc.)
// (underscore prefix = shared module, not exposed as a Vercel route)
//
// Add to .env (EMAIL_* names are also accepted as a fallback):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=your@gmail.com
//   SMTP_PASS=your_app_password         ← Gmail: use App Password, not account password
//   EMAIL_FROM=CactusMart <your@gmail.com>
//
// For Gmail: Enable 2FA → Google Account → Security → App Passwords → Generate

import nodemailer from 'nodemailer';

// ── Transporter (created once, reused) ────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST ?? process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT ?? process.env.EMAIL_PORT ?? '587';
  const user = process.env.SMTP_USER ?? process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS ?? process.env.EMAIL_PASS;

  if (!host || !user) {
    console.warn('⚠️  No SMTP_HOST/SMTP_USER set — email notifications disabled.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port:   parseInt(port),
    secure: port === '465',   // true for port 465, false for 587
    auth:   { user, pass },
  });

  return _transporter;
}

// ── Common email wrapper ───────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`📧 [Email disabled] Would send to ${to}: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM ?? `CactusMart <${process.env.SMTP_USER ?? process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`📧 Email failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ── Email templates ───────────────────────────────────────────

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 600px; margin: 0 auto; background: #ffffff;
`;

function emailWrapper(content, footerNote = 'You received this email because you placed an order with us.') {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;">
    <div style="${baseStyle}">
      <!-- Header -->
      <div style="background:#1a4d2e;padding:24px 32px;text-align:center;">
        <span style="font-size:32px;">🌵</span>
        <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;letter-spacing:0.5px;">CactusMart</h1>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${content}
      </div>
      <!-- Footer -->
      <div style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
        <p style="color:#999;font-size:12px;margin:0;">
          CactusMart · Desert Plant Specialists<br>
          ${footerNote}
        </p>
      </div>
    </div>
  </body>
  </html>`;
}

// ── 1. Order Approved ─────────────────────────────────────────
export async function sendApprovalEmail({ to, firstName, orderNumber, total, items = [], transactionId }) {
  const itemRows = (items ?? []).map(item =>
    `<tr>
       <td style="padding:8px 0;color:#333;">${item.name}</td>
       <td style="padding:8px 0;color:#333;text-align:center;">×${item.quantity}</td>
       <td style="padding:8px 0;color:#333;text-align:right;">₹${(item.unitPrice * item.quantity).toFixed(2)}</td>
     </tr>`
  ).join('');

  const html = emailWrapper(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:64px;height:64px;background:#d4edda;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">✅</div>
      <h2 style="color:#1a4d2e;font-size:24px;margin:16px 0 8px;">Payment Approved!</h2>
      <p style="color:#666;font-size:15px;margin:0;">Hi ${firstName}, your payment has been verified and your order is confirmed.</p>
    </div>

    <div style="background:#f0fff4;border:1px solid #b2dfdb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Order Number</span>
        <span style="color:#1a4d2e;font-size:16px;font-weight:700;font-family:monospace;">${orderNumber}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Transaction ID</span>
        <span style="color:#555;font-size:13px;font-family:monospace;">${transactionId ?? '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Paid</span>
        <span style="color:#1a4d2e;font-size:18px;font-weight:700;">₹${Number(total).toFixed(2)}</span>
      </div>
    </div>

    ${itemRows ? `
    <h3 style="color:#333;font-size:14px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Items Ordered</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="border-bottom:1px solid #eee;">
          <th style="padding:8px 0;text-align:left;color:#999;font-size:12px;font-weight:600;">ITEM</th>
          <th style="padding:8px 0;text-align:center;color:#999;font-size:12px;font-weight:600;">QTY</th>
          <th style="padding:8px 0;text-align:right;color:#999;font-size:12px;font-weight:600;">TOTAL</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>` : ''}

    <div style="background:#e8f5e9;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
      <p style="color:#2e7d32;font-size:14px;margin:0;">
        🌵 Your cacti are being carefully packed and will be shipped within <strong>1–3 business days</strong>.
      </p>
    </div>

    <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
      Thank you for shopping with CactusMart! If you have any questions, reply to this email.
    </p>
  `);

  return sendEmail({
    to,
    subject: `✅ Payment Confirmed — Order ${orderNumber} | CactusMart`,
    text: `Hi ${firstName}, your payment for order ${orderNumber} has been approved. Total: ₹${Number(total).toFixed(2)}. Your cacti will be shipped within 1-3 business days.`,
    html,
  });
}

// ── 2. Order Rejected ─────────────────────────────────────────
export async function sendRejectionEmail({ to, firstName, orderNumber, total, rejectionNote, transactionId }) {
  const html = emailWrapper(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:64px;height:64px;background:#fdecea;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">❌</div>
      <h2 style="color:#c62828;font-size:24px;margin:16px 0 8px;">Payment Not Verified</h2>
      <p style="color:#666;font-size:15px;margin:0;">Hi ${firstName}, we were unable to verify your Google Pay payment for order ${orderNumber}.</p>
    </div>

    <div style="background:#fff8f8;border:1px solid #ffcdd2;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Order Number</span>
        <span style="color:#c62828;font-size:15px;font-weight:700;font-family:monospace;">${orderNumber}</span>
      </div>
      ${transactionId ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Transaction ID Provided</span>
        <span style="color:#555;font-size:13px;font-family:monospace;">${transactionId}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#555;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</span>
        <span style="color:#555;font-size:15px;font-weight:600;">₹${Number(total).toFixed(2)}</span>
      </div>
    </div>

    ${rejectionNote ? `
    <div style="background:#fff3e0;border-left:4px solid #ff9800;border-radius:4px;padding:16px;margin-bottom:24px;">
      <p style="color:#e65100;font-size:13px;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
      <p style="color:#5d4037;font-size:14px;margin:0;line-height:1.6;">${rejectionNote}</p>
    </div>` : ''}

    <div style="background:#f5f5f5;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="color:#333;font-size:14px;font-weight:600;margin:0 0 8px;">What to do next:</p>
      <ul style="color:#555;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
        <li>Double-check your UPI app for the correct Transaction ID / UTR number</li>
        <li>Ensure the payment was sent to the correct UPI ID</li>
        <li>Contact us with your bank reference number for manual resolution</li>
      </ul>
    </div>

    <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
      Please reply to this email with your correct transaction details and we will re-verify your payment promptly.
      We apologise for any inconvenience caused.
    </p>
  `);

  return sendEmail({
    to,
    subject: `❌ Payment Verification Failed — Order ${orderNumber} | CactusMart`,
    text: `Hi ${firstName}, we could not verify your payment for order ${orderNumber}. Reason: ${rejectionNote ?? 'Not specified'}. Please contact us with your transaction details.`,
    html,
  });
}

// ── 3. Password Reset ─────────────────────────────────────────
export async function sendPasswordResetEmail({ to, username, resetUrl, expiresMinutes }) {
  const html = emailWrapper(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:64px;height:64px;background:#fff3e0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">🔑</div>
      <h2 style="color:#1a4d2e;font-size:24px;margin:16px 0 8px;">Reset your password</h2>
      <p style="color:#666;font-size:15px;margin:0;">Hi ${username}, we received a request to reset your CactusMart password.</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#1a4d2e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">
        Choose a new password
      </a>
    </div>

    <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 16px;">
      This link expires in <strong>${expiresMinutes} minutes</strong> and can only be used once.
    </p>
    <p style="color:#999;font-size:12px;line-height:1.6;margin:0 0 16px;word-break:break-all;">
      If the button doesn't work, copy this link into your browser:<br>
      <a href="${resetUrl}" style="color:#1a4d2e;">${resetUrl}</a>
    </p>
    <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">
      Didn't ask for this? You can safely ignore this email — your password won't change.
    </p>
  `, 'You received this email because a password reset was requested for your account.');

  return sendEmail({
    to,
    subject: '🔑 Reset your CactusMart password',
    text: `Hi ${username}, reset your CactusMart password here (valid for ${expiresMinutes} minutes): ${resetUrl}  — If you didn't request this, ignore this email.`,
    html,
  });
}
