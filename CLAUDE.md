# CLAUDE.md — Colemare / Resume Optimizer

This file is read automatically by Claude Code and Claude chat at the start of every session.
It describes the full delivered codebase so you can work without re-explanation.

---

## Project in one sentence

An AI-powered resume optimizer that offers three workflows: optimize a resume + generate cover letter, match a resume against a JD without rewriting, or draft a cover letter only. All outputs are downloadable Word documents.

## Repository

```
https://github.com/sugavans/colemare
```

## How to run locally

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY=sk-ant-api03-...
mkdir outputs                 # empty folder, gitignored
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001  (proxied through Vite — always use :3000 in browser)
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 8.x, Tailwind CSS |
| Backend | Node.js, Express (port 3001) |
| AI | Anthropic Claude API — `@anthropic-ai/sdk ^0.30.0` |
| Word export | `docx` npm package |
| Dev runner | `concurrently` (server + client in parallel) |

---

## Architecture: Three Workflows

### A — Optimize Resume & Create Cover Letter (primary CTA)
`InputScreen` → `/api/scan` → (optional) `SectionReviewScreen` → `/api/optimize` (SSE, 7 steps) → `/api/export` → `ResultsScreen`

- Results: Optimized Resume tab + Match Analysis tab + Cover Letter tab
- Downloads: Resume .docx + Analysis .docx + Cover Letter .docx

### B — Match Resume with JD (No Optimization)
`InputScreen` → `/api/match-only` (SSE, 3 steps) → `/api/export` → `ResultsScreen`

- Results: Match Analysis tab only
- Downloads: Analysis .docx only
- Action bar: Back to Inputs (preserves text) | Let's Optimize Resume & Create Cover Letter | Start Over

### C — Create Cover Letter Only (No Optimization)
`InputScreen` → `/api/cover-letter` (SSE, 3 steps) → `/api/export` → `ResultsScreen`

- Results: Cover Letter tab only
- Downloads: Cover Letter .docx only
- Action bar: Back to Inputs (preserves text) | Let's Optimize Resume & Create a New Cover Letter | Start Over

---

## API Endpoints

| Endpoint | Method | Model | Purpose |
|---|---|---|---|
| `/api/scan` | POST | Haiku | Section detection + metadata. Sync JSON response. |
| `/api/optimize` | POST | Sonnet (Calls 1–4) | Full pipeline SSE. 7 step events + result event. |
| `/api/match-only` | POST | Haiku + Sonnet | Match analysis SSE. 3 steps. |
| `/api/cover-letter` | POST | Haiku + Sonnet | Cover letter SSE. 3 steps. |
| `/api/export` | POST | — | Generates Resume/Analysis/CoverLetter .docx in parallel. Returns URLs. |
| `/download/:company/:file` | GET | — | express.static serving /outputs directory. |

> `/api/export-cover-letter` was removed. `/api/export` handles all three document types via `Promise.all`.

---

## Model Routing

```
HAIKU  = 'claude-haiku-4-5-20251001'   // Call 0: scan + metadata only
SONNET = 'claude-sonnet-4-6'           // Calls 1–4: all quality work
```

### Optimize pipeline call order

| Call | Model | Purpose | max_tokens |
|---|---|---|---|
| 0 | Haiku | Section detection + company/title extraction | 2048 |
| 1 | Sonnet | Rewrite header sections (title, summary, skills, tools) | 3000 |
| 2 | Sonnet | Rewrite experience bullets (what/how/so-what) | 4096 |
| 3 | Sonnet | Match analysis on optimised resume | 4096 |
| 4 | Sonnet | Cover letter draft — **non-blocking**, pipeline continues on failure | 1500 |

---

## Prompt Caching Strategy

**Why it matters:** JD text is sent in every Sonnet call. Caching it cuts token cost by ~90% on reads.

- **System prompts:** `cache_control` on every call — static text, shared globally across users.
- **JD text:** Cached in Calls 1, 2, 3, 4. **Always placed first** in the content array — the cache prefix must be identical across calls for reads to fire.
- **Resume text:** Cached in Calls 1 and 2. Placed second (after JD) to maximise prefix length.
- **Cache stats** are logged to the server console after every call (`CACHE HIT / CACHE WRITE / no cache`).

---

## Key Files

```
server/routes/optimize.js   — All API routes + helpers (setupSSE, emit, extractMeta, callClaude, safeParseJSON)
shared/prompts.js           — All system prompts + buildScanUserPrompt + assembleOptimisedResumeText
shared/docxGenerator.js     — generateResumeDocx, generateAnalysisDocx, generateCoverLetterDocx
shared/fileNaming.js        — buildFileName, buildFolderPath
shared/sectionDetector.js   — REQUIRED_SECTIONS, OPTIONAL_SECTIONS, ALL_SECTION_NAMES constants
client/src/App.jsx          — Screen router + all flow handlers + readSSE + runExport utilities
client/src/components/
  InputScreen.jsx           — 3-button layout, ATS tip, 700-word gate
  ProcessingScreen.jsx      — Mode-aware stepper (3 or 7 steps)
  ResultsScreen.jsx         — ScoreBanner, DownloadBar, tabs, all tab content components
  SectionReviewScreen.jsx   — Section status + 3 action options (Add / Map / Proceed)
  Footer.jsx                — "This is an AI tool. Please double-check the outputs."
```

---

## Shared Helpers (server/routes/optimize.js)

```js
setupSSE(res)                          // Sets SSE headers, flushHeaders
emit(res, type, payload)               // Writes one SSE data line
extractMeta(resumeText, jd, label)     // Haiku scan for company + title. Falls back to Unknown_*.
callClaude({ model, systemPrompt,      // Unified API caller with cache_control support.
  contentBlocks, maxTokens, label })   // contentBlocks: [{ text, cache: bool }]
safeParseJSON(text)                    // 3 attempts: strip fences → extract {…} → extract […]
```

## Shared Helpers (client/src/App.jsx)

```js
readSSE(url, body, onEvent)   // fetch + ReadableStream loop. Calls onEvent for each parsed SSE event.
runExport(payload)            // POST /api/export → setExportData. Non-blocking.
setStep(step, status)         // setSteps(prev => ({ ...prev, [step]: status }))
```

---

## Input Validation (InputScreen)

- Both textareas must be non-empty AND combined word count ≥ 700
- All three buttons share the same `bothFilled` condition
- Amber nudge shown below 700 words: `"Add more content to unlock — {n} / 700 words minimum"`
- All buttons disabled while any pipeline is running (`anyLoading`)

---

## Resume Content Rules (enforced in prompts.js)

1. **Never fabricate** — no metrics, names, or outcomes not in the original resume
2. **No em-dashes or arrows** in bullets — commas only
3. **Use % directly** — never spell out "percent"
4. **Carry forward ™ and ®** symbols exactly as written
5. **What/How/So-what** structure on every experience bullet
6. **Order bullets by JD relevance** within each role
7. **Duplicate check** — identical bullets silently dropped; similar bullets get a `similarityNotes` entry
8. **User-added sections** (from Section Review) treated as authentic — may be rewritten, never fabricated upon

---

## File Naming Convention

```
{CompanyName}_{JobTitle_max25chars}_{OutputType}.docx

Example: Novatrix_Executive Director of Plan_Resume.docx
```

- Job title truncated at 25 chars, no ellipsis
- Invalid filename chars (`/ \ : * ? " < > |`) replaced with underscore
- Files written to `/outputs/{CompanyName}/` on the server
- `buildFileName(companyName, jobTitle, outputType)` in `/shared/fileNaming.js`

---

## SSE Event Protocol

```js
// Step progress
{ type: 'step', step: 1, status: 'active' | 'complete' }

// Pipeline result
{ type: 'result', headers, experience, analysis, coverLetter,
  companyName, jobTitle, sectionsWereAdded }

// Error
{ type: 'error', message: 'Human-readable error string' }
```

Steps 1 & 2 in the optimize workflow are pre-marked complete before SSE starts
(scan and section review happen synchronously before the pipeline begins).

---

## Section Detection (11 sections)

**Required (5):** Contact Information, Professional Summary/Objective, Work Experience, Education, Skills/Core Competencies

**Optional (6):** Certifications & Licences, Tools & Technologies, Achievements & Awards, Publications & Presentations, Volunteer Work & Community, Languages

Section Review Screen only shown if ≥1 required section is missing.

---

## UI / Design Tokens

```
Navy:       #1F3864   — buttons, headers, borders
Blue:       #2E5DA6   — subheadings, role titles
Background: #F0F2F7   — page background
Success:    #27AE60   — STRONG match, ATS tip border
Warning:    #F39C12   — PARTIAL, missing optional
Error:      #E74C3C   — GAP, missing required
ATS tip bg: #EAF4EA   — light green tip box

Fonts: Playfair Display (headings/display), DM Sans (body)
Cards: border-radius 8px, box-shadow 0 4px 24px rgba(31,56,100,0.08)
Buttons: border-radius 50px (pill shape)
```

---

## What Is NOT Built Yet (Production Roadmap)

- User authentication (Clerk / Auth0 / Supabase)
- Resume history and versioning (database storage)
- PDF / Word file upload (pdf-parse + mammoth are installed, UI not wired)
- Cover letter tone selector (Professional / Conversational / Executive)
- Payments (Stripe — free tier + pay-per-use + subscription)
- Deployment (Vercel + Railway/Render, rate limiting, logging, analytics)

---

## Hard Rules — Never Violate

- `ANTHROPIC_API_KEY` must **never** appear in any frontend file
- Never call the Anthropic API from the browser — backend only
- Never use `localStorage` or `sessionStorage` in React components
- Never fabricate resume content in any prompt
- All SSE routes must call `res.end()` in both success and error paths
- `/api/export` handles all three docx types — do not create separate export endpoints
