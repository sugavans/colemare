# Phase 10 Testing Guide
## AI-Powered Resume Optimizer — v1.2

---

## Setup Checklist

Before running any tests:
- [ ] `npm run dev` is running — frontend at http://localhost:3000, backend at http://localhost:3001
- [ ] `.env` file has a valid `ANTHROPIC_API_KEY`
- [ ] Browser console is open (F12 → Console) to catch any JS errors during testing

---

## Test Matrix

| Test | Resume File | JD File | Key Condition | Section Review? |
|---|---|---|---|---|
| T1 | resume-1-complete.txt | jd-a-senior-product-manager.txt | All 11 sections present | ❌ Skipped |
| T2 | resume-2-missing-summary.txt | jd-a-senior-product-manager.txt | 1 required section missing (Summary) | ✅ Appears |
| T3 | resume-3-missing-summary-and-skills.txt | jd-b-senior-data-engineer.txt | 2 required sections missing | ✅ Appears |
| T4 | resume-4-nonstandard-headings.txt | jd-b-senior-data-engineer.txt | Non-standard headings | ✅ Appears |
| T5 | resume-5-missing-three-required.txt | jd-c-performance-marketing-manager.txt | 3 required sections missing | ✅ Appears |

---

## TEST 1 — Complete Resume (Happy Path)
**Files:** `resume-1-complete.txt` + `jd-a-senior-product-manager.txt`

### Steps
1. Open http://localhost:3000
2. Paste the full contents of `resume-1-complete.txt` into the YOUR RESUME textarea
3. Paste the full contents of `jd-a-senior-product-manager.txt` into the JOB DESCRIPTION textarea
4. Click **Optimize My Resume**

### Pass Criteria
- [ ] ATS tip box is visible below the resume textarea with green left border
- [ ] Word counts update live as you paste
- [ ] After clicking button, a brief loading state appears ("Scanning resume…")
- [ ] **Section Review screen is NOT shown** — app goes directly to the Processing screen
- [ ] Processing screen shows 6-step stepper with steps 1 and 2 already marked complete (green checkmarks)
- [ ] Steps 3 → 4 → 5 → 6 animate to active then complete in sequence
- [ ] Results screen shows:
  - [ ] Score banner with % and green colour (expect 65–90% for a strong PM resume vs PM JD)
  - [ ] "Helix Systems" and "Senior Product Manager" shown in the confirmation line
  - [ ] Sections banner shows "11 sections found · all present in original resume ✓" in green
  - [ ] Optimized Resume tab renders with job title, contact, summary, skills, tools, experience
  - [ ] Match Analysis tab shows requirements cards with STRONG/PARTIAL/GAP badges
  - [ ] Download Resume and Download Analysis buttons appear
- [ ] Clicking Download Resume triggers a `.docx` download named like `Helix Systems_Senior Product Manager_Resume.docx` (title may be truncated at 25 chars)
- [ ] Clicking Download Analysis triggers a `.docx` download for the analysis
- [ ] `/outputs/Helix Systems/` folder is created on the server with both files

### Known Edge Cases
- If score is below 65%, check that the AI isn't fabricating data (it shouldn't add anything not in the resume)
- The word count for resume-1 should be approximately 650–750 words

---

## TEST 2 — Missing Professional Summary
**Files:** `resume-2-missing-summary.txt` + `jd-a-senior-product-manager.txt`

### Steps
1. Clear previous run (click "Clear & reset" if needed)
2. Paste `resume-2-missing-summary.txt` and `jd-a-senior-product-manager.txt`
3. Click **Optimize My Resume**

### Pass Criteria — Section Review Screen
- [ ] **Section Review screen APPEARS** (not skipped)
- [ ] Summary count line shows amber or red text: e.g. "We found X of 11 resume sections. 1 required section is missing."
- [ ] **Professional Summary / Objective** shows a **red MISSING** badge
- [ ] All other 4 required sections (Contact, Work Experience, Education, Skills) show **green FOUND** badges
- [ ] Missing section list shows: `⚠️ Professional Summary / Objective is missing — this section is typically expected by recruiters.`
- [ ] Three action buttons are visible: ✏️ Add Missing Sections, 🔀 Map My Sections, → Proceed Without Changes

### Path A — Add Missing Sections
- [ ] Clicking ✏️ opens the inline editor form
- [ ] Form shows a textarea for "Professional Summary / Objective" (required, red border)
- [ ] Placeholder text is visible with guidance
- [ ] Type a short summary: "Senior Account Executive with 7 years of B2B SaaS sales experience."
- [ ] Click **Save & Continue**
- [ ] Processing screen appears and completes all 6 steps
- [ ] Results screen shows sections banner with "added by you" note in amber
- [ ] Match Analysis tab shows amber callout: "Some sections were missing from your original resume. Match scores reflect the resume after your additions."

### Path B — Proceed Without Changes (also test)
- [ ] Click **Cancel** to return, then click **→ Proceed Without Changes**
- [ ] Since a required section is missing, a confirmation warning appears
- [ ] Confirming proceeds to Processing without adding sections
- [ ] Results load correctly — match analysis shows lower score due to missing summary

---

## TEST 3 — Two Required Sections Missing
**Files:** `resume-3-missing-summary-and-skills.txt` + `jd-b-senior-data-engineer.txt`

### Steps
1. Paste `resume-3-missing-summary-and-skills.txt` and `jd-b-senior-data-engineer.txt`
2. Click **Optimize My Resume**

### Pass Criteria — Section Review Screen
- [ ] Summary line reads: "We found X of 11 resume sections. 2 required sections are missing." in **red** text
- [ ] **Professional Summary / Objective** shows red MISSING badge
- [ ] **Skills / Core Competencies** shows red MISSING badge
- [ ] Contact, Work Experience, Education show green FOUND badges
- [ ] Two `⚠️` warning rows visible in the missing sections list

### Add Sections Form
- [ ] Click ✏️ Add Missing Sections
- [ ] Form shows **both** missing required textareas at the top (in order: Summary, then Skills)
- [ ] Optional missing sections (if any) appear below with skip checkboxes
- [ ] Fill in both fields, click Save & Continue
- [ ] Results load. Score should be reasonable for a strong data engineer vs data engineering JD (expect 60–85%)
- [ ] File download named with "Verano Health" + "Senior Data Engineer" (truncated if needed)

---

## TEST 4 — Non-Standard Headings (Section Mapper)
**Files:** `resume-4-nonstandard-headings.txt` + `jd-b-senior-data-engineer.txt`

### Steps
1. Paste `resume-4-nonstandard-headings.txt` and `jd-b-senior-data-engineer.txt`
2. Click **Optimize My Resume**

### Pass Criteria — Section Review Screen
- [ ] Section Review screen appears (the AI likely flags some sections as missing due to headings like "About Me", "What I Know", etc.)
- [ ] Status panel shows some sections as MISSING or PARTIAL

### Section Mapper Path
- [ ] Click **🔀 Map My Sections**
- [ ] Left pane shows the original resume text (read-only)
- [ ] Right pane shows detected blocks with dropdown selectors
- [ ] Dropdowns are pre-populated with AI best-guess suggestions
- [ ] Manually update any incorrect mappings:
  - "ABOUT ME" → Professional Summary / Objective
  - "WHAT I KNOW" → Skills / Core Competencies
  - "MY TOOLKIT" → Tools & Technologies
  - "WHERE I'VE BEEN" → Work Experience
  - "MY EDUCATION" → Education
- [ ] Click **Confirm Mapping**
- [ ] Processing and results load correctly

### Fallback
- [ ] If you click Skip — Proceed As-Is, the app proceeds with the resume as-pasted and still produces results

---

## TEST 5 — Three Required Sections Missing (High Urgency)
**Files:** `resume-5-missing-three-required.txt` + `jd-c-performance-marketing-manager.txt`

### Steps
1. Paste `resume-5-missing-three-required.txt` and `jd-c-performance-marketing-manager.txt`
2. Click **Optimize My Resume**

### Pass Criteria — Section Review Screen
- [ ] Summary count line shows **red** text: "3 required sections are missing"
- [ ] Three red MISSING badges: Professional Summary, Skills / Core Competencies, Education
- [ ] Three `⚠️` warning rows in the missing sections list

### Add Sections — Full Form Test
- [ ] Click ✏️ Add Missing Sections
- [ ] Three required textareas visible at top, in order: Summary, Skills, Education
- [ ] Fill all three:
  - Summary: "Performance marketing manager with 6 years of experience managing paid media across Meta, Google, and TikTok for DTC brands."
  - Skills: "Paid Social, Google Ads, Meta Ads Manager, TikTok for Business, ROAS Optimisation, Creative Testing, Attribution Modelling, Budget Management"
  - Education: "Bachelor of Science, Marketing — New York University, 2018"
- [ ] Click Save & Continue
- [ ] Results load correctly
- [ ] Score should be strong (70–85%) given the resume closely matches the JD
- [ ] Company "Aura Wellness" and job title "Performance Marketing Manager" shown in results

### Proceed Without Changes — Double Confirmation
- [ ] Click Cancel, then click → Proceed Without Changes
- [ ] **Confirmation warning appears** (because required sections are missing)
- [ ] "Confirm — proceed without changes" link is visible
- [ ] Clicking confirm proceeds to processing and produces results with partial/lower match quality

---

## File Naming Verification (all tests)

For each test that completes, verify the downloaded files follow the naming convention:

| Test | Expected Resume Filename |
|---|---|
| T1 | `Helix Systems_Senior Product Manager_Resume.docx` (note: "Senior Product Manager" = 22 chars, fits) |
| T2 | `Helix Systems_Senior Product Manager_Resume.docx` |
| T3 | `Verano Health_Senior Data Engineer_Resume.docx` |
| T4 | `Verano Health_Senior Data Engineer_Resume.docx` |
| T5 | `Aura Wellness_Performance Marketing_Resume.docx` ("Performance Marketing Manager" = 29 chars → truncated to 25 = "Performance Marketing Man") |

> Note: Exact truncation at 25 chars may differ slightly based on what the AI extracts as the job title from the JD text. The test is that the filename is ≤ 25 chars for the title component and uses valid characters.

---

## Regression Checklist (run after all 5 tests)

- [ ] ATS tip box is always visible on the Input screen — not hidden, not dismissable
- [ ] Word count updates in real time as text is typed or pasted
- [ ] "Optimize My Resume" button is disabled when either textarea is empty
- [ ] Input text is preserved if an error occurs during processing (not cleared)
- [ ] "New Resume" button in the header resets the entire app to Input screen with empty fields
- [ ] No API keys visible anywhere in browser developer tools (Network tab → request headers or payloads)
- [ ] `/outputs/` folder on the server is organised by company, with both `.docx` files inside

---

## Known Limitations (not bugs)

- Section detection accuracy depends on Claude's interpretation of the resume text. Non-standard layouts may occasionally misclassify sections — this is expected and handled by the Section Mapper.
- Very short resumes (under 100 words) may produce lower-quality optimisation output, but should not error.
- The Section Review screen only passes `_resumeText` to SectionMapper if wired in App.jsx — verify this prop is passed correctly if the mapper shows empty text.
