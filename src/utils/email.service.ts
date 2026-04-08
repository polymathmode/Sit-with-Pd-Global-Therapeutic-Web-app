import transporter from '../config/mailer';

const FROM = `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`;

// ── Program Purchase Confirmation ─────────────────────────────────────────────
export const sendProgramPurchaseEmail = async (
  email: string,
  name: string,
  programTitle: string
) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You're enrolled in "${programTitle}"!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name}, welcome to the program! 🎉</h2>
        <p>You have successfully purchased <strong>${programTitle}</strong>.</p>
        <p>Head to your dashboard to start learning right away.</p>
        <a href="${process.env.CLIENT_URL}/dashboard/programs" 
           style="background:#2a7c6f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          Access Program
        </a>
        <p style="margin-top:32px;color:#888;font-size:12px;">
          If you have any questions, reply to this email.
        </p>
      </div>
    `,
  });
};

// ── Camp Registration Confirmation ───────────────────────────────────────────
export const sendCampRegistrationEmail = async (
  email: string,
  name: string,
  campTitle: string,
  campDate: Date
) => {
  const formattedDate = campDate.toDateString();
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Camp Registration Confirmed – ${campTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're registered, ${name}! ⛺</h2>
        <p>Your spot at <strong>${campTitle}</strong> is confirmed.</p>
        <p><strong>Start Date:</strong> ${formattedDate}</p>
        <p>View your registration details in your dashboard.</p>
        <a href="${process.env.CLIENT_URL}/dashboard/bookings" 
           style="background:#2a7c6f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          View Booking
        </a>
      </div>
    `,
  });
};

// ── Consultation: Paystack link after Cal.com booking (PENDING_PAYMENT) ───────
export const sendConsultationPaymentLinkEmail = async (
  email: string,
  name: string,
  serviceTitle: string,
  paymentUrl: string,
  expiresInSeconds: number
) => {
  const minutes = Math.round(expiresInSeconds / 60);
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Complete payment for your consultation – ${serviceTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name},</h2>
        <p>Your session time is held. Please complete payment within <strong>${minutes} minutes</strong> to confirm.</p>
        <p>If payment is not received in time, your Cal.com booking will be cancelled automatically.</p>
        <a href="${paymentUrl}" 
           style="background:#2a7c6f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          Pay now
        </a>
        <p style="margin-top:24px;color:#888;font-size:12px;">
          This link is sent for your consultation booking. If you did not book a session, ignore this email.
        </p>
      </div>
    `,
  });
};

// ── Consultation Booking Confirmation ────────────────────────────────────────
export const sendConsultationBookingEmail = async (
  email: string,
  name: string,
  serviceTitle: string,
  preferredDate?: Date
) => {
  const dateText = preferredDate
    ? `<p><strong>Requested Date:</strong> ${preferredDate.toDateString()}</p>`
    : `<p>We will reach out to confirm your session time.</p>`;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Consultation Booking Received – ${serviceTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking received, ${name}! 📅</h2>
        <p>Your booking for <strong>${serviceTitle}</strong> has been received.</p>
        ${dateText}
        <p>We'll send you a confirmation once the session is scheduled.</p>
        <a href="${process.env.CLIENT_URL}/dashboard/bookings" 
           style="background:#2a7c6f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          View Booking
        </a>
      </div>
    `,
  });
};

// ── Email Verification ────────────────────────────────────────────────────────
export const sendEmailVerificationEmail = async (
  email: string,
  name: string,
  verificationToken: string
) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Confirm your email</h2>
        <p>Hi ${name}, thanks for signing up. Please verify your email address by clicking the button below.</p>
        <p>This link expires in <strong>48 hours</strong>.</p>
        <a href="${verifyUrl}" 
           style="background:#2a7c6f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          Verify email
        </a>
        <p style="margin-top:24px;color:#888;font-size:12px;">
          If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  });
};

// ── Password Reset Email ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetToken: string
) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${name}, we received a request to reset your password.</p>
        <p>Click the button below. This link expires in <strong>15 minutes</strong>.</p>
        <a href="${resetUrl}" 
           style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#888;font-size:12px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};
