#!/usr/bin/env bash
# ==============================================================================
# Render Deployment Read-Only Smoke Test Script
#
# Checks basic health, database connectivity, static SPA frontend delivery,
# and Site Inspection endpoints against a target URL.
#
# Usage:
#   ./scripts/render-smoke.sh https://<your-service>.onrender.com
#   SMOKE_JWT="<token>" ./scripts/render-smoke.sh https://<your-service>.onrender.com
# ==============================================================================

set -euo pipefail

BASE_URL="${1:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <BASE_URL>"
  echo "Example: $0 https://crm-service.onrender.com"
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# Refuse placeholder URLs (safe across bash and zsh)
case "$BASE_URL" in
  *YOUR*|*\.\.\.*|*\<*|*\>*|*example.com*)
    echo "FAIL: Placeholder or example URL detected in BASE_URL: '$BASE_URL'"
    echo "Please provide a valid, deployed service URL."
    exit 1
    ;;
esac

if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
  echo "FAIL: BASE_URL must begin with http:// or https://"
  exit 1
fi

echo "=================================================================="
echo "Nexus CRM Render Smoke Test"
echo "Target Base URL: $BASE_URL"
echo "=================================================================="

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

report_pass() {
  local check_name="$1"
  local detail="${2:-}"
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  if [[ -n "$detail" ]]; then
    printf "  [PASS] %-40s (%s)\n" "$check_name" "$detail"
  else
    printf "  [PASS] %s\n" "$check_name"
  fi
}

report_fail() {
  local check_name="$1"
  local detail="${2:-}"
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  if [[ -n "$detail" ]]; then
    printf "  [FAIL] %-40s (%s)\n" "$check_name" "$detail"
  else
    printf "  [FAIL] %s\n" "$check_name"
  fi
}

# ------------------------------------------------------------------------------
# Check 1: Health endpoint (/api/health)
# ------------------------------------------------------------------------------
HEALTH_STATUS_CODE=$(curl -s -o /tmp/smoke_health.json -w "%{http_code}" "$BASE_URL/api/health" || echo "000")
if [[ "$HEALTH_STATUS_CODE" == "200" ]] && grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' /tmp/smoke_health.json 2>/dev/null; then
  report_pass "GET /api/health" "HTTP 200, status: ok"
else
  report_fail "GET /api/health" "Expected HTTP 200 with status ok, got $HEALTH_STATUS_CODE"
fi
rm -f /tmp/smoke_health.json

# ------------------------------------------------------------------------------
# Check 2: Database health endpoint (/api/db-health)
# ------------------------------------------------------------------------------
DB_STATUS_CODE=$(curl -s -o /tmp/smoke_db.json -w "%{http_code}" "$BASE_URL/api/db-health" || echo "000")
if [[ "$DB_STATUS_CODE" == "200" ]] && grep -q '"status"[[:space:]]*:[[:space:]]*"connected"' /tmp/smoke_db.json 2>/dev/null; then
  report_pass "GET /api/db-health" "HTTP 200, status: connected"
else
  report_fail "GET /api/db-health" "Expected HTTP 200 with status connected, got $DB_STATUS_CODE"
fi
rm -f /tmp/smoke_db.json

# ------------------------------------------------------------------------------
# Check 3: Frontend SPA delivery (GET /)
# ------------------------------------------------------------------------------
ROOT_STATUS_CODE=$(curl -s -L -o /tmp/smoke_root.html -w "%{http_code}" "$BASE_URL/" || echo "000")
if [[ "$ROOT_STATUS_CODE" == "200" ]] && grep -qi '<!doctype html\|<html' /tmp/smoke_root.html 2>/dev/null; then
  report_pass "GET / (Frontend SPA index)" "HTTP 200, valid HTML returned"
else
  report_fail "GET / (Frontend SPA index)" "Expected HTTP 200 HTML page, got $ROOT_STATUS_CODE"
fi
rm -f /tmp/smoke_root.html

# ------------------------------------------------------------------------------
# Check 4: Unauthenticated protection on Site Inspection Master data (GET /api/v1/site-inspections/master)
# ------------------------------------------------------------------------------
AUTH_STATUS_CODE=$(curl -s -o /tmp/smoke_auth.json -w "%{http_code}" "$BASE_URL/api/v1/site-inspections/master" || echo "000")
if [[ "$AUTH_STATUS_CODE" == "401" ]]; then
  report_pass "GET /api/v1/site-inspections/master (Unauthenticated)" "HTTP 401 Unauthorized"
else
  report_fail "GET /api/v1/site-inspections/master (Unauthenticated)" "Expected HTTP 401, got $AUTH_STATUS_CODE"
fi
rm -f /tmp/smoke_auth.json

# ------------------------------------------------------------------------------
# Optional Authenticated Checks (if SMOKE_JWT environment variable is set)
# ------------------------------------------------------------------------------
if [[ -n "${SMOKE_JWT:-}" ]]; then
  echo "------------------------------------------------------------------"
  echo "Running authenticated checks (SMOKE_JWT provided)..."

  # Check 5: Authenticated master data returns bases and facilities
  AUTH_MASTER_CODE=$(curl -s -o /tmp/smoke_master.json -w "%{http_code}" \
    -H "Authorization: Bearer $SMOKE_JWT" \
    "$BASE_URL/api/v1/site-inspections/master" || echo "000")

  if [[ "$AUTH_MASTER_CODE" == "200" ]] && grep -q '"bases"' /tmp/smoke_master.json 2>/dev/null && grep -q '"facilities"' /tmp/smoke_master.json 2>/dev/null; then
    report_pass "GET /api/v1/site-inspections/master (Authenticated)" "HTTP 200, bases & facilities present"
  else
    report_fail "GET /api/v1/site-inspections/master (Authenticated)" "Expected HTTP 200 with bases/facilities, got $AUTH_MASTER_CODE"
  fi
  rm -f /tmp/smoke_master.json

  # Check 6: Authenticated leads endpoint returns 200
  LEADS_CODE=$(curl -s -o /tmp/smoke_leads.json -w "%{http_code}" \
    -H "Authorization: Bearer $SMOKE_JWT" \
    "$BASE_URL/api/v1/leads" || echo "000")

  if [[ "$LEADS_CODE" == "200" ]]; then
    report_pass "GET /api/v1/leads (Authenticated)" "HTTP 200 OK"
  else
    report_fail "GET /api/v1/leads (Authenticated)" "Expected HTTP 200, got $LEADS_CODE"
  fi
  rm -f /tmp/smoke_leads.json
else
  echo "------------------------------------------------------------------"
  echo "Notice: SMOKE_JWT not set. Authenticated endpoint checks skipped."
  echo "To run authenticated checks: SMOKE_JWT=\"<token>\" $0 $BASE_URL"
fi

echo "=================================================================="
echo "Summary: $PASSED_CHECKS/$TOTAL_CHECKS checks passed."
if [[ "$FAILED_CHECKS" -gt 0 ]]; then
  echo "Result: FAILED ($FAILED_CHECKS check(s) failed)"
  exit 1
else
  echo "Result: ALL CHECKS PASSED"
  exit 0
fi
