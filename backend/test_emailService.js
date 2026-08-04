require('dotenv').config();

// Override local env with what the user has in Render
process.env.SMTP_HOST = "smtp.gmail.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "sheiksaud671@gmail.com";
process.env.SMTP_PASS = "yeyimuafvriwliod";
process.env.SMTP_FROM = '"Nexus CRM" <sheiksaud671@gmail.com>';

const { sendEmail } = require('./src/services/emailService');

async function test() {
  const info = await sendEmail(
    "mohd.zeeshann110@gmail.com", 
    "Test from emailService", 
    "<p>Testing if emailService sends successfully.</p>"
  );
  if (info) {
    console.log("Success ID:", info.messageId);
  } else {
    console.log("Failed to send.");
  }
}

test();
