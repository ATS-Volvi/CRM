const nodemailer = require("nodemailer");

async function test() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "sheiksaud671@gmail.com",
      pass: "yeyimuafvriwliod",
    }
  });

  try {
    const info = await transporter.sendMail({
      from: '"Nexus CRM" <sheiksaud671@gmail.com>',
      to: "mohd.zeeshann110@gmail.com",
      subject: "Test from Nexus CRM Backend Script",
      text: "Hello Zeeshan, this is a test email sent directly from the CRM backend to confirm the SMTP credentials are working correctly."
    });
    console.log("Success:", info.messageId);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
