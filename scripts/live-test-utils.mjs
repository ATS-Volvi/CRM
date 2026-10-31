/**
 * scripts/live-test-utils.mjs
 *
 * Shared utilities for live test scripts:
 * - URL & production guard validation.
 * - Git repository output directory safety assertions.
 * - Cryptographically random password generation.
 * - Valid pure-JS ~6.2 MB JPEG buffer generator with GPS EXIF markers.
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

/**
 * Validates command-line arguments and target base URL.
 *
 * Rules:
 * 1. Requires a base URL.
 * 2. Refuses placeholder URLs (containing 'YOUR', '...', '<', '>').
 * 3. Enforces HTTPS unless URL is localhost / 127.0.0.1.
 * 4. Refuses any non-localhost URL unless '--i-know-this-is-production' is passed.
 *
 * @param {string[]} argv - process.argv
 * @param {string} scriptName - e.g. 'live-test-users.mjs'
 * @returns {string} Normalized base URL (e.g. 'https://crm-k8g4.onrender.com')
 */
export function validateUrlAndArgs(argv, scriptName = 'script') {
  const args = argv.slice(2);
  const urlArg = args.find((a) => !a.startsWith('--'));
  const hasProdFlag = args.includes('--i-know-this-is-production');

  if (!urlArg) {
    console.error(`\nUsage: node scripts/${scriptName} <BASE_URL> [--i-know-this-is-production]`);
    console.error(`Example: node scripts/${scriptName} https://crm-k8g4.onrender.com --i-know-this-is-production\n`);
    process.exit(1);
  }

  // Refuse placeholder URLs
  if (
    urlArg.includes('YOUR') ||
    urlArg.includes('...') ||
    urlArg.includes('<') ||
    urlArg.includes('>') ||
    urlArg.includes('example.com')
  ) {
    console.error(`\nERROR: Refusing placeholder URL: "${urlArg}". Provide a real target URL.\n`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(urlArg);
  } catch (err) {
    console.error(`\nERROR: Invalid target URL "${urlArg}": ${err.message}\n`);
    process.exit(1);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  // Enforce HTTPS for non-localhost
  if (!isLocalhost && parsed.protocol !== 'https:') {
    console.error(`\nERROR: Insecure HTTP protocol rejected for remote host: "${urlArg}". HTTPS is required.\n`);
    process.exit(1);
  }

  // Require production flag for non-localhost
  if (!isLocalhost && !hasProdFlag) {
    console.error(`\n========================================================================`);
    console.error(`SAFETY GUARD ACTIVATED:`);
    console.error(`Target "${urlArg}" is a remote / production environment.`);
    console.error(`To proceed, you MUST explicitly provide the flag:`);
    console.error(`  --i-know-this-is-production`);
    console.error(`========================================================================\n`);
    process.exit(1);
  }

  return parsed.origin;
}

/**
 * Checks that target directory is outside every git repository.
 * Aborts if directory is inside a git working tree.
 *
 * @param {string} dirPath
 */
export function ensureSafeOutputDir(dirPath) {
  let isGitRepo = 'false';
  try {
    isGitRepo = execSync(`git -C "${dirPath}" rev-parse --is-inside-work-tree 2>/dev/null`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    // Expected: directory is outside git or command failed
    isGitRepo = 'false';
  }

  if (isGitRepo === 'true') {
    console.error(`\nERROR: Target directory "${dirPath}" is inside a git repository! Aborting.\n`);
    process.exit(1);
  }
}

/**
 * Generates a cryptographically strong random password.
 *
 * @param {number} [length=24]
 * @returns {string}
 */
export function generateRandomPassword(length = 24) {
  return crypto.randomBytes(32).toString('base64url').slice(0, length);
}

/**
 * Generates a valid pure-JS ~6.2 MB JPEG buffer with EXIF APP1 GPS coordinates
 * (Latitude 26.65° N, Longitude 50.15° E) padded with valid JPEG COM (0xFFFE) markers.
 *
 * @param {number} [targetSizeBytes=6.2*1024*1024]
 * @returns {Buffer}
 */
export function generateGpsJpegBuffer(targetSizeBytes = 6.2 * 1024 * 1024) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app1Marker = Buffer.from([0xff, 0xe1]);
  const exifHeader = Buffer.from('Exif\0\0', 'binary');
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]); // Little-endian II

  // IFD0: 1 tag (0x8825 GPS pointer at offset 26 from TIFF header)
  const ifd0 = Buffer.alloc(2 + 12 + 4);
  ifd0.writeUInt16LE(1, 0); // tag count = 1
  ifd0.writeUInt16LE(0x8825, 2); // tag: GPSInfoIFD
  ifd0.writeUInt16LE(4, 4); // type: LONG
  ifd0.writeUInt32LE(1, 6); // count: 1
  ifd0.writeUInt32LE(26, 10); // offset: 26
  ifd0.writeUInt32LE(0, 14); // next IFD: 0

  // GPS IFD: 5 entries (2 bytes count + 5*12 bytes entries + 4 bytes next IFD offset = 66 bytes)
  // Offset from TIFF header: 26 + 66 = 92
  const gpsIfd = Buffer.alloc(2 + 5 * 12 + 4);
  gpsIfd.writeUInt16LE(5, 0); // 5 tags

  // Tag 0: GPSVersionID (BYTE, 4, 2.2.0.0)
  gpsIfd.writeUInt16LE(0x0000, 2);
  gpsIfd.writeUInt16LE(1, 4);
  gpsIfd.writeUInt32LE(4, 6);
  gpsIfd.writeUInt32LE(0x00000202, 10);

  // Tag 1: GPSLatitudeRef (ASCII, 2, 'N\0')
  gpsIfd.writeUInt16LE(0x0001, 14);
  gpsIfd.writeUInt16LE(2, 16);
  gpsIfd.writeUInt32LE(2, 18);
  gpsIfd.writeUInt32LE(0x0000004e, 22);

  // Tag 2: GPSLatitude (RATIONAL, 3, offset 92)
  gpsIfd.writeUInt16LE(0x0002, 26);
  gpsIfd.writeUInt16LE(5, 28);
  gpsIfd.writeUInt32LE(3, 30);
  gpsIfd.writeUInt32LE(92, 34);

  // Tag 3: GPSLongitudeRef (ASCII, 2, 'E\0')
  gpsIfd.writeUInt16LE(0x0003, 38);
  gpsIfd.writeUInt16LE(2, 40);
  gpsIfd.writeUInt32LE(2, 42);
  gpsIfd.writeUInt32LE(0x00000045, 46);

  // Tag 4: GPSLongitude (RATIONAL, 3, offset 116)
  gpsIfd.writeUInt16LE(0x0004, 50);
  gpsIfd.writeUInt16LE(5, 52);
  gpsIfd.writeUInt32LE(3, 54);
  gpsIfd.writeUInt32LE(116, 58);

  gpsIfd.writeUInt32LE(0, 62); // next IFD = 0

  // Rational data: 24 bytes Lat, 24 bytes Lon
  const rationalData = Buffer.alloc(48);
  // Lat: 26° 39' 0" = 26.65°
  rationalData.writeUInt32LE(26, 0);
  rationalData.writeUInt32LE(1, 4);
  rationalData.writeUInt32LE(39, 8);
  rationalData.writeUInt32LE(1, 12);
  rationalData.writeUInt32LE(0, 16);
  rationalData.writeUInt32LE(1, 20);

  // Lon: 50° 9' 0" = 50.15°
  rationalData.writeUInt32LE(50, 24);
  rationalData.writeUInt32LE(1, 28);
  rationalData.writeUInt32LE(9, 32);
  rationalData.writeUInt32LE(1, 36);
  rationalData.writeUInt32LE(0, 40);
  rationalData.writeUInt32LE(1, 44);

  const app1Payload = Buffer.concat([exifHeader, tiffHeader, ifd0, gpsIfd, rationalData]);
  const app1Len = Buffer.alloc(2);
  app1Len.writeUInt16BE(app1Payload.length + 2, 0);
  const app1Seg = Buffer.concat([app1Marker, app1Len, app1Payload]);

  const eoi = Buffer.from([0xff, 0xd9]);
  const comMarker = Buffer.from([0xff, 0xfe]);
  const maxChunk = 65533; // 65535 - 2 bytes length header
  const paddingNeeded = Math.max(0, targetSizeBytes - soi.length - app1Seg.length - eoi.length);

  const chunks = [soi, app1Seg];
  let rem = paddingNeeded;
  while (rem > 0) {
    const chunkLen = Math.min(rem, maxChunk);
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(chunkLen + 2, 0);
    const dataBuf = Buffer.alloc(chunkLen, 0x58); // filler character 'X'
    chunks.push(comMarker, lenBuf, dataBuf);
    rem -= chunkLen;
  }
  chunks.push(eoi);
  return Buffer.concat(chunks);
}
