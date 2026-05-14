# CLAUDE.md — Colemare / Resume Optimizer

> This is the public version of the AI context file used to guide Claude Code during development.
> It describes the codebase structure, conventions, and hard rules so any AI assistant
> (or human contributor) can work on this project without re-explanation.

---

## Project in one sentence

Colemare is an AI-powered resume optimizer that offers three workflows: score a resume against a JD, draft a tailored cover letter, or fully optimize the resume and generate both — all powered by Claude and delivered as formatted Word documents.

**Live:** https://colemare.vercel.app
**Repo:** https://github.com/sugavans/colemare

---

## How to run locally

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001  (proxied through Vite — always use :3000 in browser)
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 8.x, Tailwind CSS |
| Backend | Node.js, Express 5, ES Modules |
| AI | Anthropic Claude API — `@anthropic-ai/sdk ^0.30.0` |
| Word export | `docx` npm package (in-memory, returned as base64) |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Dev runner | `concurrently` (Express :3001 + Vite :3000) |

---

## Architecture: Three Workflows

### ✨ Optimize Everything (navy `#1F3864`)
`InputScreen` → `/api/scan` → (optional) `SectionReviewScreen` → `/api/optimize` (SSE, 7 steps) → `/api/export` → `ResultsScreen`

- Results: Score & Analytics tab + Optimized Resume tab + Cover Letter tab
- Downloads: Score & Analytics .docx + Resume .docx + Cover Letter .docx

### 📊 Score My Resume (teal `#0E7490`)
`InputScreen` → `/api/match-only` (SSE, 3 steps) → `/api/export` → `ResultsScreen`

- Results: Score & Analytics tab only
- Downloads: Score & Analytics .docx only

### ✉️ Draft Cover Letter (violet `#6D28D9`)
`InputScreen` → `/api/cover-letter` (SSE, 3 steps) → `/api/export` → `ResultsScreen`

- Results: Cover Letter tab only
- Downloads: Cover Letter .docx only

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/scan` | POST | Section detection + metadata. Sync JSON response. |
| `/api/optimize` | POST | Full 7-step pipeline via SSE. |
| `/api/match-only` | POST | Score & analytics pipeline via SSE. 3 steps. |
| `/api/cover-letter` | POST | Cover letter pipeline via SSE. 3 steps. |
| `/api/export` | POST | Generates all .docx files in parallel. Returns base64. |
| `/download/:company/:file` | GET | Serves generated files. |

---

## Model Routing

```
HAIKU  = 'claude-haiku-4-5-20251001'   // fast extraction tasks: scan, ATS preview
SONNET = 'claude-sonnet-4-6'           // all quality writing: headers, experience, analysis, cover letter
```

The optimize pipeline uses 6 Claude calls total:
- **Calls 1 + 2 run in parallel** (`Promise.allSettled`) — headers and experience bullets have no interdependency, saving ~15–20 seconds
- **Call 3 uses streaming** (`client.messages.stream()`) — large analysis responses (6,000 tokens) keep the TCP socket active, preventing `socket hang-up` errors on long requests
- **`withRetry` wrapper** — all calls retried up to 2× on transient errors (socket hang-up, ECONNRESET, 529) with 3s/6s backoff
- **`agentkeepalive`** with `keepAlive: false` — opens a fresh TCP connection per call; required because the SDK uses `KeepAlive.HttpsAgent` internally (passing plain `https.Agent` breaks the SDK)

Prompt caching is applied throughout — the JD text is always placed first in content arrays so cache prefixes stay consistent across calls, significantly reducing token costs.

---

## Key Files

```
server/routes/optimize.js   — All API routes + shared helpers
shared/prompts.js           — All system prompts
shared/docxGenerator.js     — generateResumeDocx, generateAnalysisDocx, generateCoverLetterDocx
shared/fileNaming.js        — buildFileName, buildFolderPath
shared/sectionDetector.js   — Section name constants
client/src/App.jsx          — Screen router, SSE reader, flow handlers
client/src/components/
  InputScreen.jsx           — 3-button layout, word count gate
  ProcessingScreen.jsx      — Mode-aware stepper (3 or 7 steps)
  ResultsScreen.jsx         — ScoreBanner, JobContextBar, tabs, download panel
  SectionReviewScreen.jsx   — Missing section detection and recovery
  Footer.jsx                — AI disclaimer
```

---

## SSE Event Protocol

```js
// Step progress
{ type: 'step', step: 1, status: 'active' | 'complete' }

// Pipeline result
{ type: 'result', headers, experience, analysis, coverLetter,
  companyName, jobTitle, sectionsWereAdded }

// Error
{ type: 'error', message: 'Human-readable string' }
```

---

## Section Detection (11 sections)

**Required (5):** Contact Information, Professional Summary/Objective, Work Experience, Education, Skills/Core Competencies

**Optional (6):** Certifications & Licences, Tools & Technologies, Achievements & Awards, Publications & Presentations, Volunteer Work & Community, Languages

Section Review Screen shown if ≥1 required section is missing.

---

## UI / Design Tokens

```
Navy:         #1F3864   — Optimize Everything
Teal:         #0E7490   — Score My Resume
Violet:       #6D28D9   — Draft Cover Letter
Blue:         #2E5DA6   — subheadings, accents
Background:   #F0F2F7
Success:      #27AE60
Warning:      #F39C12
Error:        #E74C3C

Fonts: Playfair Display (headings), DM Sans (body)
Cards: border-radius 8px
Buttons: border-radius 50px (pill)
```

---

## Cover Letter Format

The cover letter uses a structured format: opening paragraph (2–3 sentences) + 3–5 bullet points + closing sentence. Bullets follow the `• Skill: evidence` pattern, where the skill label is bolded in both the web UI and the Word export. Total word count (excluding salutation/sign-off): 150–200 words.

---

## Hard Rules — Never Violate

- `ANTHROPIC_API_KEY` must **never** appear in any frontend file
- Never call the Anthropic API from the browser — backend only
- Never use `localStorage` or `sessionStorage` in React components
- Never fabricate resume content in any prompt
- All SSE routes must call `res.end()` in both success and error paths
- `/api/export` handles all three docx types — do not create separate export endpoints
- docx files are generated in memory as base64 — no filesystem writes
- Use `callClaudeStreaming` (not `callClaude`) for any call expected to return 3,000+ output tokens
- Always wrap API calls in `withRetry` — never call the Anthropic client directly

---

## File Naming Convention

```
{CompanyName}_{JobTitle_25chars}_{OutputType}.docx
Example: Novatrix_Executive Director of Plan_Resume.docx
```

---

*Built with Claude Code · Powered by Anthropic Claude API*
