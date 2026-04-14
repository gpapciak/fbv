/**
 * Finca Buena Vida — Netlify Function: send-reminders
 * Sends dues reminder emails via Resend to owners with unpaid dues
 * due within the next 30 days, and overdue notices for past-due invoices.
 *
 * Invoke manually or schedule via Netlify Scheduled Functions:
 *   netlify.toml: [functions."send-reminders"] schedule = "0 9 * * 1"
 *   (every Monday at 9am UTC)
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

exports.handler = async (event) => {
  // Allow GET or POST (useful for manual invocation)
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'dues@fincabuenavidapanama.com';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  // Load all unpaid dues with due_date <= 30 days from now (includes overdue)
  const { data: duesToRemind, error } = await sb
    .from('dues')
    .select('*, owners(name, email)')
    .is('paid_at', null)
    .lte('due_date', in30Days.toISOString().split('T')[0]);

  if (error) {
    console.error('Error fetching dues:', error.message);
    return { statusCode: 500, body: 'Error fetching dues: ' + error.message };
  }

  if (!duesToRemind || duesToRemind.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, message: 'No reminders needed' }) };
  }

  let sent = 0;
  const errors = [];

  for (const due of duesToRemind) {
    if (!due.owners || !due.owners.email) continue;

    const ownerName = due.owners.name || 'Member';
    const ownerEmail = due.owners.email;
    const dueDate = new Date(due.due_date);
    const isOverdue = dueDate < today;
    const amount = '$' + (due.amount_cents / 100).toFixed(2);

    const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const subject = isOverdue
      ? `Overdue: Finca Buena Vida ${due.year} HOA Dues — ${amount}`
      : `Reminder: Finca Buena Vida ${due.year} HOA Dues Due ${dueDateFormatted}`;

    const statusLine = isOverdue
      ? `<span style="color:#991b1b;font-weight:600;">OVERDUE — was due ${dueDateFormatted}</span>`
      : `Due by <strong>${dueDateFormatted}</strong>`;

    const urgencyNote = isOverdue
      ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;color:#991b1b;font-size:14px;">
           Your ${due.year} dues payment is past due. Please pay as soon as possible to avoid any late fees.
         </p>`
      : `<p style="margin:0 0 16px;color:#374151;font-size:14px;">
           This is a friendly reminder that your ${due.year} annual dues are coming up.
           Paying on time helps us keep the community running smoothly.
         </p>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'DM Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a3a2a;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fdfbf7;letter-spacing:0.01em;">
                Finca Buena Vida
              </p>
              <p style="margin:0;font-size:13px;color:#9dd8d8;letter-spacing:0.04em;">
                Dolphin Bay · Panama
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fdfbf7;padding:32px 40px;border-radius:0 0 12px 12px;">

              <p style="margin:0 0 20px;font-size:16px;color:#1c2b20;">
                Dear ${ownerName},
              </p>

              ${urgencyNote}

              <!-- Dues summary box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f5f0e8;border-radius:8px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td style="font-size:13px;color:#6b7f6e;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:12px;">
                    Invoice Details
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="font-size:14px;color:#3a4f3e;padding:4px 0;">Year</td>
                  <td width="50%" style="font-size:14px;color:#1c2b20;font-weight:600;text-align:right;padding:4px 0;">${due.year}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#3a4f3e;padding:4px 0;border-top:1px solid #ede5d5;">Amount</td>
                  <td style="font-size:14px;color:#1c2b20;font-weight:600;text-align:right;padding:4px 0;border-top:1px solid #ede5d5;">${amount}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#3a4f3e;padding:4px 0;border-top:1px solid #ede5d5;">Status</td>
                  <td style="font-size:14px;text-align:right;padding:4px 0;border-top:1px solid #ede5d5;">${statusLine}</td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="https://fincabuenavidapanama.com/member/portal.html#dues"
                       style="display:inline-block;padding:14px 36px;background:#2a8080;color:#fdfbf7;
                              font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;
                              letter-spacing:0.02em;">
                      Pay Now in the Member Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:14px;color:#6b7f6e;line-height:1.6;">
                Prefer to pay by wire or check? Contact the board and we'll send you instructions.
                There is no processing fee for wire or check payments.
              </p>

              <p style="margin:0;font-size:13px;color:#a0714f;line-height:1.5;">
                If you've already sent payment, please disregard this message.
                It may take 1–2 business days for your payment to be reflected in the portal.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7f6e;line-height:1.5;">
                Finca Buena Vida HOA · Dolphin Bay, Isla San Cristóbal, Bocas del Toro, Panama<br />
                <a href="https://fincabuenavidapanama.com" style="color:#2a8080;text-decoration:none;">
                  fincabuenavidapanama.com
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: ownerEmail,
        subject,
        html,
      });
      sent++;
      console.log('Reminder sent:', { ownerEmail, dueId: due.id, year: due.year, isOverdue });
    } catch (emailErr) {
      console.error('Failed to send reminder to', ownerEmail, ':', emailErr.message);
      errors.push({ ownerEmail, error: emailErr.message });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sent,
      total: duesToRemind.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
  };
};
