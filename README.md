# AI-Powered Resume Optimizer

An AI-powered web application that rewrites your resume to precisely match any job description and scores every requirement individually.

Built with React 18, Express, and the Anthropic Claude API — using **claude-haiku-4-5-20251001** for fast section detection and **claude-sonnet-4-6** for high-quality optimisation, with prompt caching enabled across all API calls.

---

## Prerequisites

- **Node.js** v18.11 or higher ([download](https://nodejs.org))
  - v18.11+ is required for `node --watch` (used in `npm run server`)
- An **Anthropic API key** ([get one](https://console.anthropic.com))

Verify your Node version:
```bash
node --version   # must be v18.11.0 or higher
```

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd resume-optimizer
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

## How to Use

1. **Paste your resume** as plain text into the left textarea. Follow the ATS tip shown below the input.
2. **Paste the job description** into the right textarea.
3. Click **Optimize My Resume**.
4. If any resume sections are missing, a **Section Review** screen appears. You can add missing content, map non-standard headings, or proceed as-is.
5. Watch the **6-step progress stepper** as each pipeline stage completes.
6. On the **Results screen**:
   - **Optimized Resume tab** — fully rewritten resume aligned to the JD.
   - **Match Analysis tab** — every JD requirement scored and explained.
   - **Download buttons** — export both as formatted `.docx` files.

---

## Project File Structure

```
resume-optimizer/
├── client/                            # React 18 frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── main.jsx                   # React entry point
│       ├── index.css                  # Tailwind base + component classes
│       ├── App.jsx                    # Root component, all app state + screen routing
│       └── components/
│           ├── InputScreen.jsx        # Step 1: resume + JD textarea inputs
│           ├── SectionReviewScreen.jsx # Step 2: missing section review + actions
│           ├── ProcessingScreen.jsx   # Step 3: 6-step SSE progress stepper
│           ├── ResultsScreen.jsx      # Step 4: score banner, tabs, downloads
│           ├── SectionStatusPanel.jsx # Section detection status grid (11 sections)
│           ├── AddSectionsEditor.jsx  # Inline form for user to add missing sections
│           └── SectionMapper.jsx      # Map non-standard headings to standard sections
├── server/
│   ├── server.js                      # Express entry point (port 3001)
│   └── routes/
│       └── optimize.js                # /api/scan, /api/optimize (SSE), /api/export
├── shared/
│   ├── prompts.js                     # All Claude prompt templates + assembler
│   ├── fileNaming.js                  # buildFileName() with unit tests (npm run test:naming)
│   ├── sectionDetector.js             # Section name constants, required/optional lists, tags
│   └── docxGenerator.js              # Word document generation (docx package)
├── outputs/                           # Generated files, organised as /outputs/{CompanyName}/
├── test-data/                         # 5 test resumes + 3 JDs + testing guide
├── .env                               # API keys (never commit)
├── .env.example                       # Template
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── README.md
```

---

## API Pipeline

Each optimisation run makes **4 sequential API calls**:

| Call | Route | Model | Purpose | Prompt Caching |
|---|---|---|---|---|
| 0 | `POST /api/scan` | `claude-haiku-4-5-20251001` | Section detection + company/title extraction | System prompt cached |
| 1 | `POST /api/optimize` | `claude-sonnet-4-6` | Rewrite header sections (summary, skills, tools) | System prompt + JD + resume cached |
| 2 | `POST /api/optimize` | `claude-sonnet-4-6` | Rewrite experience bullets (what/how/so-what) | System prompt + JD + resume cached (reads) |
| 3 | `POST /api/optimize` | `claude-sonnet-4-6` | Match analysis — score every JD requirement | System prompt + JD cached (read) |

Calls 1–3 are streamed to the frontend via **Server-Sent Events (SSE)**, updating the progress stepper in real time.

### Prompt Caching Strategy

Prompt caching is active on all four calls. The server console logs cache stats on every request:

```
📦 CACHE WRITE [Call 1 / headers]    input: 1840 | cache_write: 620 | cache_read: 0    | output: 580
✅ CACHE HIT   [Call 2 / experience] input: 210  | cache_write: 0   | cache_read: 2460 | output: 1180
✅ CACHE HIT   [Call 3 / analysis]   input: 190  | cache_write: 0   | cache_read: 620  | output: 980
```

**What is cached:**
- All four **system prompts** — static text shared globally across every user
- **JD text** — sent in Calls 1, 2, and 3; written to cache on Call 1, read back on Calls 2 and 3
- **Resume text** — sent in Calls 1 and 2; written on Call 1, read back on Call 2

Cache reads cost ~90% less than a full input token. For a typical session this reduces cost by **50–60%** compared to uncached calls.

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

Generated files are written to `/outputs/{CompanyName}/` on the server:

| File | Name Pattern |
|---|---|
| Optimised Resume | `{CompanyName}_{JobTitle}_Resume.docx` |
| Match Analysis | `{CompanyName}_{JobTitle}_Analysis.docx` |

Rules:
- Job title component is capped at **25 characters** (truncated, no ellipsis)
- Characters invalid in filenames (`/ \ : * ? " < > |`) are replaced with underscores
- Multiple runs for the same company go into the same folder

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18 |
| Build tool | Vite | 5 |
| Styling | Tailwind CSS | 3 |
| Backend | Node.js + Express | 18.11+ / 4 |
| AI — scan | Anthropic claude-haiku-4-5-20251001 | via SDK ^0.30.0 |
| AI — optimise | Anthropic claude-sonnet-4-6 | via SDK ^0.30.0 |
| Word export | docx (npm) | 8 |
| File parsing | pdf-parse, mammoth | — |
| Fonts | Playfair Display, DM Sans | Google Fonts |

> **Note on SDK version:** Prompt caching (`cache_control` on messages) requires `@anthropic-ai/sdk` **v0.30.0 or higher**. The `^0.30.0` range in `package.json` ensures this is always satisfied.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Your Anthropic API key |
| `PORT` | No | `3001` | Port for the Express backend |
| `CLIENT_ORIGIN` | No | `http://localhost:3000` | CORS allowed origin — set to your frontend URL in production |

---

## Security

- The Anthropic API key is **server-side only** — it never appears in any frontend code or browser network request.
- All Claude API calls go through `POST /api/scan` and `POST /api/optimize` on the Express backend.
- `.env` is excluded from version control via `.gitignore`.
- CORS origin is configurable via `CLIENT_ORIGIN` env var — not hardcoded.

---

## Testing

Five test resumes and three job descriptions are in `/test-data/`, each targeting a specific condition:

| File | Condition |
|---|---|
| `resume-1-complete.txt` | All 11 sections present — Section Review skipped |
| `resume-2-missing-summary.txt` | 1 required section missing (Summary) |
| `resume-3-missing-summary-and-skills.txt` | 2 required sections missing |
| `resume-4-nonstandard-headings.txt` | Non-standard headings — tests Section Mapper |
| `resume-5-missing-three-required.txt` | 3 required sections missing — high-urgency flow |

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

**Prompt caching not working / cache_control errors:**
- Run `npm install` to ensure `@anthropic-ai/sdk ^0.30.0` is installed
- Check the server console — cache stats are logged after every API call

**Optimisation takes longer than 45 seconds:**
- Normal for long resumes (600+ words) or detailed JDs. The app waits up to 90 seconds.
- Check the server console for which step is running
