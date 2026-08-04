const crypto = require('crypto');
const appSecret = process.env.INSTAGRAM_APP_SECRET;

const payload = {
  "object": "instagram",
  "entry": [
    {
      "id": "123456789",
      "time": Date.now(),
      "messaging": [
        {
          "sender": { "id": "sauddddd.d_id" },
          "recipient": { "id": "volvitech2_id" },
          "timestamp": Date.now(),
          "message": {
            "mid": "mid.123456789",
            "text": "Simulated test message from automated test"
          }
        }
      ]
    }
  ]
};

const rawBody = JSON.stringify(payload);
const hmac = crypto.createHmac("sha256", appSecret);
hmac.update(rawBody);
const signature = "sha1=" + hmac.digest("hex"); // Wait, Meta uses sha256? No, the code checks x-hub-signature-256
// let's do sha256
const hmac256 = crypto.createHmac("sha256", appSecret);
hmac256.update(rawBody);
const signature256 = "sha256=" + hmac256.digest("hex");

async function run() {
  const fetch = require('node-fetch');
  const res = await fetch("https://crm-k8g4.onrender.com/api/v1/instagram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": signature256
    },
    body: rawBody
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
run();
