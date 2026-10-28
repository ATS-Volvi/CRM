#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Site Inspection Storage Smoke Test Script
# Tests direct upload presign, direct PUT, complete, verification, and rejection
# ==============================================================================

INSPECTION_ID="${1:-}"
FORCE_PROD="${2:-}"

if [[ -z "$INSPECTION_ID" ]]; then
  echo "Usage: $0 <TEST_INSPECTION_ID> [--i-know-this-is-production]"
  exit 1
fi

if [[ -z "${BASE_URL:-}" ]]; then
  echo "ERROR: BASE_URL environment variable is required (e.g., https://my-preview.vercel.app or http://localhost:5001)."
  exit 1
fi

if [[ -z "${SITE_MANAGER_JWT:-}" ]]; then
  echo "ERROR: SITE_MANAGER_JWT environment variable is required."
  exit 1
fi

# Guard against accidental execution on production
if [[ "$BASE_URL" =~ "prod" ]] && [[ "$FORCE_PROD" != "--i-know-this-is-production" ]]; then
  echo "ERROR: BASE_URL contains 'prod'. To run against production, pass --i-know-this-is-production as the second argument."
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/storage-smoke-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "=== Starting Site Inspection Storage Smoke Test ==="
echo "Target Base URL: $BASE_URL"
echo "Inspection ID:   $INSPECTION_ID"
echo

# ------------------------------------------------------------------------------
# 1. Generate a 6 MB JPEG with EXIF GPS metadata using python3
# ------------------------------------------------------------------------------
echo "--- Step 1: Generating 6 MB JPEG with EXIF GPS metadata ---"
TEST_IMG="$TMP_DIR/test_large_gps.jpg"

python3 - << EOF
import os
import struct

# Create a valid JPEG file with APP1 Exif containing GPS tags and padding to ~6 MB
# Coordinates: Lat 26.65, Lon 50.15 (Eastern Province, Saudi Arabia)

# 0xFFD8: SOI
soi = b'\xff\xd8'

# Exif APP1 header
app1_marker = b'\xff\xe1'
exif_header = b'Exif\x00\x00'

# TIFF header (Intel / Little Endian)
tiff_header = b'II\x2a\x00\x08\x00\x00\x00'

# IFD0 with 1 tag (GPS IFD pointer at offset 26)
ifd0 = struct.pack('<H', 1)
# Tag 0x8825 (GPSInfoIFD), Type LONG (4), Count 1, Value 26 (offset from TIFF header)
ifd0 += struct.pack('<HHI I', 0x8825, 4, 1, 26)
ifd0 += struct.pack('<I', 0) # next IFD offset (0)

# GPS IFD at offset 26
# Tags: GPSVersionID (0x0000), GPSLatitudeRef (0x0001), GPSLatitude (0x0002), GPSLongitudeRef (0x0003), GPSLongitude (0x0004)
gps_entries = 5
gps_ifd = struct.pack('<H', gps_entries)

# Offsets for rational data:
# Start of values after GPS IFD entries: offset 26 + 2 + (5 * 12) + 4 = 92
# Tag 0: GPSVersionID: 2.2.0.0 (BYTE, 4)
gps_ifd += struct.pack('<HHII', 0x0000, 1, 4, 0x00000202)
# Tag 1: GPSLatitudeRef: 'N' (ASCII, 2)
gps_ifd += struct.pack('<HHII', 0x0001, 2, 2, ord('N'))
# Tag 2: GPSLatitude: 3 RATIONALS (24 bytes) at offset 92
gps_ifd += struct.pack('<HHII', 0x0002, 5, 3, 92)
# Tag 3: GPSLongitudeRef: 'E' (ASCII, 2)
gps_ifd += struct.pack('<HHII', 0x0003, 2, 2, ord('E'))
# Tag 4: GPSLongitude: 3 RATIONALS (24 bytes) at offset 116
gps_ifd += struct.pack('<HHII', 0x0004, 5, 3, 116)
gps_ifd += struct.pack('<I', 0) # next IFD offset

# Rational values:
# Lat: 26 deg, 39 min, 0 sec = 26.65
lat_val = struct.pack('<II II II', 26, 1, 39, 1, 0, 1)
# Lon: 50 deg, 9 min, 0 sec = 50.15
lon_val = struct.pack('<II II II', 50, 1, 9, 1, 0, 1)

app1_payload = exif_header + tiff_header + ifd0 + gps_ifd + lat_val + lon_val
app1_len = len(app1_payload) + 2
app1_seg = app1_marker + struct.pack('>H', app1_len) + app1_payload

# Target size 6.2 MB
target_size = 6 * 1024 * 1024 + 200 * 1024
padding_needed = target_size - len(soi) - len(app1_seg) - 4 # minus COM header and EOI

# APP0 / COM comment segment for padding
com_marker = b'\xff\xfe'
com_len = 65535
com_chunk = b'\x00' * (com_len - 2)

with open('$TEST_IMG', 'wb') as f:
    f.write(soi)
    f.write(app1_seg)
    remaining = padding_needed
    while remaining > 0:
        chunk_size = min(remaining, com_len - 2)
        f.write(com_marker + struct.pack('>H', chunk_size + 2) + (b'X' * chunk_size))
        remaining -= chunk_size
    f.write(b'\xff\xd9') # EOI
EOF

FILE_SIZE=$(wc -c < "$TEST_IMG" | tr -d ' ')
echo "Generated image size: $FILE_SIZE bytes (~$(( FILE_SIZE / 1024 / 1024 )) MB)"

# ------------------------------------------------------------------------------
# 2. Call Presign Endpoint
# ------------------------------------------------------------------------------
echo "--- Step 2: Requesting pre-signed upload URL ---"
PRESIGN_RES=$(curl -s -X POST "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/presign" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"fileName\": \"smoke_test_gps.jpg\", \"mimeType\": \"image/jpeg\", \"sizeBytes\": $FILE_SIZE}")

UPLOAD_URL=$(echo "$PRESIGN_RES" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("uploadUrl",""))')
STORAGE_KEY=$(echo "$PRESIGN_RES" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("storageKey",""))')

if [[ -z "$UPLOAD_URL" || -z "$STORAGE_KEY" ]]; then
  echo "FAIL: Presign endpoint did not return uploadUrl or storageKey. Response: $PRESIGN_RES"
  exit 1
fi
echo "PASS: Presign successful."
echo "Storage Key: $STORAGE_KEY"

# ------------------------------------------------------------------------------
# 3. Direct PUT to Signed URL
# ------------------------------------------------------------------------------
echo "--- Step 3: Direct PUT to storage bucket ---"
PUT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @"$TEST_IMG")

if [[ "$PUT_STATUS" -lt 200 || "$PUT_STATUS" -ge 300 ]]; then
  echo "FAIL: Direct PUT to storage returned HTTP $PUT_STATUS"
  exit 1
fi
echo "PASS: Direct PUT succeeded (HTTP $PUT_STATUS)."

# ------------------------------------------------------------------------------
# 4. Call Complete Endpoint
# ------------------------------------------------------------------------------
echo "--- Step 4: Calling complete attachment endpoint ---"
COMPLETE_RES=$(curl -s -X POST "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/complete" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"storageKey\": \"$STORAGE_KEY\", \"fileName\": \"smoke_test_gps.jpg\", \"caption\": \"Smoke Test Photo\", \"tag\": \"Site Overview\"}")

ATTACHMENT_ID=$(echo "$COMPLETE_RES" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("id",""))')
LATITUDE=$(echo "$COMPLETE_RES" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("latitude",""))')
LONGITUDE=$(echo "$COMPLETE_RES" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("longitude",""))')

if [[ -z "$ATTACHMENT_ID" ]]; then
  echo "FAIL: Complete endpoint did not create attachment. Response: $COMPLETE_RES"
  exit 1
fi
echo "PASS: Attachment registered successfully. ID: $ATTACHMENT_ID"
echo "Extracted GPS Coordinates: Lat: $LATITUDE, Lon: $LONGITUDE"

# ------------------------------------------------------------------------------
# 5. Download verification
# ------------------------------------------------------------------------------
echo "--- Step 5: Verifying file download size ---"
DOWNLOADED_FILE="$TMP_DIR/downloaded.jpg"
curl -s -L "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/$ATTACHMENT_ID/file" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT" \
  -o "$DOWNLOADED_FILE"

DOWNLOADED_SIZE=$(wc -c < "$DOWNLOADED_FILE" | tr -d ' ')
if [[ "$DOWNLOADED_SIZE" -eq "$FILE_SIZE" ]]; then
  echo "PASS: Downloaded file size matches uploaded file exactly ($DOWNLOADED_SIZE bytes)."
else
  echo "FAIL: Size mismatch! Uploaded: $FILE_SIZE bytes, Downloaded: $DOWNLOADED_SIZE bytes."
  exit 1
fi

# ------------------------------------------------------------------------------
# 6. Spoofed File Rejection Check
# ------------------------------------------------------------------------------
echo "--- Step 6: Testing spoofed file rejection ---"
FAKE_FILE="$TMP_DIR/spoofed.jpg"
echo "This is not an image but plain text." > "$FAKE_FILE"
FAKE_SIZE=$(wc -c < "$FAKE_FILE" | tr -d ' ')

SPOOF_PRESIGN=$(curl -s -X POST "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/presign" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"fileName\": \"spoofed.jpg\", \"mimeType\": \"image/jpeg\", \"sizeBytes\": $FAKE_SIZE}")

FAKE_UPLOAD_URL=$(echo "$SPOOF_PRESIGN" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("uploadUrl",""))')
FAKE_KEY=$(echo "$SPOOF_PRESIGN" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("storageKey",""))')

curl -s -X PUT "$FAKE_UPLOAD_URL" -H "Content-Type: image/jpeg" --data-binary @"$FAKE_FILE" > /dev/null

SPOOF_COMPLETE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/complete" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"storageKey\": \"$FAKE_KEY\", \"fileName\": \"spoofed.jpg\"}")

if echo "$SPOOF_COMPLETE" | grep -q "magic byte check failed\|HTTP_STATUS:400"; then
  echo "PASS: Spoofed file was correctly rejected with HTTP 400."
else
  echo "FAIL: Spoofed file was unexpectedly accepted! Response: $SPOOF_COMPLETE"
  exit 1
fi

# ------------------------------------------------------------------------------
# 7. Cleanup created test attachment
# ------------------------------------------------------------------------------
echo "--- Step 7: Cleaning up test attachment ---"
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/v1/site-inspections/$INSPECTION_ID/attachments/$ATTACHMENT_ID" \
  -H "Authorization: Bearer $SITE_MANAGER_JWT")

if [[ "$DELETE_STATUS" -eq 200 ]]; then
  echo "PASS: Smoke test attachment cleaned up successfully."
else
  echo "WARN: Deleting smoke test attachment returned HTTP $DELETE_STATUS"
fi

echo
echo "=== ALL SMOKE TEST CHECKS PASSED ==="
