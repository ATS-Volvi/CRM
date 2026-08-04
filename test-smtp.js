const nodemailer = require("nodemailer");

async function test() {
  const transporter = nodemailer.createTransport({
    host: "smtp.mailgun.org",
    port: 587,
    secure: false,
    auth: {
      user: "leads@inbound.volvitech.com",
      pass: process.env.TEST_PASS || "fill_this_in", // I don't have the pass, user said "(the mailgun-generated password, already set)"
    }
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("Connection verified!");
  } catch(e) {
    console.error("Failed to verify:", e);
  }
}
test();
