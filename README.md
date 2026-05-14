# Colemare — AI-Powered Resume Optimizer

An AI-powered web application that offers three workflows: score a resume against a job description, draft a tailored cover letter, or fully optimize the resume and generate both — all powered by Anthropic Claude and delivered as formatted Word documents.

**Live:** https://colemare.vercel.app

Built with React 18, Express, and the Anthropic Claude API — using **claude-haiku-4-5-20251001** for fast section detection and **claude-sonnet-4-6** for all quality writing, with prompt caching and SSE streaming throughout.

---

## Prerequisites

- **Node.js** v18.11 or higher ([download](https://nodejs.org))
- An **Anthropic API key** ([get one](https://console.anthropic.com))

Verify your Node version:
```bash
node --version   # must be v18.11.0 or higher
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/sugavans/colemare.git
cd colemare
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...   # required
PORT=3001                             # optional, defaults to 3001
CLIENT_ORIGIN=http://localhost:3000  # optional, defaults to http://localhost:3000
```

> ⚠️ **Never commit `.env`** — it is already in `.gitignore`.

---

## Starting the Development Server

```bash
npm run dev
```

This starts both the frontend and backend concurrently:

| Service | URL |
|---|---|
| Frontend (React + Vite) | http://localhost:3000 |
| Backend (Express API) | http://localhost:3001 |

Open **http://localhost:3000** in your browser.

---

## Three Workflows

| Button | Purpose | Output |
|---|---|---|
| 📊 **Score My Resume** | Scores every JD requirement against your resume with an honest match % and ATS keyword audit | Score & Analytics .docx |
| ✉️ **Draft Cover Letter** | Writes a tailored cover letter grounded in your real experience — opening paragraph + 3–5 skill bullets + closing | Cover Letter .docx |
| ✨ **Optimize Everything** | Rewrites your resume bullets, reorders skills, scores against the JD, and generates a cover letter in one run | Resume + Score & Analytics + Cover Letter .docx |

All three buttons require a combined minimum of 700 words across resume and job description.

---

## How to Use

1. **Paste your resume** as plain text into the left textarea. Follow the ATS tip shown below the input.
2. **Paste the job description** into the right textarea.
3. Click any of the three workflow buttons.
4. If any required resume sections are missing, a **Section Review** screen appears — you can add content, map non-standard headings, or proceed as-is.
5. Watch the **7-step progress stepper** (optimize) or **3-step stepper** (score / cover letter) update in real time via Server-Sent Events.
6. On the **Results screen**:
   - **Score & Analytics tab** — ATS dashboard, eligibility checks, gap action plan, keyword audit
   - **Optimized Resume tab** — fully rewritten resume aligned to the JD (optimize mode only)
   - **Cover Letter tab** — tailored cover letter with skill bullets (optimize + cover letter modes)
   - **Download buttons** — export any output as a formatted `.docx` file

---

## Project File Structure

```
colemare/
├── client/                            # React 18 frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── main.jsx                   # React entry point
│       ├── index.css                  # Tailwind base + custom tokens
│       ├── App.jsx                    # Root component — screen routing, SSE reader, flow handlers
│       └── components/
│           ├── InputScreen.jsx        # 3-button entry, ATS tip, 700-word gate
│           ├── SectionReviewScreen.jsx # Missing section detection and recovery
│           ├── ProcessingScreen.jsx   # Mode-aware SSE progress stepper (3 or 7 steps)
│           ├── ResultsScreen.jsx      # Score banner, Job context bar, tabs, download panel
│           ├── SectionStatusPanel.jsx # FOUND / PARTIAL / MISSING badges
│           ├── AddSectionsEditor.jsx  # Inline form for adding missing sections
│           ├── SectionMapper.jsx      # Map non-standard headings to standard sections
│           └── Footer.jsx             # AI disclaimer
├── server/
│   ├── server.js                      # Express entry point (port 3001)
│   └── routes/
│       └── optimize.js                # All API routes + helpers
├── shared/
│   ├── prompts.js                     # All Claude prompt templates
│   ├── docxGenerator.js               # Word document generation (in-memory, base64)
│   ├── fileNaming.js                  # buildFileName() — 25-char truncation + sanitization
│   └── sectionDetector.js             # Section name constants (11 sections)
├── outputs/                           # Generated files, gitignored
├── test-data/                         # 5 test resumes + 3 JDs + testing guide
├── .env.example                       # Environment variable template
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── README.md
```

---

## API Pipeline

### Optimize Everything (6 Claude calls)

| Call | Model | Purpose | Notes |
|---|---|---|---|
| 0 | Haiku | Section scan + metadata | Sync; triggers Section Review if sections missing |
| 1 + 2 | Sonnet | Headers ∥ Experience bullets | **Parallel** — saves ~15–20 seconds |
| 3 | Sonnet | Match analysis (6,000 tokens) | **Streaming** — prevents socket hang-up on large responses |
| 4 | Sonnet | Cover letter draft | Parallel with Call 5 |
| 5 | Haiku | ATS preview simulation | Parallel with Call 4 |

### Score My Resume (2 Claude calls)
Haiku metadata extraction → Sonnet analysis ∥ Haiku ATS preview (parallel).

### Draft Cover Letter (2 Claude calls)
Haiku metadata extraction → Sonnet cover letter draft.

### Reliability

All Anthropic API calls are wrapped in a `withRetry` helper that retries up to 2× on transient errors (socket hang-up, ECONNRESET, HTTP 529) with 3s/6s backoff. Long-output calls use `client.messages.stream()` to keep the TCP connection active.

### Prompt Caching Strategy

Prompt caching reduces token cost by ~50–60% per session. The server console logs cache stats after every call:

```
📦 CACHE WRITE [Call 1 / headers]     input: 1840 | cache_write: 620 | cache_read: 0    | output: 580
✅ CACHE HIT   [Call 2 / experience]  input: 210  | cache_write: 0   | cache_read: 2460 | output: 1180
✅ CACHE HIT   [Call 3 / analysis]    input: 190  | cache_write: 0   | cache_read: 620  | output: 980
```

- All system prompts cached with `cache_control: ephemeral`
- JD text cached on the first call of each pipeline, read back on subsequent calls
- Resume text cached on Calls 1 and 2 only (original text)

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + backend together (recommended) |
| `npm run server` | Start only the Express backend (port 3001) |
| `npm run client` | Start only the Vite frontend (port 3000) |
| `npm run build` | Build the frontend for production |
| `npm run test:naming` | Run unit tests for the file naming utility |

---

## Output Files

All documents are generated in memory and returned as base64 — no filesystem writes on the server (Railway has an ephemeral filesystem).

| File | Name Pattern |
|---|---|
| Optimized Resume | `{CompanyName}_{JobTitle}_Resume.docx` |
| Score & Analytics | `{CompanyName}_{JobTitle}_Analysis.docx` |
| Cover Letter | `{CompanyName}_{JobTitle}_CoverLetter.docx` |

Rules:
- Job title component is capped at **25 characters** (truncated, no ellipsis)
- Invalid filename chars (`/ \ : * ? " < > |`) are replaced with underscores

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 8, Tailwind CSS |
| Backend | Node.js + Express 5, ES Modules |
| AI — fast tasks | claude-haiku-4-5-20251001 (via `@anthropic-ai/sdk ^0.30.0`) |
| AI — quality work | claude-sonnet-4-6 (via `@anthropic-ai/sdk ^0.30.0`) |
| Word export | `docx` npm package (in-memory, base64) |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Dev runner | `concurrently` |

> **Note on SDK version:** Prompt caching (`cache_control` on messages) requires `@anthropic-ai/sdk` **v0.30.0 or higher**.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key |
| `PORT` | No | `3001` | Port for the Express backend |
| `CLIENT_ORIGIN` | No | `http://localhost:3000` | CORS allowed origin — set to your frontend URL in production |

---

## Security

- The Anthropic API key is **server-side only** — it never appears in any frontend code or browser network request.
- All Claude API calls go through the Express backend.
- `.env` is excluded from version control via `.gitignore`.
- CORS origin is configurable via `CLIENT_ORIGIN` — not hardcoded.

---

## Testing

Five test resumes and three job descriptions are in `/test-data/`, each targeting a specific condition:

| File | Condition tested |
|---|---|
| `resume-1-complete.txt` | All 11 sections present — Section Review skipped |
| `resume-2-missing-summary.txt` | 1 required section missing |
| `resume-3-missing-summary-and-skills.txt` | 2 required sections missing |
| `resume-4-nonstandard-headings.txt` | Non-standard headings — tests Section Mapper |
| `resume-5-missing-three-required.txt` | 3 required sections missing |

See `test-data/TESTING-GUIDE.md` for step-by-step pass/fail checklists.

---

## Troubleshooting

**Port already in use:**
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
npm run dev
```

**API key errors:**
- Check your `.env` file has no extra spaces and the key starts with `sk-ant-`
- Verify you have API credits at [console.anthropic.com](https://console.anthropic.com)

**Prompt caching not working:**
- Run `npm install` to ensure `@anthropic-ai/sdk ^0.30.0` is installed
- Check server console — cache stats are logged after every call

**Optimization takes a long time:**
- Normal for long resumes or detailed JDs — expect 90–120 seconds for a full optimize run
- The progress stepper updates in real time so you can track which step is running
- A warm-up notice appears after 8 seconds if no SSE events arrive (Railway cold start)

---

*Built with Claude Code · Powered by Anthropic Claude API*
