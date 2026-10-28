#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: check-bucket-cors.sh
# Validates S3-compatible bucket CORS preflight responses for PUT and GET
# ==============================================================================

BUCKET_ENDPOINT_URL="${1:-${BUCKET_ENDPOINT_URL:-}}"
FRONTEND_ORIGIN="${2:-${FRONTEND_ORIGIN:-}}"

if [[ -z "$BUCKET_ENDPOINT_URL" ]]; then
  echo "ERROR: BUCKET_ENDPOINT_URL is missing. Provide as \$1 or set the BUCKET_ENDPOINT_URL environment variable."
  exit 1
fi

if [[ -z "$FRONTEND_ORIGIN" ]]; then
  echo "ERROR: FRONTEND_ORIGIN is missing. Provide as \$2 or set the FRONTEND_ORIGIN environment variable."
  exit 1
fi

placeholder_regex='(YOUR|\.\.\.|<|>|example\.com)'
if [[ "$BUCKET_ENDPOINT_URL" =~ $placeholder_regex ]]; then
  echo "ERROR: BUCKET_ENDPOINT_URL contains an unreplaced placeholder: '$BUCKET_ENDPOINT_URL'"
  exit 1
fi

if [[ "$FRONTEND_ORIGIN" =~ $placeholder_regex ]]; then
  echo "ERROR: FRONTEND_ORIGIN contains an unreplaced placeholder: '$FRONTEND_ORIGIN'"
  exit 1
fi

# Strip trailing slash from frontend origin if present
FRONTEND_ORIGIN="${FRONTEND_ORIGIN%/}"
# Strip trailing slash from endpoint URL
BUCKET_ENDPOINT_URL="${BUCKET_ENDPOINT_URL%/}"

echo "======================================================================"
echo "S3 Bucket CORS Preflight Verification"
echo "Bucket Endpoint: $BUCKET_ENDPOINT_URL"
echo "Frontend Origin: $FRONTEND_ORIGIN"
echo "======================================================================"

# Determine whether endpoint already includes a path or is host-only
TEST_PATHS=(
  ""
  "/site-inspections/cors-preflight-test.jpg"
)

TOTAL_FAILS=0

test_cors() {
  local method="$1"
  local request_headers="$2"
  local path_suffix="$3"
  local target_url="${BUCKET_ENDPOINT_URL}${path_suffix}"

  echo
  echo ">>> Testing OPTIONS preflight for Method: ${method} on Target: ${target_url}"

  local curl_args=(
    "-s" "-I" "-X" "OPTIONS" "$target_url"
    "-H" "Origin: ${FRONTEND_ORIGIN}"
    "-H" "Access-Control-Request-Method: ${method}"
  )

  if [[ -n "$request_headers" ]]; then
    curl_args+=("-H" "Access-Control-Request-Headers: ${request_headers}")
  fi

  # Execute curl and capture response headers
  local headers
  headers=$(curl "${curl_args[@]}" 2>&1 || true)

  local http_status
  http_status=$(echo "$headers" | grep -iE '^HTTP/' | tail -n1 | tr -d '\r' || echo "No HTTP response")
  echo "HTTP Status: $http_status"

  # Extract relevant CORS headers (case-insensitive)
  local allow_origin
  allow_origin=$(echo "$headers" | grep -i '^access-control-allow-origin:' | tail -n1 | cut -d':' -f2- | tr -d ' \r' || true)
  local allow_methods
  allow_methods=$(echo "$headers" | grep -i '^access-control-allow-methods:' | tail -n1 | cut -d':' -f2- | tr -d '\r' || true)
  local allow_headers
  allow_headers=$(echo "$headers" | grep -i '^access-control-allow-headers:' | tail -n1 | cut -d':' -f2- | tr -d '\r' || true)
  local expose_headers
  expose_headers=$(echo "$headers" | grep -i '^access-control-expose-headers:' | tail -n1 | cut -d':' -f2- | tr -d '\r' || true)

  echo "  Access-Control-Allow-Origin:  ${allow_origin:-<NOT_RETURNED>}"
  echo "  Access-Control-Allow-Methods: ${allow_methods:-<NOT_RETURNED>}"
  echo "  Access-Control-Allow-Headers: ${allow_headers:-<NOT_RETURNED>}"
  echo "  Access-Control-Expose-Headers:${expose_headers:-<NOT_RETURNED>}"

  local method_pass=true

  # Check 1: Allowed Origin
  if [[ "$allow_origin" == "$FRONTEND_ORIGIN" ]]; then
    echo "  [PASS] Origin matches '${FRONTEND_ORIGIN}' exactly."
  elif [[ "$allow_origin" == "*" ]]; then
    echo "  [FAIL] Origin returned wildcard '*'. In production, the CORS rule must specify the exact origin ('${FRONTEND_ORIGIN}')."
    echo "         Action: In your bucket CORS settings, change 'AllowedOrigins': ['*'] to ['${FRONTEND_ORIGIN}']."
    method_pass=false
    ((TOTAL_FAILS++))
  else
    echo "  [FAIL] Origin does not match '${FRONTEND_ORIGIN}' (got '${allow_origin}')."
    echo "         Action: Add '${FRONTEND_ORIGIN}' to the AllowedOrigins array in your bucket CORS configuration."
    method_pass=false
    ((TOTAL_FAILS++))
  fi

  # Check 2: Method
  if echo "$allow_methods" | grep -iq "$method"; then
    echo "  [PASS] Method ${method} is allowed."
  else
    echo "  [FAIL] Method ${method} is NOT present in Access-Control-Allow-Methods."
    echo "         Action: Add '${method}' to AllowedMethods in your bucket CORS configuration."
    method_pass=false
    ((TOTAL_FAILS++))
  fi

  # Check 3: Headers (for PUT)
  if [[ "$method" == "PUT" ]]; then
    if echo "$allow_headers" | grep -iq "content-type"; then
      echo "  [PASS] Content-Type header is allowed."
    else
      echo "  [FAIL] 'Content-Type' is NOT present in Access-Control-Allow-Headers."
      echo "         Action: Add 'Content-Type' to AllowedHeaders in your bucket CORS configuration."
      method_pass=false
      ((TOTAL_FAILS++))
    fi
  fi

  if [[ "$method_pass" == true ]]; then
    echo "RESULT: PASS for ${method} on ${target_url}"
  else
    echo "RESULT: FAIL for ${method} on ${target_url}"
  fi
}

for path_item in "${TEST_PATHS[@]}"; do
  desc="root path"
  [[ -n "$path_item" ]] && desc="object subpath ('$path_item')"
  echo "----------------------------------------------------------------------"
  echo "Testing preflight requests against ${desc}"
  echo "----------------------------------------------------------------------"
  test_cors "PUT" "content-type" "$path_item"
  test_cors "GET" "" "$path_item"
done

echo "======================================================================"
if [[ "$TOTAL_FAILS" -eq 0 ]]; then
  echo "OVERALL RESULT: ALL CORS PREFLIGHT CHECKS PASSED!"
  exit 0
else
  echo "OVERALL RESULT: CORS CHECKS FAILED WITH $TOTAL_FAILS ERROR(S)."
  echo "Please update the bucket CORS policy according to the instructions above."
  exit 1
fi
