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
 *   HAIKU   claude-haiku-4-5-20251001  — scan, meta extraction, ATS preview (Call 5)
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
  SCAN:               2048,
  META:               1024,
  HEADERS:            3000,
  HEADERS_FUNCTIONAL: 4500,  // functional/hybrid: Call 1 also rewrites experience clusters
  EXPERIENCE:         4096,
  ANALYSIS:           8000,
  COVER_LETTER:       1200,
  ATS_PREVIEW:        2000,
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

// Ensure preservedSections is always a proper array regardless of what the AI returns.
// Claude occasionally returns {} (empty object) or a string instead of [].
function normalisePreservedSections(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    // Handle {"0": {...}, "1": {...}} style
    const arr = Object.values(value);
    if (arr.length > 0 && typeof arr[0] === 'object') return arr;
  }
  return [];
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
  const { resumeText, jobDescription, companyName, jobTitle, sectionAdditions, preserveJobOrder, resumeType } = req.body;
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

    // ── Calls 1 + 2 ───────────────────────────────────────────────────────────
    // FUNCTIONAL resumes (skill-cluster experience, no standard job entries):
    //   Call 1 runs alone with a larger token budget (4500t). It rewrites headers
    //   AND captures skill clusters into preservedSections. Call 2 is skipped.
    // CHRONOLOGICAL and HYBRID resumes:
    //   Calls 1 + 2 run in parallel (saves ~15–20 s). Call 1 captures any
    //   non-standard sections (Accomplishments, Leadership Principles, etc.)
    //   into preservedSections. Call 2 rewrites chronological experience.
    emit(res, 'step', { step: 4, status: 'active' });
    emit(res, 'step', { step: 5, status: 'active' });

    // Only bypass Call 2 for purely functional resumes (skill-cluster experience).
    // HYBRID resumes retain Call 2 because they have real chronological jobs.
    const isFunctionalResume = resumeType === 'functional';
    console.log(`  resumeType: ${resumeType || '(not provided)'} | functional bypass: ${isFunctionalResume}`);

    let headers, experienceData, preservedSections;

    if (isFunctionalResume) {
      // ── Functional path: single Call 1, skip Call 2 ──────────────────────────
      let headersRaw;
      try {
        headersRaw = await callClaude({
          model: SONNET, systemPrompt: OPTIMISE_HEADERS_SYSTEM_PROMPT,
          maxTokens: MAX_TOKENS.HEADERS_FUNCTIONAL, label: 'Call 1 / headers+clusters',
          contentBlocks: [
            jdBlock(jobDescription),
            resumeBlock(fullResumeText, 'ORIGINAL RESUME'),
            instrBlock(
              (sectionContextNote
                ? `SECTION CONTEXT:\n---\n${sectionContextNote}\n---\n\n`
                : '')
              + 'This is a FUNCTIONAL resume — experience is organized as skill/competency clusters, '
              + 'not as standard chronological job entries. '
              + 'Rewrite the header sections as normal. '
              + 'Capture every experience skill cluster in preservedSections with '
              + 'type "functional_clusters" and position "experience". '
              + 'Rewrite cluster bullets against the JD using the what/how/so-what rules. '
              + 'Do NOT attempt to recast clusters as chronological job entries. '
              + 'Return only valid JSON.'
            ),
          ],
        });
      } catch (err) {
        console.error('[Call 1 / headers+clusters] Error:', err.message);
        emit(res, 'error', { message: 'Failed to optimize resume header. Please try again.' });
        return res.end();
      }
      try {
        headers = safeParseJSON(headersRaw);
        if (Array.isArray(headers.contact)) headers.contact = headers.contact.join('');
        if (typeof headers.contact !== 'string') headers.contact = String(headers.contact || '');
      } catch (err) {
        console.error('[Call 1 / headers+clusters] Parse error:', err.message);
        emit(res, 'error', { message: 'Could not parse header response. Please try again.' });
        return res.end();
      }
      experienceData    = [];  // functional resumes have no chronological experience array
      preservedSections = normalisePreservedSections(headers.preservedSections);
      if (preservedSections.length > 0) {
        console.log(`  preservedSections (functional): ${preservedSections.length} section(s) — ${preservedSections.map(s => s.type).join(', ')}`);
      }

    } else {
      // ── Chronological / Hybrid path: Calls 1 + 2 in parallel ─────────────────
      const [headersRaw, experienceRaw] = await Promise.allSettled([
        callClaude({
          model: SONNET, systemPrompt: OPTIMISE_HEADERS_SYSTEM_PROMPT,
          maxTokens: MAX_TOKENS.HEADERS, label: 'Call 1 / headers',
          contentBlocks: [
            jdBlock(jobDescription),
            resumeBlock(fullResumeText, 'ORIGINAL RESUME'),
            instrBlock(sectionContextNote
              ? `SECTION CONTEXT:\n---\n${sectionContextNote}\n---\n\nRewrite the header sections to align with the job description. Return only valid JSON.`
              : `Rewrite the header sections to align with the job description. Return only valid JSON.`),
          ],
        }),
        callClaude({
          model: SONNET, systemPrompt: OPTIMISE_EXPERIENCE_SYSTEM_PROMPT,
          maxTokens: MAX_TOKENS.EXPERIENCE, label: 'Call 2 / experience',
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
      try {
        headers = safeParseJSON(headersRaw.value);
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
      preservedSections = normalisePreservedSections(headers.preservedSections);
      if (preservedSections.length > 0) {
        console.log(`  preservedSections (chrono/hybrid): ${preservedSections.length} section(s) — ${preservedSections.map(s => s.type).join(', ')}`);
      }
    }

    emit(res, 'step', { step: 4, status: 'complete' });
    emit(res, 'step', { step: 5, status: 'complete' });

    // ── Call 3: Match analysis (streaming — avoids server-side timeout) ───────
    // Non-streaming calls that generate 3 500+ tokens take 60–90 s of idle wait,
    // which triggers a server-side connection close ("socket hang up").
    // Streaming sends each token as generated — socket stays active throughout.
    let optimisedText;
    try {
      optimisedText = assembleOptimisedResumeText(headers, experienceData, preservedSections);
    } catch (err) {
      console.error('[assembleOptimisedResumeText] Error:', err.message);
      emit(res, 'error', { message: 'Failed to assemble optimized resume text. Please try again.' });
      return res.end();
    }
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
      // Call 4: Cover letter (Sonnet) — uses optimisedText so the letter matches the
      // tailored resume, not the original. optimisedText is assembled before this block.
      callClaude({
        model: SONNET, systemPrompt: COVER_LETTER_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.COVER_LETTER, label: 'Call 4 / cover-letter',
        contentBlocks: [
          jdBlock(jobDescription),
          instrBlock(`RESUME:\n---\n${optimisedText}\n---\n\nDraft a cover letter following the system prompt instructions. Return plain text only.`),
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

    const coverLetter = clResult.status === 'fulfilled' ? clResult.value : null;
    // Parse ATS preview — guard against truncated JSON that safeParseJSON recovers as an array
    // instead of the expected object (happens when max_tokens is tight on long resumes).
    let atsPreview = null;
    if (atsResult.status === 'fulfilled') {
      try {
        const parsed = safeParseJSON(atsResult.value);
        atsPreview = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        if (!atsPreview) console.warn('[ats-preview] Parsed value was not an object — discarding:', typeof parsed);
      } catch (e) {
        console.error('[ats-preview] JSON parse failed — atsPreview will be null:', e.message);
      }
    }
    emit(res, 'step', { step: 7, status: 'complete' });

    console.log(' Pipeline complete ✓\n');

    emit(res, 'result', {
      headers,
      experience:        experienceData,
      preservedSections,
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
  const { headers, experience, analysis, atsPreview, companyName, jobTitle, sectionsWereAdded, coverLetter, preservedSections } = req.body;
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
        const buf = await generateResumeDocx(headers, experience, {}, normalisePreservedSections(preservedSections));
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
    // All three calls run in parallel:
    //   • extractMeta (Haiku, ~2 s) — step 1; result only needed for the final emit
    //   • analysis    (Sonnet streaming, 30–60 s) — step 2
    //   • atsPreview  (Haiku, ~5 s) — runs alongside analysis
    // extractMeta resolves first and marks step 1 complete via its .then callback.
    emit(res, 'step', { step: 1, status: 'active' });
    emit(res, 'step', { step: 2, status: 'active' });

    const [metaResult, analysisResult, atsResult] = await Promise.allSettled([
      extractMeta(resumeText, jobDescription, 'match-only/meta').then(meta => {
        emit(res, 'step', { step: 1, status: 'complete' });
        return meta;
      }),
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

    // extractMeta never rejects (internal try-catch returns Unknown_* on failure)
    const { companyName, jobTitle } = metaResult.value;

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
    if (atsResult.status === 'fulfilled') {
      try {
        const parsed = safeParseJSON(atsResult.value);
        atsPreview = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        if (!atsPreview) console.warn('[match-only/ats-preview] Parsed value was not an object — discarding:', typeof parsed);
      } catch (e) {
        console.error('[match-only/ats-preview] JSON parse failed — atsPreview will be null:', e.message);
      }
    }
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
    // extractMeta (Haiku, ~2 s) and the cover letter draft (Sonnet, ~8 s) run
    // in parallel — meta result is only needed for the final emit.
    // extractMeta marks step 1 complete via its .then callback as soon as it resolves.
    emit(res, 'step', { step: 1, status: 'active' });
    emit(res, 'step', { step: 2, status: 'active' });

    const [metaResult, clResult] = await Promise.allSettled([
      extractMeta(resumeText, jobDescription, 'cover-letter/meta').then(meta => {
        emit(res, 'step', { step: 1, status: 'complete' });
        return meta;
      }),
      callClaude({
        model: SONNET, systemPrompt: COVER_LETTER_SYSTEM_PROMPT, maxTokens: MAX_TOKENS.COVER_LETTER, label: 'cover-letter/draft',
        contentBlocks: [
          jdBlock(jobDescription),
          resumeBlock(resumeText),
          instrBlock('Draft a cover letter following the system prompt instructions. Return plain text only.'),
        ],
      }),
    ]);

    if (clResult.status === 'rejected') {
      emit(res, 'error', { message: 'Failed to draft cover letter. Please try again.' });
      return res.end();
    }

    // extractMeta never rejects (internal try-catch returns Unknown_* on failure)
    const { companyName, jobTitle } = metaResult.value;
    const coverLetter = clResult.value;

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
