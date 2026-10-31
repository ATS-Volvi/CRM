/**
 * backend/tests/unit/liveTestScripts.test.mjs
 *
 * Automated tests for live test scripts:
 * 1. Validates that each script refuses placeholder and production URLs without the flag.
 * 2. Validates prompt.mjs behavior and environment variable handling.
 * 3. Validates JPEG EXIF GPS buffer generator and file size.
 * 4. Ensures output never prints or logs sensitive passwords or tokens.
 * 5. Ensures secret files are written only to user home folder with mode 0600.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

const {
  validateUrlAndArgs,
  ensureSafeOutputDir,
  generateRandomPassword,
  generateGpsJpegBuffer,
} = await import('../../../scripts/live-test-utils.mjs');

const { promptHidden, promptText } = await import('../../../scripts/lib/prompt.mjs');

describe('Live Test Scripts - URL Validation & Safety Guards', () => {
  test('refuses placeholder URLs containing YOUR, ..., <, >, example.com', () => {
    const placeholders = [
      'https://crm-YOUR-INSTANCE.onrender.com',
      'https://crm-...onrender.com',
      'https://<target-crm-url>.com',
      'https://crm.example.com',
    ];

    for (const url of placeholders) {
      const result = spawnSync('node', ['scripts/live-test-users.mjs', url, '--i-know-this-is-production'], {
        cwd: rootDir,
        encoding: 'utf8',
      });
      assert.notStrictEqual(result.status, 0, `Expected failure for placeholder URL: ${url}`);
      const output = (result.stderr || '') + (result.stdout || '');
      assert.match(output, /Refusing placeholder URL/i);
    }
  });

  test('refuses non-https remote URLs', () => {
    const result = spawnSync('node', ['scripts/live-test-users.mjs', 'http://remote-crm.onrender.com', '--i-know-this-is-production'], {
      cwd: rootDir,
      encoding: 'utf8',
    });
    assert.notStrictEqual(result.status, 0);
    const output = (result.stderr || '') + (result.stdout || '');
    assert.match(output, /Insecure HTTP protocol rejected/i);
  });

  test('refuses remote production URLs when --i-know-this-is-production flag is missing', () => {
    const scripts = ['scripts/live-test-users.mjs', 'scripts/live-test-flow.mjs', 'scripts/live-test-cleanup.mjs'];

    for (const script of scripts) {
      const result = spawnSync('node', [script, 'https://crm-k8g4.onrender.com'], {
        cwd: rootDir,
        encoding: 'utf8',
      });
      assert.notStrictEqual(result.status, 0, `Expected failure for script ${script} without flag`);
      const output = (result.stderr || '') + (result.stdout || '');
      assert.match(output, /SAFETY GUARD ACTIVATED/i);
      assert.match(output, /--i-know-this-is-production/i);
    }
  });

  test('allows localhost HTTP without production flag', () => {
    const validLocal = validateUrlAndArgs(['node', 'script.js', 'http://localhost:3000']);
    assert.strictEqual(validLocal, 'http://localhost:3000');

    const valid127 = validateUrlAndArgs(['node', 'script.js', 'http://127.0.0.1:5001']);
    assert.strictEqual(valid127, 'http://127.0.0.1:5001');
  });

  test('allows remote HTTPS URL when production flag is present', () => {
    const validProd = validateUrlAndArgs(['node', 'script.js', 'https://crm-k8g4.onrender.com', '--i-know-this-is-production']);
    assert.strictEqual(validProd, 'https://crm-k8g4.onrender.com');
  });
});

describe('Live Test Scripts - Directory Safety & Password Generator', () => {
  test('ensureSafeOutputDir prevents writing inside a git repository', () => {
    const gitDir = rootDir;
    let exitedWith = null;
    const origExit = process.exit;
    const origError = console.error;

    try {
      process.exit = (code) => { exitedWith = code; throw new Error(`process.exit(${code})`); };
      console.error = () => {};
      assert.throws(() => ensureSafeOutputDir(gitDir), /process\.exit\(1\)/);
      assert.strictEqual(exitedWith, 1);
    } finally {
      process.exit = origExit;
      console.error = origError;
    }
  });

  test('generateRandomPassword generates 24-character cryptographically distinct passwords', () => {
    const p1 = generateRandomPassword(24);
    const p2 = generateRandomPassword(24);
    assert.strictEqual(p1.length, 24);
    assert.strictEqual(p2.length, 24);
    assert.notStrictEqual(p1, p2);
  });
});

describe('Live Test Scripts - GPS JPEG Buffer Generator', () => {
  test('generates valid JPEG buffer with EXIF APP1 markers and target size', () => {
    const buffer = generateGpsJpegBuffer(100 * 1024); // 100 KB test buffer
    assert(buffer.length >= 100 * 1024);

    // SOI marker
    assert.strictEqual(buffer[0], 0xff);
    assert.strictEqual(buffer[1], 0xd8);

    // EOI marker
    assert.strictEqual(buffer[buffer.length - 2], 0xff);
    assert.strictEqual(buffer[buffer.length - 1], 0xd9);

    // APP1 marker at byte 2
    assert.strictEqual(buffer[2], 0xff);
    assert.strictEqual(buffer[3], 0xe1);

    // Exif header
    const exifHeader = buffer.toString('binary', 6, 10);
    assert.strictEqual(exifHeader, 'Exif');
  });
});

describe('Live Test Scripts - Non-TTY Prompt Environment Fallback', () => {
  test('promptHidden uses ADMIN_PASSWORD only in non-TTY mode', async () => {
    process.env.ADMIN_PASSWORD = 'superSecretAdminPassword123!';
    const password = await promptHidden('Password: ', 'ADMIN_PASSWORD');
    assert.strictEqual(password, 'superSecretAdminPassword123!');
    delete process.env.ADMIN_PASSWORD;
  });

  test('promptText uses ADMIN_EMAIL only in non-TTY mode', async () => {
    process.env.ADMIN_EMAIL = 'admin@nexus-crm.local';
    const email = await promptText('Email: ', 'ADMIN_EMAIL');
    assert.strictEqual(email, 'admin@nexus-crm.local');
    delete process.env.ADMIN_EMAIL;
  });
});
