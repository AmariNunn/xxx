// Simple test script to verify MailerSend email functionality
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_TOKEN,
});

async function testEmail() {
  try {
    console.log("Testing MailerSend email service...");
    
    const sender = new Sender("noreply@trial-351ndgwpz9v4zqx8.mlsender.net", "Sky IQ");
    const recipients = [new Recipient("amari@buildrightweb.org", "Test User")];

    const emailParams = new EmailParams()
      .setFrom(sender)
      .setTo(recipients)
      .setSubject("Sky IQ Email Service Test")
      .setHtml(`
        <h2>Email Service Test</h2>
        <p>This is a test email from Sky IQ to verify that email sending is working correctly.</p>
        <p>If you received this email, the MailerSend integration is properly configured.</p>
      `)
      .setText("Email Service Test: This is a test email from Sky IQ to verify that email sending is working correctly.");

    const result = await mailerSend.email.send(emailParams);
    console.log("Email sent successfully!", result);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

testEmail();