import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { db } from './db';

function getSmtpConfig() {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const pass = rawPass.replace(/\s+/g, '').trim();
  if (!user || !pass) {
    return null;
  }
  const host = (process.env.SMTP_HOST || '').trim() || 'smtp.gmail.com';
  const port = parseInt((process.env.SMTP_PORT || '465').trim(), 10) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true' : port === 465;
  const fromEmail = (process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL || '').trim();
  return { host, port, secure, user, pass, fromEmail };
}

function getResendInstance(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    return new Resend(apiKey);
  }
  return null;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(getSmtpConfig() || process.env.RESEND_API_KEY?.trim());
}

function sanitizeFromName(name: string): string {
  return (name || 'CampusConnect Portal')
    .replace(/"/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'CampusConnect Portal';
}

export interface TransactionalEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  allowTestingModeFallback?: boolean;
  testingModeHtmlPrefix?: string;
  testingModeSubject?: string;
  testingModeText?: string;
}

export interface TransactionalEmailResult {
  success: boolean;
  provider: 'smtp' | 'resend' | 'none';
  deliveredTo?: string;
  isTestingMode?: boolean;
  error?: string;
}

export async function sendTransactionalEmail(options: TransactionalEmailOptions): Promise<TransactionalEmailResult> {
  const recipient = options.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { success: false, provider: 'none', error: 'Invalid recipient email address.' };
  }

  const cleanFromName = sanitizeFromName(options.fromName || 'CampusConnect Security');

  // 1. Primary Transport: Standard SMTP (e.g., Gmail App Password, Brevo SMTP) — works without any custom domain
  const smtp = getSmtpConfig();
  if (smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const fromHeader = smtp.fromEmail || `"${cleanFromName}" <${smtp.user}>`;
      await transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log(`[SMTP Email] Successfully sent "${options.subject}" to ${recipient}`);
      return {
        success: true,
        provider: 'smtp',
        deliveredTo: recipient,
        isTestingMode: false,
      };
    } catch (smtpErr: any) {
      const errMsg = smtpErr?.message || String(smtpErr);
      console.error(`[SMTP Email Error] Failed to send to ${recipient}:`, errMsg);
      return {
        success: false,
        provider: 'smtp',
        error: errMsg,
      };
    }
  }

  // 2. Secondary Transport: Resend API (requires custom verified domain for external recipients)
  const resend = getResendInstance();
  if (!resend) {
    return {
      success: false,
      provider: 'none',
      error: 'Email delivery service is not configured (set SMTP_USER/SMTP_PASS or RESEND_API_KEY).',
    };
  }

  const fromHeader = (process.env.RESEND_FROM_EMAIL || '').trim() || `"${cleanFromName}" <onboarding@resend.dev>`;

  try {
    const sendResult = await resend.emails.send({
      from: fromHeader,
      to: recipient,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    if (!sendResult.error) {
      console.log(`[Resend Email] Successfully sent "${options.subject}" to ${recipient}`);
      return {
        success: true,
        provider: 'resend',
        deliveredTo: recipient,
        isTestingMode: false,
      };
    }

    const errObj = sendResult.error as any;
    const errMsg = errObj.message || JSON.stringify(sendResult.error);

    if (
      options.allowTestingModeFallback &&
      (errMsg.includes('only send testing emails to your own email address') || errObj.statusCode === 403)
    ) {
      const ownerMatch = errMsg.match(/\(([^@\s]+@[^@\s]+\.[^)\s]+)\)/);
      const fallbackRecipient = (process.env.RESEND_TEST_EMAIL || ownerMatch?.[1] || '2007anshdhankar@gmail.com').trim();
      console.log(`[Resend Testing Mode] Recipient '${recipient}' is restricted. Rerouting to verified owner (${fallbackRecipient})...`);

      const fallbackHtml = options.testingModeHtmlPrefix
        ? options.html.replace(/(<div class="content">)/i, `$1${options.testingModeHtmlPrefix}`)
        : options.html;

      const fallbackSend = await resend.emails.send({
        from: fromHeader,
        to: fallbackRecipient,
        subject: options.testingModeSubject || options.subject,
        text: options.testingModeText || options.text,
        html: fallbackHtml,
      });

      if (!fallbackSend.error) {
        console.log(`[Resend Testing Mode] Successfully dispatched email to verified owner: ${fallbackRecipient}`);
        return {
          success: true,
          provider: 'resend',
          deliveredTo: fallbackRecipient,
          isTestingMode: true,
        };
      }

      const fbErr = (fallbackSend.error as any)?.message || JSON.stringify(fallbackSend.error);
      console.warn(`[Resend Testing Mode] Fallback send error:`, fbErr);
      return {
        success: false,
        provider: 'resend',
        error: fbErr,
      };
    }

    return {
      success: false,
      provider: 'resend',
      error: errMsg,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('[Resend Error] Failed to send email via Resend:', errMsg);
    return {
      success: false,
      provider: 'resend',
      error: errMsg,
    };
  }
}

// Common email shell generator for professional aesthetic
function generateEmailHtml(options: {
  institutionName: string;
  headerTitle: string;
  badgeText?: string;
  contentHtml: string;
  actionUrl?: string;
  actionText?: string;
}) {
  const currentYear = new Date().getFullYear();
  const badgeHtml = options.badgeText 
    ? `<span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px;">${options.badgeText}</span>`
    : '';
    
  const buttonHtml = (options.actionUrl && options.actionText)
    ? `<div style="margin: 32px 0; text-align: center;">
         <a href="${options.actionUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 4px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1); text-transform: uppercase; letter-spacing: 0.05em;">${options.actionText}</a>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.headerTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px 32px;
      border-bottom: 1px solid #1e293b;
      text-align: left;
    }
    .header h1 {
      color: #ffffff;
      font-size: 20px;
      margin: 0;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      color: #94a3b8;
      font-size: 12px;
      margin: 4px 0 0 0;
      font-weight: 500;
    }
    .body {
      padding: 32px;
      color: #1e293b;
    }
    .body h2 {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
      letter-spacing: -0.3px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 6px;
    }
    .info-table td {
      padding: 12px 16px;
      font-size: 13px;
      line-height: 1.5;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-label {
      font-weight: 700;
      color: #64748b;
      width: 35%;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    .info-value {
      color: #0f172a;
      font-weight: 500;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer p {
      color: #94a3b8;
      font-size: 11px;
      margin: 0 0 8px 0;
      line-height: 1.6;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>CampusConnect</h1>
        <p>${options.institutionName}</p>
      </div>
      <div class="body">
        ${badgeHtml}
        ${options.contentHtml}
        ${buttonHtml}
      </div>
      <div class="footer">
        <p>&copy; ${currentYear} CampusConnect Portal Services. All rights reserved.</p>
        <p style="font-size: 10px; color: #cbd5e1;">This is an automated operational notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// Extremely robust and unified utility to extract, split, clean, and validate email addresses
function getSanitizedEmails(primary?: string, additional?: string): string[] {
  const emailsSet = new Set<string>();
  
  const processStr = (str?: string) => {
    if (!str) return;
    // Split by comma, semicolon, space, or newlines
    const parts = str.split(/[,\s;\n\r]+/);
    for (const part of parts) {
      const trimmed = part.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        emailsSet.add(trimmed);
      }
    }
  };

  processStr(primary);
  processStr(additional);

  return Array.from(emailsSet);
}

// Common sender utility supporting logs and real SMTP / Resend delivery
async function sendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  fromName: string;
}) {
  const sanitizedFromName = sanitizeFromName(options.fromName);

  // Clean, trim, validate and deduplicate the list of recipients using getSanitizedEmails
  const uniqueTo = getSanitizedEmails(options.to.join(','));

  // DIAGNOSTIC LOGS: Print the input and processed recipients arrays before the dispatch loop runs
  console.log(`[Diagnostic Notification Log] Preparing to dispatch email...`);
  console.log(`- Subject: "${options.subject}"`);
  console.log(`- Original Recipients Input [options.to]:`, options.to);
  console.log(`- Sanitized/Deduplicated Recipients [uniqueTo]:`, uniqueTo);

  if (uniqueTo.length === 0) {
    console.warn(`[Email Service Warning] No valid recipients defined for email: "${options.subject}"`);
    return;
  }

  if (isEmailDeliveryConfigured()) {
    for (const email of uniqueTo) {
      const result = await sendTransactionalEmail({
        to: email,
        subject: options.subject,
        html: options.html,
        fromName: sanitizedFromName,
      });
      if (!result.success) {
        console.error(`[Email Service Error] Failed to deliver email to ${email}:`, result.error);
      }
    }
  } else {
    // Sandbox log fallback
    console.log(`\n=============================================================`);
    console.log(`[EMAIL SANDBOX SIMULATION]`);
    console.log(`From: "${sanitizedFromName}"`);
    console.log(`To: ${uniqueTo.join(', ')}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`-------------------------------------------------------------`);
    console.log(`HTML Body Excerpt:\n${options.html.replace(/<[^>]*>/g, ' ').substring(0, 500).trim()}...`);
    console.log(`=============================================================\n`);
  }
}

/**
 * 1. COMPLAINT OR HELP REQUEST SUCCESSFULLY SUBMITTED
 * Sent immediately after a student submits a complaint or help request.
 * - Recipient: Student ONLY (Main Dept, Sub-Dept, and Admin emails disabled)
 */
export async function handleSubmissionNotifications(ticketId: string) {
  try {
    const ticket = await db.requests.findById(ticketId);
    if (!ticket) return;

    const inst = await db.institutions.findById(ticket.institutionId || 'default');
    const institutionName = inst?.name || 'CampusConnect University';

    const dept = await db.departments.findByKey(ticket.departmentKey, ticket.institutionId);
    const departmentName = dept?.name || ticket.departmentKey.toUpperCase();

    const student = await db.students.findById(ticket.studentId);
    
    const requestLabel = ticket.requestType === 'complaint' ? 'Complaint' : 'Help Request';
    const submissionDate = new Date(ticket.createdAt).toLocaleString();

    // -------------------------------------------------------------
    // A. Notify Student (Independent flow)
    // -------------------------------------------------------------
    try {
      if (student?.email) {
        const studentHtml = generateEmailHtml({
          institutionName,
          headerTitle: `${requestLabel} Submitted Successfully`,
          badgeText: 'Confirmation',
          contentHtml: `
            <h2>Hello ${student.name},</h2>
            <p>Your ${requestLabel.toLowerCase()} has been successfully registered on the CampusConnect ERP network. Our designated officers will review your submission shortly.</p>
            <table class="info-table">
              <tr><td class="info-label">Reference ID</td><td class="info-value"><strong>${ticket.id}</strong></td></tr>
              <tr><td class="info-label">Request Type</td><td class="info-value">${requestLabel}</td></tr>
              <tr><td class="info-label">Title / Subject</td><td class="info-value">${ticket.subject}</td></tr>
              <tr><td class="info-label">Main Department</td><td class="info-value">${departmentName}</td></tr>
              ${ticket.subDepartmentName ? `<tr><td class="info-label">Sub-Department</td><td class="info-value">${ticket.subDepartmentName}</td></tr>` : ''}
              <tr><td class="info-label">Submission Date</td><td class="info-value">${submissionDate}</td></tr>
              <tr><td class="info-label">Current Status</td><td class="info-value" style="color: #4f46e5; font-weight: 800;">PENDING / SUBMITTED</td></tr>
            </table>
            <p>You can track the progress of your application live in the student portal anytime.</p>
          `
        });

        await sendEmail({
          to: [student.email],
          subject: `[CampusConnect] Confirming Submission: ${ticket.subject} (#${ticket.id})`,
          html: studentHtml,
          fromName: 'CampusConnect Portal'
        });
      }
    } catch (studentEmailErr) {
      console.error('[Notification Pipeline Error] Failed to send student email:', studentEmailErr);
    }
  } catch (err) {
    console.error('[Notification Pipeline Error] General failure executing submission notifications:', err);
  }
}

/**
 * 2. COMPLAINT OR HELP REQUEST SUCCESSFULLY RESOLVED
 * Sent when a ticket status becomes 'resolved'.
 * - Recipient: Student ONLY (Main Dept, Sub-Dept, and Admin emails disabled)
 */
export async function handleResolutionNotifications(ticketId: string) {
  try {
    const ticket = await db.requests.findById(ticketId);
    if (!ticket) return;

    const inst = await db.institutions.findById(ticket.institutionId || 'default');
    const institutionName = inst?.name || 'CampusConnect University';

    const dept = await db.departments.findByKey(ticket.departmentKey, ticket.institutionId);
    const departmentName = dept?.name || ticket.departmentKey.toUpperCase();

    const student = await db.students.findById(ticket.studentId);
    
    const requestLabel = ticket.requestType === 'complaint' ? 'Complaint' : 'Help Request';
    const resolutionDate = new Date().toLocaleString();

    // A. Notify Student
    if (student?.email) {
      const studentHtml = generateEmailHtml({
        institutionName,
        headerTitle: `${requestLabel} Successfully Resolved`,
        badgeText: 'Resolved',
        contentHtml: `
          <h2>Hello ${student.name},</h2>
          <p>We are pleased to inform you that your ${requestLabel.toLowerCase()} has been successfully investigated and resolved by the department officers.</p>
          <table class="info-table" style="border: 1px solid #d1fae5; background-color: #ecfdf5;">
            <tr><td class="info-label">Reference ID</td><td class="info-value"><strong>${ticket.id}</strong></td></tr>
            <tr><td class="info-label">Request Type</td><td class="info-value">${requestLabel}</td></tr>
            <tr><td class="info-label">Department</td><td class="info-value">${departmentName}</td></tr>
            ${ticket.subDepartmentName ? `<tr><td class="info-label">Sub-Department</td><td class="info-value">${ticket.subDepartmentName}</td></tr>` : ''}
            <tr><td class="info-label">Resolution Time</td><td class="info-value">${resolutionDate}</td></tr>
            <tr><td class="info-label">Resolution Status</td><td class="info-value" style="color: #065f46; font-weight: 800;">RESOLVED / CLEARED</td></tr>
          </table>
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; tracking-wider; display: block; margin-bottom: 6px;">Official Officer Remarks</span>
            <p style="margin: 0; font-size: 13px; font-style: italic; color: #1e293b; line-height: 1.5;">"${ticket.remarks || 'No formal remarks provided.'}"</p>
          </div>
          <p>Please log in to your account and submit satisfaction ratings to close this docket completely.</p>
        `,
        actionText: 'Submit Portal Feedback',
        actionUrl: `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/student/dashboard`
      });

      await sendEmail({
        to: [student.email],
        subject: `[Resolved] Your CampusConnect Ticket has been Solved (#${ticket.id})`,
        html: studentHtml,
        fromName: 'CampusConnect Resolutions'
      });
    }
  } catch (err) {
    console.error('[Notification Pipeline Error] Failed executing resolution notifications:', err);
  }
}

/**
 * 3. COMPLAINT OR HELP REQUEST REOPENED
 * Reopening notification to department/admin has been removed to simplify notification system.
 * Student does not receive any notification when they themselves reopen the ticket.
 */
export async function handleReopenNotifications(ticketId: string, reason: string) {
  console.log(`[Notification System] Reopened ticket ${ticketId}. Department/admin email notifications are disabled.`);
}
