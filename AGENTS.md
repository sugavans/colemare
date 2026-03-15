# AGENTS.md — Colemare / Resume Optimizer

This file is read automatically by AI coding agents (Cursor, GitHub Copilot Workspace,
OpenAI Codex, and others) at the start of every session. It contains everything an agent
needs to work on this codebase without additional explanation.

---

## What this project is

**Colemare** is a full-stack AI-powered resume optimizer. Users paste a resume and job
description; the app offers three workflows (optimize, match-only, cover-letter-only) and
produces downloadable Word documents. The AI backbone is Anthropic's Claude API.

**Repository:** `https://github.com/sugavans/colemare`

---

## Local setup

```bash
npm install
cp .env.example .env        # populate ANTHROPIC_API_KEY
mkdir outputs
npm run dev
# → http://localhost:3000 (Vite, proxies /api to :3001)
# → http://localhost:3001 (Express)
```

**Node ≥ 18 required.**

---

## Project structure

```
/
├── client/src/
│   ├── App.jsx                     Screen router + flow handlers + SSE utilities
│   ├── index.css                   Global styles (btn-primary, badge-*, spinner)
│   └── components/
│       ├── InputScreen.jsx         3-button entry, ATS tip, 700-word gate
│       ├── ProcessingScreen.jsx    Step-aware progress stepper
│       ├── ResultsScreen.jsx       All output tabs + download bar + action bar
│       ├── SectionReviewScreen.jsx Missing section handling (Add / Map / Proceed)
│       ├── SectionStatusPanel.jsx  FOUND / PARTIAL / MISSING badges
│       ├── AddSectionsEditor.jsx   Per-section inline textarea editor
│       ├── SectionMapper.jsx       Section clarification / remapping tool
│       └── Footer.jsx              AI disclaimer footer
├── server/
│   ├── server.js                   Express app, /download static route
│   └── routes/optimize.js          All API routes + shared backend helpers
├── shared/
│   ├── prompts.js                  All Claude system prompts + assembleOptimisedResumeText
│   ├── sectionDetector.js          Section name constants
│   ├── fileNaming.js               buildFileName + buildFolderPath
│   └── docxGenerator.js            Word document generators (Resume, Analysis, CoverLetter)
├── outputs/                        Generated .docx files — gitignored
├── test-data/                      5 resumes + 3 JDs + testing guide
├── CLAUDE.md                       Claude-specific context (detailed)
├── AGENTS.md                       This file
└── .env.example                    Environment variable template
```

---

## Technology stack

- **Frontend:** React 18, Vite 8, Tailwind CSS, DM Sans + Playfair Display (Google Fonts)
- **Backend:** Node.js + Express (ESM modules — `"type": "module"` in package.json)
- **AI:** `@anthropic-ai/sdk ^0.30.0`, models defined as constants in `optimize.js`
- **Word export:** `docx` npm package
- **Dev:** `concurrently`, `node --watch`

---

## Models

```js
const HAIKU  = 'claude-haiku-4-5-20251001'  // fast/cheap: scan + metadata only
const SONNET = 'claude-sonnet-4-6'          // quality: all optimisation work
```

**Never change the model constants without updating the PRD and CLAUDE.md.**

---

## API routes

| Route | Description |
|---|---|
| `POST /api/scan` | Haiku: section detection + company/title. Returns JSON. |
| `POST /api/optimize` | Sonnet Calls 1–4: full pipeline via SSE. |
| `POST /api/match-only` | Haiku meta + Sonnet analysis via SSE. |
| `POST /api/cover-letter` | Haiku meta + Sonnet draft via SSE. |
| `POST /api/export` | Generates all applicable .docx files in `Promise.all`. |
| `GET /download/:co/:file` | Static file download from `/outputs`. |

**There is no `/api/export-cover-letter` route.** `/api/export` handles all three document
types. Do not create separate export endpoints.

---

## SSE protocol

All pipeline routes (`/api/optimize`, `/api/match-only`, `/api/cover-letter`) use
Server-Sent Events. Each event is a newline-delimited JSON line:

```
data: {"type":"step","step":3,"status":"active"}\n\n
data: {"type":"step","step":3,"status":"complete"}\n\n
data: {"type":"result",...payload}\n\n
```

Error:
```
data: {"type":"error","message":"Human-readable string"}\n\n
```

Every SSE route must call `res.end()` in both success and error paths.

The frontend `readSSE(url, body, onEvent)` utility in `App.jsx` handles reading — do not
duplicate the fetch + ReadableStream loop.

---

## Prompt caching rules

1. System prompts always have `cache_control: { type: 'ephemeral' }` — never omit this.
2. JD text must be the **first** content block and marked `cache: true` in Calls 1–4.
3. Resume text is the **second** block, `cache: true` in Calls 1 and 2.
4. Block ordering must be identical across calls for cache reads to fire.
5. Do not reorder content blocks without understanding the cache prefix implications.

---

## Input validation rules

All three entry buttons share the same enabled condition:

```js
const totalWords  = wordCount(resumeText) + wordCount(jobDescription);
const enoughWords = totalWords >= 700;
const bothFilled  = resumeText.trim() && jobDescription.trim() && enoughWords;
```

Do not lower the 700-word threshold or create per-button conditions.

---

## Content / prompt rules — never violate

1. Never fabricate information not in the original resume (no invented metrics, names, outcomes)
2. Use `%` directly — never spell out "percent"
3. Carry forward ™ and ® symbols exactly as written in the original
4. Every experience bullet: what/how/so-what structure, starts with past-tense action verb
5. No em-dashes (—) or arrow symbols (→) inside bullets — commas only
6. User-added sections (from Section Review) are authentic content — may be rewritten, never fabricated upon
7. Cover letter (Call 4): non-blocking — failure must not abort the rest of the pipeline

---

## File naming convention

```
{CompanyName}_{JobTitle_max25chars}_{OutputType}.docx
```

- Job title: truncated at 25 chars, no ellipsis
- Invalid filename chars (`/ \ : * ? " < > |`) → underscore
- Output path: `/outputs/{CompanyName}/{filename}`
- Always use `buildFileName()` and `buildFolderPath()` from `shared/fileNaming.js`
- Always call `fs.mkdirSync(folderPath, { recursive: true })` before writing

---

## Hard rules for agents

| Rule | Detail |
|---|---|
| API key security | `ANTHROPIC_API_KEY` must never appear in any file under `client/`. Backend only. |
| No browser storage | Never use `localStorage` or `sessionStorage` in React code. Use React state. |
| No new export endpoints | `/api/export` handles all three document types. Don't split it. |
| ESM only | All server files use `import/export`. No `require()`. |
| No class components | React: functional components with hooks only. |
| Tailwind only | No separate CSS files. Use Tailwind utility classes + `index.css` for custom tokens. |
| res.end() always | Every SSE route must call `res.end()` in both the success and all error paths. |
| safeParseJSON always | Never use `JSON.parse()` directly on Claude API responses. Use `safeParseJSON()`. |

---

## What is not built yet

Do not implement these without explicit instruction:

- User authentication or sessions
- Database / resume history storage
- File upload UI (pdf-parse and mammoth are installed but not wired to the UI)
- Cover letter tone selector
- Stripe payments
- Production deployment configuration

---

## Testing

Test data is in `/test-data/`. See `TESTING-GUIDE.md` for the full test matrix.

Five test resumes cover: complete resume, missing summary, missing summary + skills,
non-standard headings, missing three required sections.

Three test JDs: Senior Product Manager, Senior Data Engineer, Performance Marketing Manager.

Run all three workflows against each resume × JD combination before releasing changes.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — never expose to frontend |
| `PORT` | No | Express port (default: 3001) |
| `CLIENT_ORIGIN` | No | CORS origin (default: http://localhost:3000) |
