/**
 * Stage 3: Attachment safety.
 * Two checks, in order: (a) real MIME-type allowlist via file signature —
 * never trust the filename extension — then (b) antivirus scan of the bytes.
 *
 * Requires a ClamAV daemon reachable on the network (clamd). In Docker,
 * run it as a sidecar container; see the docker-compose snippet in README.md.
 */

const fileType = require('file-type'); // npm i file-type
const fileTypeFromBuffer = fileType.fileTypeFromBuffer || fileType.fromBuffer;
const NodeClam = require('clamscan');               // npm i clamscan

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

let clamscanInstance;
async function getScanner() {
  if (!clamscanInstance) {
    try {
      clamscanInstance = await new NodeClam().init({
        clamdscan: {
          host: process.env.CLAMAV_HOST || 'clamav',
          port: process.env.CLAMAV_PORT || 3310,
          timeout: 60000,
        },
      });
    } catch (err) {
      console.warn('[lead-security] ClamAV daemon offline/unreachable:', err.message);
      return null;
    }
  }
  return clamscanInstance;
}

/**
 * @param {Array<{buffer: Buffer, filename: string}>} attachments
 * @returns {{clean: boolean, reason?: string, safeAttachments?: Array}}
 */
async function scanAttachments(attachments) {
  const safeAttachments = [];

  for (const file of attachments) {
    if (file.buffer.length > MAX_FILE_BYTES) {
      return { clean: false, reason: 'file_too_large' };
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      return { clean: false, reason: `disallowed_file_type:${detected?.mime || 'unknown'}` };
    }

    const scanner = await getScanner();
    if (scanner) {
      const { isInfected, viruses } = await scanner.scanBuffer(file.buffer);
      if (isInfected) {
        return { clean: false, reason: `malware_detected:${viruses.join(',')}` };
      }
    }

    safeAttachments.push({
      filename: sanitizeFilename(file.filename),
      mime: detected.mime,
      buffer: file.buffer,
    });
  }

  return { clean: true, safeAttachments };
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
}

module.exports = {
  scanAttachments,
  _setScanner: (scanner) => { clamscanInstance = scanner; },
};

