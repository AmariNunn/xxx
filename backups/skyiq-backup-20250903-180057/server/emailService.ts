if (!process.env.MAILERSEND_API_TOKEN) {
  throw new Error("MAILERSEND_API_TOKEN environment variable must be set");
}

const MAILERSEND_API_URL = "https://api.mailersend.com/v1/email";
const SENDER_EMAIL = "info@skyiq.app";
const SENDER_NAME = "Sky IQ";

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const emailData = {
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      to: [
        {
          email: options.to,
          name: options.toName || "User"
        }
      ],
      subject: options.subject,
      html: options.html,
      text: options.text || ""
    };

    console.log(`Sending email to ${options.to} via MailerSend...`);

    const response = await fetch(MAILERSEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${process.env.MAILERSEND_API_TOKEN}`
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MailerSend API error:", response.status, errorText);
      return false;
    }

    // MailerSend returns 202 with empty body on success
    console.log(`Email sent successfully to ${options.to} (Status: ${response.status})`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, name: string, verificationToken: string): Promise<boolean> {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Sky IQ Account</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Sky IQ</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for signing up for Sky IQ! To complete your registration and start managing your AI call intelligence, please verify your email address.</p>
          <p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This verification link will expire in 24 hours.</p>
          <p>If you didn't create an account with Sky IQ, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to Sky IQ!
    
    Hi ${name},
    
    Thank you for signing up for Sky IQ! To complete your registration, please verify your email address by clicking the link below:
    
    ${verificationUrl}
    
    This verification link will expire in 24 hours.
    
    If you didn't create an account with Sky IQ, please ignore this email.
    
    © ${new Date().getFullYear()} Sky IQ. All rights reserved.
  `;

  return sendEmail({
    to: email,
    toName: name,
    subject: "Verify Your Sky IQ Account",
    html,
    text
  });
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Sky IQ Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>You requested to reset your Sky IQ password. Click the button below to create a new password:</p>
          <p>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This reset link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Reset Your Sky IQ Password
    
    Hi ${name},
    
    You requested to reset your Sky IQ password. Click the link below to create a new password:
    
    ${resetUrl}
    
    This reset link will expire in 1 hour for security reasons.
    
    If you didn't request a password reset, please ignore this email and your password will remain unchanged.
    
    © ${new Date().getFullYear()} Sky IQ. All rights reserved.
  `;

  return sendEmail({
    to: email,
    toName: name,
    subject: "Reset Your Sky IQ Password",
    html,
    text
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/login`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Sky IQ</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        .feature { margin: 15px 0; padding: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Sky IQ!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Your Sky IQ account has been successfully verified! You're now ready to start using our AI call intelligence platform.</p>
          
          <h3>What you can do now:</h3>
          <div class="feature">📞 Set up your business profile and call preferences</div>
          <div class="feature">📊 Track and analyze your phone conversations</div>
          <div class="feature">🤖 Connect with Railway AI for automated call handling</div>
          <div class="feature">📈 View detailed call analytics and reports</div>
          
          <p>
            <a href="${loginUrl}" class="button">Get Started</a>
          </p>
          
          <p>If you have any questions or need help getting started, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Sky IQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    toName: name,
    subject: "Welcome to Sky IQ - You're All Set!",
    html
  });
}