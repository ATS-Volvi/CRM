#!/bin/bash
# Start backend in background
cd backend
npm run dev &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 10

echo "Simulating a new public lead creation (triggers assignment notification)..."
curl -s -X POST http://localhost:5505/api/v1/public/leads \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John", "lastName":"Doe", "email":"john@example.com", "company":"Acme Corp"}'
echo -e "\n"

echo "Querying the database for Notifications..."
sqlite3 ../dev.sqlite "SELECT id, userId, type, title, message FROM Notifications ORDER BY createdAt DESC LIMIT 1;"

# Kill the server
kill $SERVER_PID
