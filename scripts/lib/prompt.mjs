/**
 * scripts/lib/prompt.mjs
 *
 * Hidden password prompt and text prompt compatible with Node 18 to 26 on macOS and Linux.
 * - Uses process.stdin in raw mode when it is a TTY.
 * - Handles Backspace, Enter, Ctrl+C (with exit code 130).
 * - Never opens /dev/tty.
 * - Never echoes characters.
 * - Never logs or prints passwords or tokens.
 * - Adds an 'error' handler on process.stdin so any failure prints one clear line.
 * - Uses ADMIN_EMAIL and ADMIN_PASSWORD environment variables ONLY when stdin is not a TTY.
 */

import readline from 'node:readline';

// Attach error handler to process.stdin to avoid unhandled stream error crashes
process.stdin.on('error', (err) => {
  console.error(`Stdin input error: ${err?.message || err}`);
});

/**
 * Prompts user for hidden input (e.g. password) without echoing characters.
 *
 * @param {string} promptMessage
 * @param {string} [envVarName] - e.g. 'ADMIN_PASSWORD'. Evaluated ONLY when stdin is NOT a TTY.
 * @returns {Promise<string>}
 */
export async function promptHidden(promptMessage = 'Password: ', envVarName = 'ADMIN_PASSWORD') {
  // Requirement: Use ADMIN_PASSWORD environment variable ONLY when stdin is not a TTY
  if (!process.stdin.isTTY) {
    if (envVarName && process.env[envVarName] !== undefined) {
      return String(process.env[envVarName]);
    }
    // Non-TTY without env var fallback: read a single line from piped stdin
    return readLineFromStream(process.stdin);
  }

  // TTY mode: raw mode interactive reading without echoing
  return new Promise((resolve) => {
    process.stdout.write(promptMessage);

    let password = '';
    const wasRaw = Boolean(process.stdin.isRaw);

    try {
      process.stdin.setRawMode(true);
    } catch (e) {
      // Fallback if setRawMode fails
    }

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let inEscapeSequence = false;
    let escapeBuffer = '';

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(wasRaw);
      } catch {}
      process.stdin.pause();
    };

    const onData = (chunk) => {
      const str = String(chunk);

      for (let i = 0; i < str.length; i++) {
        const ch = str[i];

        // Handle ANSI escape sequences (arrows, home/end, etc.) so they aren't inserted into password
        if (inEscapeSequence) {
          escapeBuffer += ch;
          // Escape sequences terminate with letters or '~'
          if (/[a-zA-Z~]/.test(ch)) {
            inEscapeSequence = false;
            escapeBuffer = '';
          }
          continue;
        }

        if (ch === '\u001b') {
          inEscapeSequence = true;
          escapeBuffer = ch;
          continue;
        }

        // Ctrl+C (ETX)
        if (ch === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
        }

        // Ctrl+D (EOT) or Enter (CR / LF)
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          resolve(password);
          return;
        }

        // Backspace (0x08) or DEL (0x7f)
        if (ch === '\u0008' || ch === '\x7f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          continue;
        }

        // Printable characters
        if (ch >= ' ') {
          password += ch;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Prompts user for standard visible text input (e.g. email or username).
 *
 * @param {string} promptMessage
 * @param {string} [envVarName] - e.g. 'ADMIN_EMAIL'. Evaluated ONLY when stdin is not a TTY.
 * @returns {Promise<string>}
 */
export async function promptText(promptMessage = 'Input: ', envVarName = 'ADMIN_EMAIL') {
  // Requirement: Use ADMIN_EMAIL environment variable ONLY when stdin is not a TTY
  if (!process.stdin.isTTY) {
    if (envVarName && process.env[envVarName] !== undefined) {
      return String(process.env[envVarName]).trim();
    }
    return (await readLineFromStream(process.stdin)).trim();
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.question(promptMessage, (answer) => {
      rl.close();
      resolve(String(answer ?? '').trim());
    });
  });
}

/**
 * Prompts user for y/N confirmation.
 *
 * @param {string} promptMessage
 * @param {boolean} [defaultYes=false]
 * @returns {Promise<boolean>}
 */
export async function promptConfirm(promptMessage = 'Confirm? (y/N): ', defaultYes = false) {
  if (process.env.AUTO_CONFIRM === 'yes' || process.env.AUTO_CONFIRM === 'true') {
    return true;
  }
  const answer = await promptText(promptMessage, '');
  if (!answer) return defaultYes;
  const lower = answer.toLowerCase();
  return lower === 'y' || lower === 'yes';
}

/**
 * Helper to read a single line from a non-TTY readable stream.
 */
function readLineFromStream(stream) {
  return new Promise((resolve) => {
    let line = '';
    stream.setEncoding('utf8');

    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === '\n' || ch === '\r') {
          stream.removeListener('data', onData);
          stream.removeListener('end', onEnd);
          resolve(line);
          return;
        }
        line += ch;
      }
    };

    const onEnd = () => {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      resolve(line);
    };

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.resume();
  });
}
