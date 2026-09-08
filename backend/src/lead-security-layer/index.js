/**
 * Lead Ingestion Security Layer
 * ------------------------------
 * Sits in front of every lead-intake route (web form, Facebook/Instagram/LinkedIn
 * webhooks, inbound email parser) BEFORE anything is written via Sequelize to
 * nexus_crm.sqlite / Postgres.
 *
 * Pipeline order matters — cheap, deterministic checks run first so we never
 * waste an LLM call on obvious junk:
 *
 *   1. rateLimitAndHoneypot   -> kill bots before they cost us anything
 *   2. sanitizeFields          -> strip HTML/JS, enforce length/type limits
 *   3. scanAttachments         -> MIME allowlist + ClamAV scan of any files
 *   4. spamRules                -> disposable domains, blocklist, duplicate check
 *   5. aiContentModeration    -> LLM judges intent (scam/abuse/injection) on what's left
 *
 * Anything that fails a stage is written to a `flagged_leads` table for human
 * review instead of being silently dropped — false positives should be
 * recoverable, not lost.
 */

const { rateLimiter, honeypotCheck } = require('./rateLimit');
const { sanitizeFields } = require('./sanitize');
const { scanAttachments } = require('./fileScan');
const { spamRules } = require('./spamRules');
const { aiContentModeration } = require('./aiModeration');
const { FlaggedLead } = require('@nexus-crm/database'); // matches spamRules.js import convention

/**
 * Express middleware you drop in front of ANY lead-creation route:
 *   router.post('/api/leads', ...leadSecurityPipeline())
 * or call runPipeline() directly from webhook handlers (Facebook, email parser, etc.)
 * since those aren't plain Express req/res flows.
 */
function leadSecurityPipeline() {
  return [
    rateLimiter,       // express-rate-limit, cheap, first line of defense
    honeypotCheck,     // instant reject if hidden field was filled
    async (req, res, next) => {
      try {
        req.leadCandidate = await runPipeline(req.body, {
          source: req.leadSource || 'web_form',
          ip: req.ip,
        });
        next();
      } catch (err) {
        if (err.blocked) {
          return res.status(202).json({
            status: 'held_for_review',
            reason: err.reason,
          }); // 202, not 4xx — don't tip off attackers to what tripped the filter
        }
        next(err);
      }
    },
  ];
}

/**
 * Non-Express entry point — use this from webhook handlers / email ingestion
 * jobs that don't go through the standard req/res cycle.
 *
 * @param {object} rawLead   raw fields as received from the channel
 * @param {object} meta      { source, ip?, attachments? }
 * @returns {object} sanitized, cleared lead object ready for Sequelize .create()
 */
async function runPipeline(rawLead, meta) {
  const sanitized = sanitizeFields(rawLead);

  if (meta.attachments?.length) {
    const scanResult = await scanAttachments(meta.attachments);
    if (!scanResult.clean) {
      await flag(sanitized, meta, `attachment_threat:${scanResult.reason}`);
      throw blocked(scanResult.reason);
    }
    sanitized.attachments = scanResult.safeAttachments;
  }

  const spamVerdict = await spamRules(sanitized, meta);
  if (spamVerdict.isSpam) {
    await flag(sanitized, meta, `spam_rule:${spamVerdict.reason}`);
    throw blocked(spamVerdict.reason);
  }

  const aiVerdict = await aiContentModeration(sanitized);
  if (aiVerdict.flagged) {
    await flag(sanitized, meta, `ai_moderation:${aiVerdict.category}`);
    throw blocked(aiVerdict.category);
  }

  return sanitized;
}

async function flag(lead, meta, reason) {
  // Never throw from here — a logging failure should not crash ingestion.
  try {
    await FlaggedLead.create({
      payload: JSON.stringify(lead),
      source: meta.source,
      ip: meta.ip || null,
      reason,
      reviewed: false,
    });
  } catch (e) {
    console.error('[lead-security] failed to log flagged lead:', e.message);
  }
}

function blocked(reason) {
  const err = new Error('lead_blocked');
  err.blocked = true;
  err.reason = reason;
  return err;
}

module.exports = { leadSecurityPipeline, runPipeline };
