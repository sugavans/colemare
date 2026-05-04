# COLEMARE — PRODUCT REQUIREMENTS DOCUMENT

**Version 2.0** | April 2026 | Built from PRD v1.2 + Full Build Session

> **Changes from v1.2:** Three-workflow architecture · Prompt pipeline v2 · Score & Analytics tab (merged ATS + Analysis) · Sub-navigation within tabs · Job context bar · Redesigned download panel · Resume header restructured · American English standardized · Six API optimization fixes · Full production deployment

---

## CHANGE LOG

| Version | Date | Key Changes |
|---|---|---|
| v1.0 | — | Original MVP spec |
| v1.1 | — | ATS formatting note · section detection refinements |
| v1.2 | — | Section Review Screen · 6-step stepper · ATS note · file naming |
| **v2.0** | **Apr 2026** | **Three workflows · Score & Analytics tab · Job context bar · Prompt v2 · Caching fixes · Production deployed** |

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Vision
Colemare is an AI-powered resume personalization tool that helps job seekers present the best version of their professional self for a specific role. It offers three distinct workflows — score, draft, and fully optimize — all powered by the Anthropic Claude API. Every output is downloadable as a formatted Word document.

**Live URL:** https://colemare.vercel.app
**Repository:** https://github.com/sugavans/colemare

### 1.2 Core Philosophy
- **Quality over volume** — one well-tailored application beats ten generic ones
- **No fabrication** — every word in the output is grounded in the original resume
- **Honest scoring** — match scores reflect reality, not what users want to hear
- **Full ownership** — the user decides what to use, tweak, or ignore
- **No guarantees** — the tool helps you present yourself well; networking is still on the user

### 1.3 Target Users
- Primary: General professional job seekers across all industries
- Secondary: Career coaches and HR consultants using the tool on behalf of clients

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 8.x, Tailwind CSS, DM Sans + Playfair Display fonts |
| **Backend** | Node.js, Express 5, ES Modules |
| **AI** | Anthropic Claude API — `@anthropic-ai/sdk ^0.30.0` |
| **Word export** | `docx` npm package — all files generated in memory, returned as base64 |
| **Frontend hosting** | Vercel — auto-deploys from GitHub on every push |
| **Backend hosting** | Railway Hobby plan — always-on, auto-deploys from GitHub |
| **Rate limiting** | `express-rate-limit` — 10 pipeline / 30 scan requests per IP per hour (production); 100/500 in development |
| **Dev runner** | `concurrently` — runs Express (port 3001) + Vite (port 3000) in parallel |

### 2.1 Model Routing

| Constant | Model ID | Used for |
|---|---|---|
| `HAIKU` | `claude-haiku-4-5-20251001` | Call 0 (scan), Call 5 (ATS preview) |
| `SONNET` | `claude-sonnet-4-6` | Calls 1–4 (all quality work) |

### 2.2 Environment Variables

**Railway (backend):**
```
ANTHROPIC_API_KEY=sk-ant-api03-...
CLIENT_ORIGIN=http://localhost:3000,https://colemare.vercel.app
```

**Vercel (frontend):**
```
VITE_API_URL=https://colemare-production.up.railway.app
```

---

## 3. THREE WORKFLOWS

This is the most significant architectural change from v1.2. The single Optimize workflow has been split into three independent workflows with distinct purposes, button colors, and output sets.

| Button | Mode | Model calls | Output |
|---|---|---|---|
| 📊 **Score My Resume** | `match` | Haiku scan + Sonnet analysis ∥ Haiku ATS preview | Score & Analytics .docx |
| ✉️ **Draft Cover Letter** | `coverletter` | Haiku scan + Sonnet cover letter | Cover Letter .docx |
| ✨ **Optimize Everything** | `optimize` | Haiku scan → Sonnet (×3) → Sonnet CL ∥ Haiku ATS | Resume + Score & Analytics + Cover Letter .docx |

### 3.1 Button Color Scheme (consistent across input page, tabs, and download buttons)
- Score My Resume / Score & Analytics: **Teal `#0E7490`**
- Draft Cover Letter / Cover Letter: **Violet `#6D28D9`**
- Optimize Everything / Optimized Resume: **Navy `#1F3864`**

---

## 4. API PIPELINE — FULL SPECIFICATION

### 4.1 Optimize Everything Pipeline (7 steps)

```
[Pre-step]  Call 0  — Haiku   — Section scan + metadata (jobLocation, workType, companyName, jobTitle)
Step 2      ✓       — User completes section review (or auto-skips if all required sections present)
Step 3      pause   — 350ms UX delay "Analyzing inputs"
Step 4      Call 1  — Sonnet  — Rewrite header sections (title, summary, skills, tools) — 3000 tokens
Step 5      Call 2  — Sonnet  — Rewrite experience bullets — 4096 tokens
Step 6      Call 3  — Sonnet  — Match analysis on optimized resume — 8000 tokens
Step 7      Calls 4+5 (parallel) — Sonnet cover letter (1500t) ∥ Haiku ATS preview (1400t)
```

**Key detail:** `optimisedText` (assembled from Call 1+2 output) is hoisted above the Call 3 try block so Call 5 evaluates the **optimized** resume, not the original.

### 4.2 Score My Resume Pipeline (3 steps)

```
Step 1  Call 0   — Haiku  — Metadata extraction
Step 2  Parallel — Sonnet analysis (8000t) ∥ Haiku ATS preview (1400t)
Step 3  ✓        — Complete
```

Both calls in Step 2 run simultaneously via `Promise.allSettled`. If either fails, the other still delivers.

### 4.3 Draft Cover Letter Pipeline (3 steps)

```
Step 1  Call 0  — Haiku  — Metadata extraction
Step 2  Sonnet  — Cover letter draft (1500t)
Step 3  ✓       — Complete
```

### 4.4 Prompt Caching Strategy

| Call | System prompt | JD text | Resume text |
|---|---|---|---|
| Call 0 (Haiku scan) | `cache_control: ephemeral` | Not cached | Not cached |
| Call 1 (headers) | `cache_control: ephemeral` | `cache: true` | `cache: true` |
| Call 2 (experience) | `cache_control: ephemeral` | `cache: true` ← read | `cache: true` ← read |
| Call 3 (analysis) | `cache_control: ephemeral` | `cache: true` ← read | Not cached (optimized text, new each run) |
| Call 4 (cover letter) | `cache_control: ephemeral` | `cache: true` ← read | Not cached |
| Call 5 (ATS preview) | `cache_control: ephemeral` | `cache: true` ← read | Not cached (uses optimized text) |
| match-only/analysis | `cache_control: ephemeral` | `cache: true` | `cache: true` |
| match-only/ats-preview | `cache_control: ephemeral` | `cache: true` ← read | `cache: true` ← read |
| cover-letter/draft | `cache_control: ephemeral` | `cache: true` | `cache: true` |

### 4.5 Call 0 — Scan JSON Schema (Haiku)

```json
{
  "companyName": "string — from JD. Default: Unknown_Company",
  "jobTitle": "string — from JD. Default: Unknown_Role",
  "jobLocation": "string — city/state/country from JD. Default: Not available",
  "workType": "Remote | Hybrid | On-site | Not available",
  "sectionsFound": ["section names present with meaningful content"],
  "sectionsPartial": ["sections present but thin"],
  "sectionsMissing": [{ "sectionName": "string", "required": true|false, "suggestion": "string" }]
}
```

---

## 5. PROMPT PIPELINE v2 — RULES

### 5.1 Call 1 — Header Sections (Sonnet)

**Summary structure:** Exactly 3 sentences using forward-verb structure:
`[Forward verb] to [JD capability], as demonstrated by [specific experience + metric].`
Forward verbs: Positioned to / Equipped to / Primed to / Built to / Ready to — never repeat.

**Skills:** Three-cluster ordering:
1. Domain identity — what the candidate specializes in (JD primary nouns)
2. Technical/functional core — JD required and strongly preferred items
3. Leadership and operational — supporting qualifiers

**Rule:** Drop any skill with zero supporting bullet evidence in the experience section.

### 5.2 Call 2 — Experience Bullets (Sonnet)

Six-step pipeline run in this order:
1. **Deduplication** — metric duplicates, source duplicates, semantic duplicates (within-role then cross-role)
2. **Role Summary bullet** — one declarative "Served as [accountability] across [scope], with emphasis on [JD themes]" — 35 words max, does not count toward bullet limits
3. **Audit** — each bullet checked for: strong action verb, specific tools/methods, WHAT/HOW/SO WHAT, JD relevance
4. **Rewrite** — only bullets failing audit are rewritten
5. **Bullet count by seniority** — most recent/senior: 5–7; mid-career: 3–4; earlier: 2–3
6. **Order by JD priority** — principal duties first, then required quals, then preferred, then soft skills

**SO WHAT invalid patterns:** scope labels, process goals, role labels, vague results.

### 5.3 Call 3 — Match Analysis (Sonnet)

Returns:
- `overallScore` (0–100), `requirementsAnalysed`, `strengths` (3 items)
- `requirements[]` — each with: name, score, status (STRONG/PARTIAL/GAP), **disposition** (LEAD_WITH_CONFIDENCE / REFRAME_TO_STRENGTHEN / HANDLE_CAREFULLY / OMIT), coveredBy, suggestion
- `gaps[]` — priority (HIGH/MEDIUM/LOW), description, suggestion
- `atsKeywords` — present[], missing[]
- `gapActionPlan[]` — item, disposition, interviewPrep sentence

### 5.4 Call 5 — ATS Preview (Haiku)

Returns structured JSON simulating ATS evaluation:
- `atsScore`, `keywordMatch`, `hardReqsMet` {met, total}
- `disposition` — "Advance — screen" | "Advance — interview" | "Hold — borderline" | "Pass — insufficient fit"
- `dispositionColor` — green | amber | red
- `summary` — one sentence for talent partner
- `eligibilityChecks[]` — requirement, evidence, result (pass/fail/caution)
- `scoringBreakdown[]` — dimension, score (0–100)

**Important:** This is a simulated evaluation. A disclaimer is shown in every UI location and in the downloaded document.

### 5.5 Content Rules (all calls)
- Never fabricate metrics, company names, outcomes, or tools not in the original resume
- Use American English spelling throughout (analyze, organize, recognize, prioritize)
- Never use em-dashes (—) — use commas or semicolons instead
- Use % symbol directly — never spell out "percent"
- Carry forward ™ and ® symbols exactly as written
- No em-dashes in cover letter text

---

## 6. RESULTS SCREEN — UI SPECIFICATION

### 6.1 Layout (top to bottom)

1. **Start Over button** — top right, above everything
2. **Score Banner** — overall match %, strengths badges (optimize + match modes only)
3. **Job Context Bar** — navy background, persistent across all tabs:
   - Role | Company | Location + workType badge (Remote/Hybrid/On-site) | Candidate name + green dot
4. **Download Panel** — white card, teal left border:
   - Label: "Your outputs are ready" + "Download any document as a formatted Word file (.docx)"
   - Grouped buttons in grey pill container: ⬇ Score & Analytics (teal) · ⬇ Resume (navy) · ⬇ Cover Letter (violet)
5. **Back to Inputs + Upgrade CTA** — match and cover-letter modes only
6. **Tab bar** — color-coded dots + active tint:
   - 📊 Score & Analytics (teal) — first, default tab
   - 📄 Optimized Resume (navy) — optimize mode only
   - ✉️ Cover Letter (violet)
7. **Tab content**
8. **Footer** — "This is an AI tool. Please double-check the outputs."

### 6.2 Score & Analytics Tab

This tab consolidates what was previously two separate tabs (ATS Preview + Match Analysis) into a unified view with four sub-tabs.

**Persistent header (always visible):**
- 4 scorecards: ATS Score / Keyword Match / Hard Reqs Met / Disposition
- "Your next step" callout — derived from analysis data, no extra API call

**Simulation disclaimer** (always shown at top of tab):
> ⚠️ Simulation notice: ATS scores and eligibility checks are AI-simulated for self-assessment only. They do not represent the output of any real employer ATS system.

**Sub-navigation (4 views):**

| Sub-tab | Content |
|---|---|
| 📋 Overview | Scoring breakdown bars (from ATS preview) + Requirements summary grouped by disposition |
| ✅ Eligibility | Full eligibility checks table with PASS/FAIL/CAUTION badges |
| ⚠️ Gaps | Gap Action Plan with interview prep sentences + Skill Gaps & Recommendations |
| 🔑 Keywords | ATS keyword audit (present/missing pills) + Requirements Analysis with disposition badges |

### 6.3 Optimized Resume Tab
- Contact parsing: `headers.contact` split by `|` to extract candidate name, LinkedIn, job title, and remaining contact info
- Rendering order: Company · Role title + dates · Company description (italic) · Role Summary bullet (italic, navy left border) · Detail bullets

### 6.4 Cover Letter Tab
- Rendered with `parseCoverLetterLine()` — handles `- **bold**` and `- plain` markdown as proper bullet points
- Download button: violet, label "⬇ Cover Letter"

---

## 7. WORD DOCUMENT EXPORT SPECIFICATION

### 7.1 Resume.docx Header Structure

```
[Candidate Name]    — Palatino Linotype, 40pt, navy, centered
[LinkedIn URL]      — Calibri, 17pt, blue #2E5DA6, centered (only if present in contact)
[Job Title]         — Calibri, 26pt, navy bold, centered
[email | phone | location]  — Calibri, 18pt, gray, centered
```
Contact string is parsed into parts by `|` separator. LinkedIn is identified by `linkedin.com`.

### 7.2 Score & Analytics Report.docx Structure

```
"Score & Analytics Report"  — title, centered, Palatino Linotype
"Company — Role"            — subtitle
Overall Match Score: X%     — (Y requirements analyzed)

ATS DASHBOARD (when atsPreview available)
  ├─ Simulation disclaimer
  ├─ 4-cell scorecard table: ATS Score | Keyword Match | Hard Reqs Met | Disposition
  ├─ Eligibility Checks table (Requirement / Evidence / Result)
  └─ Scoring Breakdown (dimension + percentage)

ATS KEYWORD AUDIT
  ├─ Present keywords list
  └─ Missing keywords list

GAP ACTION PLAN
  └─ Disposition + interview prep sentence per gap

REQUIREMENTS ANALYSIS
  └─ Table: Requirement | Score | Status | Action | Covered By | Suggestion

SKILL GAPS & RECOMMENDATIONS
  └─ Priority (HIGH/MEDIUM/LOW) + description + suggestion
```

### 7.3 Cover Letter.docx
- Salutation through closing, formatted prose
- `- **bold**` markdown rendered as Word bullet paragraphs with bold runs
- `stripEmDashes()` applied before rendering

### 7.4 File Naming Convention
```
{CompanyName}_{JobTitle_25chars}_{OutputType}.docx
```
Helper: `buildFileName(companyName, jobTitle, outputType)` in `/shared/fileNaming.js`
All documents generated in memory, returned as base64 strings — no filesystem writes.

---

## 8. INPUT SCREEN SPECIFICATION

### 8.1 Layout
- Two-column side-by-side (desktop) / single column (mobile <768px)
- Live word count beneath each textarea
- ATS tip below resume textarea (light green `#EAF4EA`, green left border `#27AE60`)

### 8.2 Three-Button CTA
Buttons are fixed width (176px), identical padding. Disabled until both fields have ≥ 700 combined words.

### 8.3 Feature Strip
Three cards below the CTA buttons, aligned to the three workflows:
- 📊 **Score My Resume** (teal) — "Scores your resume against every JD requirement with an honest match percentage and ATS keyword audit."
- ✉️ **Draft Cover Letter** (violet) — "Writes a tailored cover letter that connects your real experience to the employer's specific needs — no fabrication."
- ✨ **Optimize Everything** (navy) — "Rewrites every bullet, reorders your skills, and delivers a scored analysis and cover letter — all in one run."

### 8.4 Validation
- Empty field: "Please paste both your resume and job description before continuing."
- Identical content: "Your resume and job description appear to be identical. Please check and correct before continuing."

---

## 9. PROJECT FILE STRUCTURE

```
/colemare (git root)
  /client
    /src
      App.jsx                    — Screen router, SSE reader, all 3 flow handlers
      index.css                  — btn-match, btn-cl, btn-opt, btn-primary, btn-secondary, badge-*, spinner
      /components
        InputScreen.jsx           — 3-button layout, ATS tip, 700-word gate, duplicate check
        ProcessingScreen.jsx      — Mode-aware stepper (3 or 7 steps), cold-start warning (8s)
        ResultsScreen.jsx         — ScoreBanner, JobContextBar, DownloadBar, tabs, ScoreAnalyticsTab,
                                    ResumeTab, CoverLetterTab, SectionDivider, Footer
        SectionReviewScreen.jsx   — Section detection UI
  /server
    server.js                    — Express 5, CORS (multi-origin), rate limiting, favicon 204
    /routes
      optimize.js                — 5 API routes + helpers (setupSSE, emit, callClaude, safeParseJSON,
                                    logCacheStats, extractMeta)
  /shared
    prompts.js                   — 6 system prompts + buildScanUserPrompt + assembleOptimisedResumeText
    docxGenerator.js             — generateResumeDocx, generateAnalysisDocx, generateCoverLetterDocx
    fileNaming.js                — buildFileName (25-char truncation), buildFolderPath
    sectionDetector.js           — Section name constants
  .env                           — API keys (never commit)
  .gitignore                     — .env, node_modules, outputs
  package.json                   — All dependencies including overrides for security fixes
  vite.config.js                 — Proxy /api to :3001, timeout: 120s, keep-alive
  tailwind.config.js             — Custom tokens: navy, match-color, cl-color, opt-color
  CLAUDE.md                      — AI context file (read by Claude Code automatically)
  AGENTS.md                      — Universal AI agent context file
```

---

## 10. ERROR HANDLING

| Scenario | Behavior |
|---|---|
| Call 0 (scan) fails | Skip Section Review Screen entirely, proceed with defaults. Non-blocking banner: "Section check unavailable." |
| Call 1–3 fails | Show error banner + Try Again button. **Input text preserved** — `handleRetry` resets error state only |
| Calls 4+5 (parallel) — one fails | Other still delivers. If cover letter fails, atsPreview still shown. If ATS fails, cover letter still delivered |
| `atsPreview` unavailable | Score & Analytics tab shows "ATS scoring not available for this run" — no crash |
| Export (docx generation) fails | 500 error with "Failed to generate documents. Please try again." |
| Cold start (Railway) | ProcessingScreen shows warm-up notice after 8 seconds if no SSE event received |
| Firewall / connection error | Anthropic client: `timeout: 120_000ms`, `maxRetries: 2` — auto-retries twice before failing |
| Rate limit hit | 429 response: "Too many requests. Please try again in an hour." |

---

## 11. DESIGN TOKENS

| Token | Value | Used for |
|---|---|---|
| `navy` | `#1F3864` | Primary, Optimize Everything, Resume tab |
| `blue` | `#2E5DA6` | Subheadings, accents |
| `match-color` | `#0E7490` | Teal — Score My Resume, Score & Analytics |
| `cl-color` | `#6D28D9` | Violet — Draft Cover Letter, Cover Letter tab |
| `bg` | `#F0F2F7` | Page background |
| `surface` | `#FFFFFF` | Card backgrounds |
| `success` | `#27AE60` | Strong match, pass indicators |
| `warning` | `#F39C12` | Partial match, caution, amber |
| `danger` | `#E74C3C` | Gap indicators, fail, red |
| `heading-font` | Playfair Display | Hero text and document titles |
| `body-font` | DM Sans | All UI text |
| `border-radius` | 8px cards, 50px buttons/badges | Consistent rounding |

---

## 12. SECURITY & INFRASTRUCTURE

### 12.1 API Key Security
- Anthropic API key in `.env` only — never in frontend code
- All API calls server-side only (Express backend)
- Frontend calls `POST /api/[route]` — backend calls Anthropic

### 12.2 Security Fixes Applied (package.json overrides)
```json
"overrides": {
  "picomatch": "^4.0.2",
  "@xmldom/xmldom": ">=0.8.12",
  "lodash": ">=4.17.24"
}
```
Express upgraded to v5 (fixes path-to-regexp CVE). Vite at `^8.0.5` (fixes 3 path traversal CVEs).

### 12.3 SSE Architecture
All three pipeline routes stream results via Server-Sent Events. A 15-second heartbeat ping keeps Railway connections alive during long Claude API calls.

### 12.4 Rate Limiting
```
Production:   10 pipeline / 30 scan requests per IP per hour
Development:  100 pipeline / 500 scan requests per IP per hour
Detection:    IS_DEV = !CLIENT_ORIGIN || CLIENT_ORIGIN.includes('localhost')
```

---

## 13. PRODUCTION DEPLOYMENT

### 13.1 URLs
- Frontend: https://colemare.vercel.app
- Backend: https://colemare-production.up.railway.app
- Health check: https://colemare-production.up.railway.app/health

### 13.2 Deploy Process
```bash
git add -A
git commit -m "description"
git push  # triggers Railway + Vercel auto-deploy
```

### 13.3 Local Development
```bash
cd ~/Documents/resume-optimizer
npm install
npm run dev  # starts :3000 (Vite) + :3001 (Express) concurrently
```

**Update script** (saves .env across fresh installs):
```bash
~/update-colemare.sh
```

---

## 14. PRODUCTION FEATURES — ROADMAP (Not yet built)

These are specified but not implemented. Do not build during the current phase.

### 14.1 User Authentication (Clerk)
Email/password + Google OAuth. Session management with httpOnly cookies.

### 14.2 Resume & Project Storage (Supabase)
Save optimizations with project name. History dashboard showing company, role, score, sections status. Versioning.

### 14.3 File Upload Support
PDF (pdf-parse) and Word (mammoth) upload with text extraction preview. 5MB limit. ATS warning if formatting issues detected.

### 14.4 Deep Mode (Interactive Q&A)
Multi-turn conversation pipeline where Claude pauses at `[ASK CANDIDATE]` markers to request clarification before rewriting. Requires a new conversational UX screen rather than the single-run pipeline. Estimated 3–6 additional API calls per run.

### 14.5 Payments (Stripe)
Free tier: 3 optimizations/month. Pay-per-use: $3–5. Monthly subscription: $19–29. Stripe Customer Portal for billing management.

### 14.6 Analytics (PostHog)
Events to track: `optimize_started`, `optimize_completed`, `download_clicked`, `tab_switched`. Required before Week 5 LinkedIn post for retrospective data.

### 14.7 Custom Domain
colemare.co — ~$12/yr on Namecheap. Deferred until after Week 4 LinkedIn named launch.

---

## 15. LINKEDIN LAUNCH STRATEGY (Active)

5-week progressive reveal series. See `/colemare-linkedin-strategy.md` for full post drafts.

| Week | Theme | Status |
|---|---|---|
| 1 | Philosophy Hook | ✅ Posted |
| 2 | Product Reveal | ✅ Posted |
| Nudge | One-question feedback ask | ✅ Posted |
| 3 | Building in Public — honest pivot | 🔜 This Wednesday |
| 4 | Named Launch — introduce Colemare, share URL | ⏳ Following Wednesday |
| 5 | PM Retrospective — requires PostHog data | ⏳ Week after Week 4 |

---

## 16. KNOWN CONSTRAINTS AND TECHNICAL DECISIONS

| Decision | Rationale |
|---|---|
| `optimisedTitle`, `assembleOptimisedResumeText` use British spelling in code | Internal identifiers — renaming requires coordinated changes across 3 files with no user-facing benefit. Left as-is. |
| `sanitiseContact`, `normaliseSectionName` function names | Same — internal identifiers, comments updated to American English |
| Haiku for Call 0 and Call 5 | Call 0: fast metadata extraction, cheap. Call 5: structured classification, not creative writing |
| No filesystem writes on server | Railway ephemeral filesystem wipes on redeploy — all docx in memory as base64 |
| Vite proxy timeout 120s | Cover letter + ATS parallel calls can take 60-90s on large inputs — default proxy timeout kills connection |
| `Promise.allSettled` for parallel calls | If one fails, the other still delivers — pipeline doesn't crash on non-critical failures |
| ATS Preview disclaimer everywhere | Legal and ethical — this is simulated, not real ATS output |

---

*Colemare PRD v2.0 | April 2026 | Confidential*
