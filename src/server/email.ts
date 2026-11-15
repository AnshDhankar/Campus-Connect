import { Resend } from 'resend';
import { db } from './db';

// Simple helper to get Resend instance safely
function getResendInstance(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new Resend(apiKey);
  }
  return null;
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

// Common sender utility supporting logs logging and real Resend delivery
async function sendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  fromName: string;
}) {
  const resend = getResendInstance();
  // Sanitize fromName to remove double quotes, parentheses, and other characters that can trigger email firewall rejections
  const sanitizedFromName = options.fromName
    .replace(/"/g, '')
    .replace(/[()]/g, ' ') // Replace parentheses with spaces to prevent malformed header rejection
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Keep only letters, numbers, spaces, and hyphens
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
  const fromAddress = `"${sanitizedFromName}" <onboarding@resend.dev>`;
  
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

  if (resend) {
    for (const email of uniqueTo) {
      try {
        await resend.emails.send({
          from: fromAddress,
          to: email,
          subject: options.subject,
          html: options.html,
        });
        console.log(`[Email Service] Successfully sent email to ${email} regarding "${options.subject}"`);
      } catch (err: any) {
        console.error(`[Email Service Error] Failed to deliver email to ${email}:`, err);
      }
    }
  } else {
    // Sandbox log fallback
    console.log(`\n=============================================================`);
    console.log(`[EMAIL SANDBOX SIMULATION]`);
    console.log(`From: ${fromAddress}`);
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
        actionUrl: `${process.env.APP_URL || 'http://localhost:3000'}/student/dashboard`
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
