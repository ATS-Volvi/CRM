import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import tty from 'node:tty';
import readline from 'node:readline';
import { execSync } from 'node:child_process';

/**
 * Validates BASE_URL and command-line flags.
 * - Refuses placeholder URL (containing YOUR, ..., < or >)
 * - Refuses any URL that is not https unless it is localhost/127.0.0.1
 * - If not localhost, requires --i-know-this-is-production flag
 */
export function validateUrlAndArgs(argv, scriptName = 'script') {
  const urlArg = argv[2];
  if (!urlArg) {
    console.error(`\nUsage: node scripts/${scriptName} <BASE_URL> [--i-know-this-is-production]\n`);
    console.error(`ERROR: BASE_URL must be provided as the first argument.`);
    process.exit(1);
  }

  // Refuse placeholder URL
  if (/YOUR|\.\.\.|<|>|example\.com/i.test(urlArg)) {
    console.error(`\nERROR: BASE_URL "${urlArg}" contains placeholder characters (YOUR, ..., <, >).`);
    console.error(`Please provide the real live URL or localhost address.\n`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(urlArg);
  } catch (err) {
    console.error(`\nERROR: "${urlArg}" is not a valid URL (${err.message}).\n`);
    process.exit(1);
  }

  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  // Refuse any URL that is not https unless it is localhost
  if (!isLocalhost && parsed.protocol !== 'https:') {
    console.error(`\nERROR: Non-localhost URL must use HTTPS. Received: "${parsed.protocol}"\n`);
    process.exit(1);
  }

  // If host is not localhost, require --i-know-this-is-production
  if (!isLocalhost && !argv.includes('--i-know-this-is-production')) {
    console.error(`\n========================================================================`);
    console.error(`PRODUCTION SAFETY GUARD:`);
    console.error(`Target host "${parsed.hostname}" is not localhost.`);
    console.error(`To run against a remote/production instance, you must explicitly pass:`);
    console.error(`  --i-know-this-is-production`);
    console.error(`========================================================================\n`);
    process.exit(1);
  }

  return parsed.origin;
}

/**
 * Checks that target directory is outside any git repository.
 */
export function ensureSafeOutputDir(dirPath) {
  try {
    const isGitRepo = execSync(`git -C "${dirPath}" rev-parse --is-inside-work-tree 2>/dev/null`, {
      encoding: 'utf8',
    }).trim();
    if (isGitRepo === 'true') {
      console.error(`ERROR: Target directory "${dirPath}" is inside a git repository! Aborting.`);
      process.exit(1);
    }
  } catch {
    // Expected: directory is outside git
  }
}

/**
 * Prompts user for hidden input on /dev/tty (e.g. password).
 * Does not echo characters. Never logs or prints password.
 * Falls back to process.env[envFallback] for automated test environments.
 */
export async function promptHidden(promptMessage, envFallback) {
  if (envFallback && process.env[envFallback]) {
    return process.env[envFallback];
  }

  let ttyInFd, ttyOutFd;
  let isTtyOpened = false;
  try {
    ttyInFd = fs.openSync('/dev/tty', 'r');
    ttyOutFd = fs.openSync('/dev/tty', 'w');
    isTtyOpened = true;
  } catch {
    // Fallback if /dev/tty not accessible
  }

  return new Promise((resolve) => {
    let inputStream;
    let outputStream;

    if (isTtyOpened) {
      inputStream = new tty.ReadStream(ttyInFd);
      outputStream = fs.createWriteStream(null, { fd: ttyOutFd });
    } else {
      inputStream = process.stdin;
      outputStream = process.stdout;
    }

    outputStream.write(promptMessage);

    let password = '';
    const isRaw = typeof inputStream.setRawMode === 'function';
    if (isRaw) {
      inputStream.setRawMode(true);
    }
    inputStream.resume();
    inputStream.setEncoding('utf8');

    const onData = (chunk) => {
      chunk = String(chunk);
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          if (isRaw) {
            inputStream.setRawMode(false);
          }
          inputStream.pause();
          inputStream.removeListener('data', onData);
          if (isTtyOpened) {
            try {
              fs.closeSync(ttyInFd);
              fs.closeSync(ttyOutFd);
            } catch {}
          }
          outputStream.write('\n');
          resolve(password);
          return;
        } else if (ch === '\u0003') {
          // Ctrl+C
          if (isRaw) {
            inputStream.setRawMode(false);
          }
          if (isTtyOpened) {
            try {
              fs.closeSync(ttyInFd);
              fs.closeSync(ttyOutFd);
            } catch {}
          }
          process.exit(130);
        } else if (ch === '\u0008' || ch === '\x7f') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += ch;
        }
      }
    };

    inputStream.on('data', onData);
  });
}

/**
 * Prompts user for standard visible text input on /dev/tty.
 */
export async function promptText(promptMessage, envFallback) {
  if (envFallback && process.env[envFallback]) {
    return process.env[envFallback];
  }

  let ttyInFd, ttyOutFd;
  let isTtyOpened = false;
  try {
    ttyInFd = fs.openSync('/dev/tty', 'r');
    ttyOutFd = fs.openSync('/dev/tty', 'w');
    isTtyOpened = true;
  } catch {}

  let inputStream, outputStream;
  if (isTtyOpened) {
    inputStream = fs.createReadStream(null, { fd: ttyInFd });
    outputStream = fs.createWriteStream(null, { fd: ttyOutFd });
  } else {
    inputStream = process.stdin;
    outputStream = process.stdout;
  }

  const rl = readline.createInterface({
    input: inputStream,
    output: outputStream,
  });

  return new Promise((resolve) => {
    rl.question(promptMessage, (answer) => {
      rl.close();
      if (isTtyOpened) {
        try {
          fs.closeSync(ttyInFd);
          fs.closeSync(ttyOutFd);
        } catch {}
      }
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts user for y/N confirmation.
 */
export async function promptConfirm(promptMessage, defaultYes = false) {
  if (process.env.AUTO_CONFIRM === 'yes' || process.env.AUTO_CONFIRM === 'true') {
    return true;
  }
  const answer = await promptText(promptMessage);
  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Generates a cryptographically strong random password.
 */
export function generateRandomPassword(length = 24) {
  return crypto.randomBytes(18).toString('base64url').slice(0, length);
}

/**
 * Generates a valid pure-JS ~6 MB JPEG with EXIF APP1 GPS coordinates
 * (Latitude 26.65, Longitude 50.15) padded with valid JPEG COM markers.
 */
export function generateGpsJpegBuffer(targetSizeBytes = 6.2 * 1024 * 1024) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app1Marker = Buffer.from([0xff, 0xe1]);
  const exifHeader = Buffer.from('Exif\0\0', 'binary');
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);

  // IFD0: 1 tag (0x8825 GPS pointer at offset 26 from TIFF header)
  const ifd0 = Buffer.alloc(2 + 12 + 4);
  ifd0.writeUInt16LE(1, 0); // tag count = 1
  ifd0.writeUInt16LE(0x8825, 2); // tag: GPSInfoIFD
  ifd0.writeUInt16LE(4, 4); // type: LONG
  ifd0.writeUInt32LE(1, 6); // count: 1
  ifd0.writeUInt32LE(26, 10); // offset: 26
  ifd0.writeUInt32LE(0, 14); // next IFD: 0

  // GPS IFD: 5 entries
  // Offset 26 + 2 + 5*12 + 4 = 92
  const gpsIfd = Buffer.alloc(2 + 5 * 12 + 4);
  gpsIfd.writeUInt16LE(5, 0);

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
  // Lat: 26/1, 39/1, 0/1 -> 26.65
  rationalData.writeUInt32LE(26, 0);
  rationalData.writeUInt32LE(1, 4);
  rationalData.writeUInt32LE(39, 8);
  rationalData.writeUInt32LE(1, 12);
  rationalData.writeUInt32LE(0, 16);
  rationalData.writeUInt32LE(1, 20);

  // Lon: 50/1, 9/1, 0/1 -> 50.15
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
  const maxChunk = 65533; // 65535 - 2
  const paddingNeeded = Math.max(0, targetSizeBytes - soi.length - app1Seg.length - eoi.length);

  const chunks = [soi, app1Seg];
  let rem = paddingNeeded;
  while (rem > 0) {
    const chunkLen = Math.min(rem, maxChunk);
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(chunkLen + 2, 0);
    const dataBuf = Buffer.alloc(chunkLen, 0x58);
    chunks.push(comMarker, lenBuf, dataBuf);
    rem -= chunkLen;
  }
  chunks.push(eoi);
  return Buffer.concat(chunks);
}
