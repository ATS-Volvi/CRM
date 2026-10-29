#!/usr/bin/env bash
set -e

# Kill any existing process on port 5506
PID=$(lsof -ti:5506 || true)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi

nohup env PORT=5506 DATABASE_URL="postgres://localhost:5432/render_neon_playwright_test_db" node --env-file="$HOME/.site-inspection-bucket.env" backend/build/backend/index.js > /tmp/crm-backend.log 2>&1 &
disown || true

# Wait for backend to be ready
for i in {1..30}; do
  if curl -s http://127.0.0.1:5506/api/v1/site-inspections/master >/dev/null 2>&1; then
    echo "Backend is up on port 5506"
    exit 0
  fi
  sleep 0.5
done

echo "Backend failed to start"
exit 1
