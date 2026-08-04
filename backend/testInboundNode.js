const http = require('http');

const data = JSON.stringify({
  From: "whatsapp:+919632217484",
  Body: "Hello! This is a test inbound reply from +919632217484.",
  MessageSid: "SM_test_inbound_" + Date.now(),
  ProfileName: "Swastik"
});

const req = http.request({
  hostname: 'localhost',
  port: 5506,
  path: '/api/v1/whatsapp/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, responseData));
});

req.on('error', (e) => console.error('Error:', e));
req.write(data);
req.end();
