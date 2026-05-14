/**
 * routes/optimize.js
 *
 * POST /api/scan        — Haiku: section detection + metadata extraction
 * POST /api/optimize    — Calls 1–4: optimisation pipeline SSE  (Sonnet 4.6)
 * POST /api/export      — Generate .docx files + return download URLs
 * POST /api/match-only  — Match analysis on original resume     (Haiku + Sonnet)
 * POST /api/cover-letter — Cover letter draft                   (Haiku + Sonnet)
 *
 * ─── Model Routing ──────────────────────────────────────────────────────────
 *   HAIKU   claude-haiku-4-5-20251001  — Call 0 only (fast, cheap scan)
 *   SONNET  claude-sonnet-4-6          — Calls 1–4 (quality optimisation)
 *
 * ─── Prompt Caching Strategy ────────────────────────────────────────────────
 *   System prompts → cache_control on ALL calls (static, shared globally).
 *   JD text        → cached in Calls 1, 2, 3, 4 (sent every Sonnet call).
 *   Resume text    → cached in Calls 1 and 2.
 */

import { Router } from 'express';
import KeepAlive from 'agentkeepalive';
import Anthropic from '@anthropic-ai/sdk';
import {
  SCAN_SYSTEM_PROMPT,
  OPTIMISE_HEADERS_SYSTEM_PROMPT,
  OPTIMISE_EXPERIENCE_SYSTEM_PROMPT,
  MATCH_ANALYSIS_SYSTEM_PROMPT,
  COVER_LETTER_SYSTEM_PROMPT,
  ATS_PREVIEW_SYSTEM_PROMPT,
  buildScanUserPrompt,
  assembleOptimisedResumeText,
} from '../../shared/prompts.js';
import { buildFileName } from '../../shared/fileNaming.js';
import { generateResumeDocx, generateAnalysisDocx, generateCoverLetterDocx } from '../../shared/docxGenerator.js';

const router = Router();

// keepAlive: false — each call opens its own connection and closes it on
// completion. Belt-and-suspenders alongside streaming: if a non-streaming call
// ever follows a long response, there is no stale socket in the pool to reuse.
// KeepAlive.HttpsAgent (not plain https.Agent) — the SDK expects this type.
const httpsAgent = new KeepAlive.HttpsAgent({ keepAlive: false, maxSockets: 10 });

const client = new Anthropic({
  apiKey:     process.env.ANTHROPIC_API_KEY,
  timeout:    360_000,   // 6 minutes — analysis streaming can take 200+ s for complex resumes
  maxRetries: 2,         // auto-retry on connection errors and 529 overload
  httpAgent:  httpsAgent,
});

// ─── Model IDs ────────────────────────────────────────────────────────────────
const HAIKU  = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

// ─── Token limits — named so intent is clear at each call site ────────────────
const MAX_TOKENS = {
  SCAN:         2048,
  META:         1024,
  HEADERS:      3000,
  EXPERIENCE:   4096,
  ANALYSIS:     6000,
  COVER_LETTER: 800,
  ATS_PREVIEW:  1400,
};

// ─── Timing constants ─────────────────────────────────────────────────────────
const HEARTBEAT_MS    = 15_000;  // keeps Railway/proxy connections alive
const ANALYZE_PAUSE_MS = 350;    // brief UX pause before Call 1 so "Analyzing…" registers

// ─── Content-block helpers ────────────────────────────────────────────────────
// JD is always first and cached so the cache prefix is identical across all calls.
const jdBlock     = (jd, label = 'JOB DESCRIPTION') => ({ text: `${label}:\n---\n${jd}\n---`, cache: true });
const resumeBlock = (rt, label = 'RESUME')           => ({ text: `${label}:\n---\n${rt}\n---`, cache: true });
const instrBlock  = (text)                            => ({ text, cache: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON(text) {
  try {
    return JSON.parse(text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (_) {}
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s !== -1 && e > s) return JSON.parse(text.slice(s, e + 1));
  } catch (_) {}
  try {
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s !== -1 && e > s) return JSON.parse(text.slice(s, e + 1));
  } catch (_) {}
  console.error('[safeParseJSON] All attempts failed:', text?.slice(0, 500));
  throw new Error('JSON parse failed after all attempts');
}

function logCacheStats(label, usage) {
  if (!usage) return;
  const written = usage.cache_creation_input_tokens || 0;
  const read    = usage.cache_read_input_tokens     || 0;
  const flag    = read > 0 ? 'CACHE HIT  ' : written > 0 ? 'CACHE WRITE' : 'no cache   ';
  console.log(`  [${flag}] [${label}] input: ${usage.input_tokens} | write: ${written} | read: ${read} | output: ${usage.output_tokens}`);
}

// Retry wrapper for transient Anthropic API errors (socket hang up, ECONNRESET,
// 529 overloaded). Waits 3 s then 6 s before giving up entirely.
async function withRetry(fn, label, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable =
        err.message?.includes('socket hang up') ||
        err.message?.includes('Socket timeout')  ||
        err.message?.includes('ECONNRESET')      ||
        err.message?.includes('Connection error') ||
        err.message?.includes('timed out')        ||
        err?.status === 529;
      if (attempt <= retries && retryable) {
        const delay = attempt * 3_000;
        console.warn(`  [${label}] ${err.constructor?.name ?? 'Error'} on attempt ${attempt} — retrying in ${delay / 1000}s…`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// Standard (non-streaming) call — use for short-output calls (< ~1 000 tokens).
async function callClaude({ model, systemPrompt, contentBlocks, maxTokens = 4096, label = 'api' }) {
  return withRetry(async () => {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: contentBlocks.map(b => ({
          type: 'text',
          text: b.text,
          ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {}),
        })),
      }],
    });
    logCacheStats(label, response.usage);
    const block = response.content.find(b => b.type === 'text');
    if (!block) throw new Error(`No text block returned by ${label}`);
    return block.text;
  }, label);
}

// Streaming call — use for long-output calls (analysis: 3 500–4 000 tokens).
// Each token arrives as it is generated so the socket is never idle, avoiding
// the server-side "socket hang up" that occurs on 60–90 s non-streaming waits.
async function callClaudeStreaming({ model, systemPrompt, contentBlocks, maxTokens = 4096, label = 'api' }) {
  return withRetry(async () => {
    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: contentBlocks.map(b => ({
          type: 'text',
          text: b.text,
          ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {}),
        })),
      }],
    });
    const response = await stream.finalMessage();
    logCacheStats(label, response.usage);
    const block = response.content.find(b => b.type === 'text');
    if (!block) throw new Error(`No text block returned by ${label}`);
    return block.text;
  }, label);
}

function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Heartbeat — sends a comment line every 15s to keep Railway/proxies
  // from closing the connection during long Claude API calls.
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);

  // Stop heartbeat when the connection closes
  res.on('close', () => clearInterval(heartbeat));

  return heartbeat;
}

const emit = (res, type, payload = {}) =>
  res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);

async function extractMeta(resumeText, jobDescription, label) {
  try {
    const raw  = await callClaude({
      model: HAIKU, systemPrompt: SCAN_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.META, label,
      contentBlocks: [instrBlock(buildScanUserPrompt(resumeText, jobDescription))],
    });
    const meta = safeParseJSON(raw);
    return {
      companyName: meta.companyName || 'Unknown_Company',
      jobTitle:    meta.jobTitle    || 'Unknown_Role',
    };
  } catch {
    return { companyName: 'Unknown_Company', jobTitle: 'Unknown_Role' };
  }
}

// ─── POST /api/scan ───────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required.' });
  }
  console.log('\n══════════════════════════════════════');
  console.log(' Call 0  │ Haiku  │ Section scan + metadata');
  console.log('══════════════════════════════════════');
  try {
    const raw = await callClaude({
      model: HAIKU, systemPrompt: SCAN_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.SCAN, label: 'Call 0',
      contentBlocks: [instrBlock(buildScanUserPrompt(resumeText, jobDescription))],
    });
    const result = safeParseJSON(raw);
    console.log(`  resumeType: ${result.resumeType ?? '(not returned)'} | missing: ${result.sectionsMissing?.length ?? 0}`);
    return res.json(result);
  } catch (err) {
    console.error('[/api/scan] Error:', err.message);
    return res.json({
      companyName: 'Unknown_Company', jobTitle: 'Unknown_Role',
      sectionsFound: [], sectionsPartial: [], sectionsMissing: [], fallback: true,
    });
  }
});

// ─── POST /api/optimize ───────────────────────────────────────────────────────
router.post('/optimize', async (req, res) => {
  const { resumeText, jobDescription, companyName, jobTitle, sectionAdditions, preserveJobOrder } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required.' });
  }

  setupSSE(res);

  // Merge user-added sections into resume text
  let fullResumeText     = resumeText;
  let sectionContextNote = '';
  if (sectionAdditions && Object.keys(sectionAdditions).length > 0) {
    const lines = Object.entries(sectionAdditions)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k.toUpperCase()}\n${v.trim()}`);
    if (lines.length > 0) {
      sectionContextNote = lines.join('\n\n');
      fullResumeText     = `${resumeText}\n\n--- USER-ADDED SECTIONS ---\n${sectionContextNote}`;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' Calls 1–5  │ Sonnet 4.6 (1–4) + Haiku (5)  │ Optimise + ATS');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // Step 3: brief UX pause while "Analyzing inputs"
    emit(res, 'step', { step: 3, status: 'active' });
    await new Promise(r => setTimeout(r, ANALYZE_PAUSE_MS));
    emit(res, 'step', { step: 3, status: 'complete' });

    // ── Calls 1 + 2 in parallel ───────────────────────────────────────────────
    // Both only need the original resume + JD — no dependency between them.
    // Running in parallel saves ~15–20 s vs sequential execution.
    emit(res, 'step', { step: 4, status: 'active' });
    emit(res, 'step', { step: 5, status: 'active' });

    const [headersRaw, experienceRaw] = await Promise.allSettled([
      callClaude({
        model: SONNET, systemPrompt: OPTIMISE_HEADERS_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.HEADERS, label: 'Call 1 / headers',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(fullResumeText, 'ORIGINAL RESUME'),
          instrBlock(sectionContextNote
            ? `SECTION CONTEXT:\n---\n${sectionContextNote}\n---\n\nRewrite the header sections to align with the job description. Return only valid JSON.`
            : `Rewrite the header sections to align with the job description. Return only valid JSON.`),
        ],
      }),
      callClaude({
        model: SONNET, systemPrompt: OPTIMISE_EXPERIENCE_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.EXPERIENCE, label: 'Call 2 / experience',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(fullResumeText, 'ORIGINAL RESUME'),
          instrBlock(preserveJobOrder
            ? 'Rewrite all experience bullets using the what/how/so-what structure, ordered by JD relevance. Return only valid JSON.\n\nIMPORTANT: Preserve the exact original order of job roles. Do not reorder, move, or rearrange any job entry.'
            : 'Rewrite all experience bullets using the what/how/so-what structure, ordered by JD relevance. Return only valid JSON.'),
        ],
      }),
    ]);

    if (headersRaw.status === 'rejected') {
      console.error('[Call 1 / headers] Error:', headersRaw.reason?.message);
      emit(res, 'error', { message: 'Failed to optimize resume header. Please try again.' });
      return res.end();
    }
    if (experienceRaw.status === 'rejected') {
      console.error('[Call 2 / experience] Error:', experienceRaw.reason?.message);
      emit(res, 'error', { message: 'Failed to optimize experience bullets. Please try again.' });
      return res.end();
    }

    let headers, experienceData;
    try {
      headers = safeParseJSON(headersRaw.value);
      // Normalize contact to string — AI occasionally returns it as char array
      if (Array.isArray(headers.contact)) headers.contact = headers.contact.join('');
      if (typeof headers.contact !== 'string') headers.contact = String(headers.contact || '');
    } catch (err) {
      console.error('[Call 1 / headers] Parse error:', err.message);
      emit(res, 'error', { message: 'Could not parse header response. Please try again.' });
      return res.end();
    }
    try {
      experienceData = safeParseJSON(experienceRaw.value).experience || [];
    } catch (err) {
      console.error('[Call 2 / experience] Parse error:', err.message);
      emit(res, 'error', { message: 'Could not parse experience response. Please try again.' });
      return res.end();
    }

    emit(res, 'step', { step: 4, status: 'complete' });
    emit(res, 'step', { step: 5, status: 'complete' });

    // ── Call 3: Match analysis (streaming — avoids server-side timeout) ───────
    // Non-streaming calls that generate 3 500+ tokens take 60–90 s of idle wait,
    // which triggers a server-side connection close ("socket hang up").
    // Streaming sends each token as generated — socket stays active throughout.
    const optimisedText = assembleOptimisedResumeText(headers, experienceData);
    emit(res, 'step', { step: 6, status: 'active' });

    let analysis;
    try {
      const raw = await callClaudeStreaming({
        model: SONNET, systemPrompt: MATCH_ANALYSIS_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.ANALYSIS, label: 'Call 3 / analysis',
        contentBlocks: [
          jdBlock(jobDescription),
          { text: `OPTIMIZED RESUME:\n---\n${optimisedText}\n---`, cache: true },
          instrBlock('Analyze how well the optimized resume matches this job description. Return only valid JSON.'),
        ],
      });
      analysis = safeParseJSON(raw);
    } catch (err) {
      console.error('[Call 3 / analysis]', err?.constructor?.name, err?.message,
        err?.cause ? `| cause: ${err.cause?.message ?? err.cause}` : '');
      emit(res, 'error', { message: 'Failed to run match analysis. Please try again.' });
      return res.end();
    }
    emit(res, 'step', { step: 6, status: 'complete' });

    // ── Calls 4 + 5 in parallel (1 Sonnet + 1 Haiku — safe concurrency) ─────
    emit(res, 'step', { step: 7, status: 'active' });
    const [clResult, atsResult] = await Promise.allSettled([
      // Call 4: Cover letter (Sonnet)
      callClaude({
        model: SONNET, systemPrompt: COVER_LETTER_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.COVER_LETTER, label: 'Call 4 / cover-letter',
        contentBlocks: [
          jdBlock(jobDescription),
          instrBlock(`RESUME:\n---\n${fullResumeText}\n---\n\nDraft a cover letter following the system prompt instructions. Return plain text only.`),
        ],
      }),
      // Call 5: ATS Preview (Haiku — cheaper, different model, safe to parallelise)
      callClaude({
        model: HAIKU, systemPrompt: ATS_PREVIEW_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.ATS_PREVIEW, label: 'Call 5 / ats-preview',
        contentBlocks: [
          jdBlock(jobDescription),
          instrBlock(`OPTIMIZED RESUME:\n---\n${optimisedText}\n---\n\nEvaluate this resume against the job description now.`),
        ],
      }),
    ]);

    const coverLetter = clResult.status  === 'fulfilled' ? clResult.value  : null;
    const atsPreview  = atsResult.status === 'fulfilled' ? safeParseJSON(atsResult.value) : null;
    emit(res, 'step', { step: 7, status: 'complete' });

    console.log(' Pipeline complete ✓\n');

    emit(res, 'result', {
      headers,
      experience:        experienceData,
      analysis,
      coverLetter,
      atsPreview,
      companyName:       companyName || 'Unknown_Company',
      jobTitle:          jobTitle    || 'Unknown_Role',
      sectionsWereAdded: !!sectionContextNote,
    });

  } catch (err) {
    console.error('[/api/optimize] Unhandled error:', err.message);
    emit(res, 'error', { message: 'An unexpected error occurred. Please try again.' });
  }

  res.end();
});

// ─── POST /api/export ─────────────────────────────────────────────────────────
// Documents are generated in memory and returned as base64 strings.
// No filesystem writes — works on ephemeral platforms like Railway and Vercel.
router.post('/export', async (req, res) => {
  const { headers, experience, analysis, atsPreview, companyName, jobTitle, sectionsWereAdded, coverLetter } = req.body;
  try {
    const payload = {};

    await Promise.all([
      analysis && (async () => {
        const fn  = buildFileName(companyName, jobTitle, 'Analysis');
        const buf = await generateAnalysisDocx(analysis, atsPreview, companyName, jobTitle, sectionsWereAdded);
        payload.analysisData     = buf.toString('base64');
        payload.analysisFileName = fn;
      })(),

      headers && typeof headers === 'object' && (async () => {
        const fn  = buildFileName(companyName, jobTitle, 'Resume');
        const buf = await generateResumeDocx(headers, experience);
        payload.resumeData     = buf.toString('base64');
        payload.resumeFileName = fn;
      })(),

      coverLetter?.trim() && (async () => {
        const fn  = buildFileName(companyName, jobTitle, 'CoverLetter');
        const buf = await generateCoverLetterDocx(coverLetter, companyName, jobTitle);
        payload.coverLetterData     = buf.toString('base64');
        payload.coverLetterFileName = fn;
      })(),
    ].filter(Boolean));

    res.json(payload);
  } catch (err) {
    console.error('[/api/export] Error:', err);
    res.status(500).json({ error: 'Failed to generate documents. Please try again.' });
  }
});

// ─── POST /api/match-only ─────────────────────────────────────────────────────
router.post('/match-only', async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required.' });
  }

  setupSSE(res);

  try {
    emit(res, 'step', { step: 1, status: 'active' });
    const { companyName, jobTitle } = await extractMeta(resumeText, jobDescription, 'match-only/meta');
    emit(res, 'step', { step: 1, status: 'complete' });

    emit(res, 'step', { step: 2, status: 'active' });
    // Run Sonnet analysis + Haiku ATS preview in parallel — same pattern as optimize Calls 4+5
    const [analysisResult, atsResult] = await Promise.allSettled([
      callClaudeStreaming({
        model: SONNET, systemPrompt: MATCH_ANALYSIS_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.ANALYSIS, label: 'match-only/analysis',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(resumeText, 'RESUME (original, unoptimized)'),
          instrBlock('Analyse how well this resume matches the job description. Return only valid JSON.'),
        ],
      }),
      callClaude({
        model: HAIKU, systemPrompt: ATS_PREVIEW_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.ATS_PREVIEW, label: 'match-only/ats-preview',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(resumeText, 'RESUME (original, unoptimized)'),
          instrBlock('Evaluate this resume against the job description now.'),
        ],
      }),
    ]);
    if (analysisResult.status === 'rejected') {
      const r = analysisResult.reason;
      console.error('[match-only/analysis]', r?.constructor?.name, r?.message,
        r?.cause ? `| cause: ${r.cause?.message ?? r.cause}` : '');
      emit(res, 'error', { message: 'Failed to run match analysis. Please try again.' });
      return res.end();
    }
    let analysis, atsPreview;
    try {
      analysis = safeParseJSON(analysisResult.value);
    } catch (err) {
      emit(res, 'error', { message: 'Could not parse match analysis. Please try again.' });
      return res.end();
    }
    atsPreview = atsResult.status === 'fulfilled' ? safeParseJSON(atsResult.value) : null;
    emit(res, 'step', { step: 2, status: 'complete' });
    emit(res, 'step', { step: 3, status: 'complete' });
    emit(res, 'result', { analysis, atsPreview, companyName, jobTitle, sectionsWereAdded: false });

  } catch (err) {
    console.error('[/api/match-only] Unhandled error:', err.message);
    emit(res, 'error', { message: 'An unexpected error occurred. Please try again.' });
  }
  res.end();
});

// ─── POST /api/cover-letter ───────────────────────────────────────────────────
router.post('/cover-letter', async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'resumeText and jobDescription are required.' });
  }

  setupSSE(res);

  try {
    emit(res, 'step', { step: 1, status: 'active' });
    const { companyName, jobTitle } = await extractMeta(resumeText, jobDescription, 'cover-letter/meta');
    emit(res, 'step', { step: 1, status: 'complete' });

    emit(res, 'step', { step: 2, status: 'active' });
    let coverLetter;
    try {
      coverLetter = await callClaude({
        model: SONNET, systemPrompt: COVER_LETTER_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.COVER_LETTER, label: 'cover-letter/draft',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(resumeText),
          instrBlock('Draft a cover letter following the system prompt instructions. Return plain text only.'),
        ],
      });
    } catch {
      emit(res, 'error', { message: 'Failed to draft cover letter. Please try again.' });
      return res.end();
    }
    emit(res, 'step', { step: 2, status: 'complete' });
    emit(res, 'step', { step: 3, status: 'complete' });
    emit(res, 'result', { coverLetter, companyName, jobTitle });

  } catch (err) {
    console.error('[/api/cover-letter] Unhandled error:', err.message);
    emit(res, 'error', { message: 'An unexpected error occurred. Please try again.' });
  }
  res.end();
});

export default router;
