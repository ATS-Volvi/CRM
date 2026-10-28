#!/usr/bin/env bash
# ==============================================================================
# scripts/run-site-inspection-preview-test.sh
#
# Automated E2E test runner for Site Inspection Preview Deployments.
# Compatible with both Bash and Zsh.
#
# Usage:
#   ./scripts/run-site-inspection-preview-test.sh <PREVIEW_URL> <BUCKET_ENDPOINT_URL> <FRONTEND_ORIGIN>
# Or via environment variables:
#   PREVIEW_URL=... BUCKET_ENDPOINT_URL=... FRONTEND_ORIGIN=... ./scripts/run-site-inspection-preview-test.sh
# ==============================================================================
set -euo pipefail

# Trap to guarantee admin credentials are NEVER left in environment on exit or error
cleanup_admin() {
  unset ADMIN_EMAIL ADMIN_PASSWORD 2>/dev/null || true
}
trap cleanup_admin EXIT INT TERM

# Safe TTY input helpers that work in all shells (bash, zsh, dash)
read_tty_plain() {
  local prompt="$1"
  local varname="$2"
  printf "%s" "$prompt" > /dev/tty
  IFS= read -r "$varname" < /dev/tty
  eval "$varname=\$$varname"
}

read_tty_hidden() {
  local prompt="$1"
  local varname="$2"
  printf "%s" "$prompt" > /dev/tty
  stty -echo < /dev/tty
  IFS= read -r "$varname" < /dev/tty
  stty echo < /dev/tty
  printf "\n" > /dev/tty
  eval "$varname=\$$varname"
}

# 1. Parameter resolution & placeholder validation
PREVIEW_URL="${1:-${PREVIEW_URL:-}}"
BUCKET_ENDPOINT_URL="${2:-${BUCKET_ENDPOINT_URL:-}}"
FRONTEND_ORIGIN="${3:-${FRONTEND_ORIGIN:-}}"

MISSING=()
[[ -z "$PREVIEW_URL" ]] && MISSING+=("PREVIEW_URL")
[[ -z "$BUCKET_ENDPOINT_URL" ]] && MISSING+=("BUCKET_ENDPOINT_URL")
[[ -z "$FRONTEND_ORIGIN" ]] && MISSING+=("FRONTEND_ORIGIN")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "======================================================================"
  echo "ERROR: Missing required input(s): ${MISSING[*]}"
  echo "Usage:"
  echo "  $0 <PREVIEW_URL> <BUCKET_ENDPOINT_URL> <FRONTEND_ORIGIN>"
  echo "Or export them in your terminal beforehand."
  echo "======================================================================"
  exit 1
fi

check_placeholder() {
  local name="$1"
  local val="$2"
  local placeholder_regex='(YOUR|\.\.\.|<|>|example\.com|paste\ preview|YOUR-REAL)'
  if [[ "$val" =~ $placeholder_regex ]]; then
    echo "ERROR: $name contains an unreplaced placeholder: '$val'"
    echo "Please provide the real URL or origin."
    exit 1
  fi
}

check_placeholder "PREVIEW_URL" "$PREVIEW_URL"
check_placeholder "BUCKET_ENDPOINT_URL" "$BUCKET_ENDPOINT_URL"
check_placeholder "FRONTEND_ORIGIN" "$FRONTEND_ORIGIN"

PREVIEW_URL="${PREVIEW_URL%/}"
BUCKET_ENDPOINT_URL="${BUCKET_ENDPOINT_URL%/}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN%/}"

echo "======================================================================"
echo "Site Inspection Preview Verification Runner"
echo "Preview URL:         $PREVIEW_URL"
echo "Bucket Endpoint:     $BUCKET_ENDPOINT_URL"
echo "Frontend Origin:     $FRONTEND_ORIGIN"
echo "======================================================================"

# 2. Check preview URL reachability & Vercel Deployment Protection
echo
echo "--- Step 1: Validating Preview Deployment Reachability ---"

BYPASS_HEADER=()
if [[ -n "${VERCEL_BYPASS_TOKEN:-}" ]]; then
  BYPASS_HEADER=("-H" "x-vercel-protection-bypass: ${VERCEL_BYPASS_TOKEN}")
fi

HTTP_CHECK=$(curl -s -I -o /dev/null -w "%{http_code}" ${BYPASS_HEADER[@]+"${BYPASS_HEADER[@]}"} "$PREVIEW_URL/api/v1/site-inspections/master" || echo "000")

if [[ "$HTTP_CHECK" == "302" || "$HTTP_CHECK" == "307" || "$HTTP_CHECK" == "308" ]]; then
  # Check if redirect is for Vercel authentication
  REDIRECT_LOC=$(curl -s -I ${BYPASS_HEADER[@]+"${BYPASS_HEADER[@]}"} "$PREVIEW_URL/api/v1/site-inspections/master" | grep -i '^location:' | tr -d '\r' || true)
  if echo "$REDIRECT_LOC" | grep -iq "vercel.com/sso-api\|vercel-auth"; then
    echo "ERROR: The preview deployment is protected by Vercel Authentication (HTTP $HTTP_CHECK)."
    echo "To allow the test suite to connect:"
    echo "  Option A (Recommended): In Vercel Dashboard (nexus-sales-crm > Settings > Deployment Protection),"
    echo "                          set Vercel Authentication to 'Only Production' or disable for Previews."
    echo "  Option B (Bypass Token): Under 'Protection Bypass for Automation', generate a secret and run:"
    echo "                          export VERCEL_BYPASS_TOKEN='<secret>'"
    echo "                          before re-running this script."
    exit 1
  fi
fi

if [[ "$HTTP_CHECK" == "404" ]]; then
  RESP_BODY=$(curl -s ${BYPASS_HEADER[@]+"${BYPASS_HEADER[@]}"} "$PREVIEW_URL/api/v1/site-inspections/master" || true)
  if echo "$RESP_BODY" | grep -iq "DEPLOYMENT_NOT_FOUND"; then
    echo "ERROR: Vercel returned DEPLOYMENT_NOT_FOUND (HTTP 404)."
    echo "The preview deployment at '$PREVIEW_URL' could not be found."
    exit 1
  fi
fi

if [[ "$HTTP_CHECK" == "401" || "$HTTP_CHECK" == "200" ]]; then
  echo "  [PASS] API endpoint is reachable (HTTP $HTTP_CHECK)."
else
  echo "  [NOTICE] API check returned HTTP $HTTP_CHECK. Proceeding with caution..."
fi

# 3. Create or reuse test users
echo
echo "--- Step 2: Preparing Test User Accounts ---"
ENV_FILE="$HOME/.site-inspection-test.env"
JSON_FILE="$HOME/.site-inspection-test-users.json"
REUSE_CREDS="N"

if [[ -f "$ENV_FILE" && -f "$JSON_FILE" ]]; then
  read_tty_plain "Existing test credentials found at $ENV_FILE. Reuse them? [Y/n]: " REUSE_CHOICE
  if [[ -z "$REUSE_CHOICE" || "$REUSE_CHOICE" =~ ^[Yy] ]]; then
    REUSE_CREDS="Y"
  fi
fi

if [[ "$REUSE_CREDS" != "Y" ]]; then
  echo "Please enter your CRM Admin credentials to create the isolated test users."
  read_tty_plain "Admin Email: " ADMIN_EMAIL
  read_tty_hidden "Admin Password: " ADMIN_PASSWORD
  export ADMIN_EMAIL ADMIN_PASSWORD
  export PREVIEW_URL

  node scripts/create-site-inspection-test-users.js
  cleanup_admin
else
  echo "Reusing existing test credentials from $ENV_FILE."
fi

# 4. Run CORS check script
echo
echo "--- Step 3: Verifying S3 Bucket CORS Configuration ---"
./scripts/check-bucket-cors.sh "$BUCKET_ENDPOINT_URL" "$FRONTEND_ORIGIN"

# 5. Ensure Playwright browsers are installed
echo
echo "--- Step 4: Ensuring Playwright Browser Binaries ---"
if ! npx playwright --version >/dev/null 2>&1; then
  echo "Installing Playwright..."
  npm install
fi

# Check if chromium browser is present
if ! npx playwright install chromium; then
  echo "Notice: Playwright chromium install returned non-zero, continuing..."
fi

# 6. Run Playwright E2E spec
echo
echo "--- Step 5: Executing E2E Preview Test Suite ---"
export PREVIEW_URL
export BUCKET_ENDPOINT_URL
export FRONTEND_ORIGIN

TEST_STATUS=0
npx playwright test frontend/e2e/site-inspection-preview.spec.ts || TEST_STATUS=$?

echo
echo "======================================================================"
if [[ "$TEST_STATUS" -eq 0 ]]; then
  echo "PLAYWRIGHT RUN RESULT: ALL TESTS PASSED!"
else
  echo "PLAYWRIGHT RUN RESULT: FAILED (Exit Code: $TEST_STATUS)"
  echo "Common failure diagnosis:"
  echo "  - CORS error: Check that AllowedOrigins in bucket policy exactly matches '$FRONTEND_ORIGIN'."
  echo "  - 4.5 MB body limit: Upload hit Vercel instead of the S3 bucket direct endpoint."
  echo "  - Expired signed URL: Check system clocks or clock skew on S3 client."
  echo "  - Wrong Content-Type: Bucket pre-signed PUT locked Content-Type to image/jpeg."
  echo "  - Permission error: IAM policy missing s3:PutObject or s3:GetObject on bucket resource."
fi
echo "======================================================================"

# 7. Cleanup prompt
echo
read_tty_plain "Do you want to run the cleanup script to deactivate test users and delete test records now? [y/N]: " CLEANUP_ANSWER
if [[ "$CLEANUP_ANSWER" =~ ^[Yy] ]]; then
  read_tty_plain "Admin Email for cleanup: " ADMIN_EMAIL
  read_tty_hidden "Admin Password for cleanup: " ADMIN_PASSWORD
  export ADMIN_EMAIL ADMIN_PASSWORD
  node scripts/delete-site-inspection-test-users.js
  cleanup_admin
else
  echo "Cleanup skipped. You can run 'node scripts/delete-site-inspection-test-users.js' at any time."
fi

echo
echo "Test run finished."
