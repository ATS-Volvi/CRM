/**
 * Stage 3: Attachment safety.
 * Two checks, in order: (a) real MIME-type allowlist via file signature —
 * never trust the filename extension — then (b) antivirus scan of the bytes.
 *
 * Requires a ClamAV daemon reachable on the network (clamd). In Docker,
 * run it as a sidecar container; see the docker-compose snippet in README.md.
 *
 * CLAMAV_ENABLED env var:
 *   true  (default) — fail-closed: attachments are blocked when the daemon is
 *                     unreachable, so no unscanned file ever passes.
 *   false           — AV scanning is skipped entirely; only MIME-type and file-
 *                     size checks run. Set this only when no daemon is provisioned
 *                     yet and you would rather pass clean-MIME files than
 *                     quarantine everything. Flip back to true as soon as a real
 *                     daemon is available (see GitHub Issue: Provision ClamAV).
 */

const fileType = require('file-type');
const fileTypeFromBuffer = fileType.fileTypeFromBuffer || fileType.fromBuffer;
const NodeClam = require('clamscan');

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

/** Returns true when AV scanning is active (the default). */
function isClamAvEnabled(): boolean {
  return process.env.CLAMAV_ENABLED?.toLowerCase() !== 'false';
}

let clamscanInstance: any = null;

async function getScanner() {
  if (!clamscanInstance) {
    try {
      clamscanInstance = await new NodeClam().init({
        clamdscan: {
          host: process.env.CLAMAV_HOST || 'clamav',
          port: Number(process.env.CLAMAV_PORT) || 3310,
          timeout: 60000,
        },
      });
    } catch (err: any) {
      console.error(
        `[lead-security] CRITICAL: ClamAV daemon offline/unreachable at ${process.env.CLAMAV_HOST || 'clamav'}:${Number(process.env.CLAMAV_PORT) || 3310}. Malware scanning is DOWN. File attachments will be blocked (fail-closed). Error: ${err.message}`
      );
      return null;
    }
  }
  return clamscanInstance;
}

export interface AttachmentInput {
  buffer: Buffer;
  filename: string;
}

export interface AttachmentScanResult {
  clean: boolean;
  reason?: string;
  safeAttachments?: Array<{
    filename: string;
    mime: string;
    buffer: Buffer;
  }>;
}

export async function scanAttachments(attachments: AttachmentInput[]): Promise<AttachmentScanResult> {
  const safeAttachments = [];

  // Log once per process start if scanning is administratively disabled.
  if (!isClamAvEnabled()) {
    console.warn(
      '[lead-security] WARNING: CLAMAV_ENABLED=false — antivirus scanning is DISABLED. ' +
      'Attachments are only checked by MIME-type allowlist and file size. ' +
      'Provision a ClamAV daemon and set CLAMAV_ENABLED=true before scaling email volume.'
    );
  }

  for (const file of attachments) {
    // --- Check 1: file size (always enforced) ---
    if (file.buffer.length > MAX_FILE_BYTES) {
      console.error(`[lead-security] Attachment "${file.filename}" exceeds max size of ${MAX_FILE_BYTES} bytes.`);
      return { clean: false, reason: 'file_too_large' };
    }

    // --- Check 2: MIME-type allowlist via magic bytes (always enforced) ---
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      console.error(`[lead-security] Attachment "${file.filename}" rejected with disallowed MIME type: ${detected?.mime || 'unknown'}.`);
      return { clean: false, reason: `disallowed_file_type:${detected?.mime || 'unknown'}` };
    }

    // --- Check 3: AV scan (skipped when CLAMAV_ENABLED=false) ---
    if (isClamAvEnabled()) {
      const scanner = await getScanner();
      if (!scanner) {
        console.error(
          `[lead-security] Attachment "${file.filename}" REJECTED: ClamAV scanner unreachable at ${process.env.CLAMAV_HOST || 'clamav'} (fail-closed policy).`
        );
        return { clean: false, reason: 'malware_scan_unavailable' };
      }

      try {
        const { isInfected, viruses } = await scanner.scanBuffer(file.buffer);
        if (isInfected) {
          console.error(`[lead-security] Attachment "${file.filename}" INFECTED with malware: ${viruses.join(',')}.`);
          return { clean: false, reason: `malware_detected:${viruses.join(',')}` };
        }
      } catch (scanErr: any) {
        console.error(
          `[lead-security] Attachment "${file.filename}" REJECTED: ClamAV scan failed during buffer inspection: ${scanErr.message} (fail-closed policy).`
        );
        return { clean: false, reason: 'malware_scan_unavailable' };
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
}

export function _setScanner(scanner: any): void {
  clamscanInstance = scanner;
}
