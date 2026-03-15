/**
 * fileNaming.js — Smart file naming convention per PRD §3.9
 *
 * Pattern: {CompanyName}_{JobTitle_25chars}_{OutputType}.docx
 */

/**
 * Sanitise a string for use in a file or folder name.
 * Removes characters invalid in file/folder names: / \ : * ? " < > |
 * Replaces them with underscore.
 */
export function sanitiseName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Abbreviate a job title to a maximum of 25 characters.
 * Simply truncates at char 25 and trims trailing spaces.
 * No ellipsis appended.
 */
export function abbreviateJobTitle(jobTitle) {
  if (!jobTitle || typeof jobTitle !== 'string') return 'Unknown_Role';
  const sanitised = sanitiseName(jobTitle);
  return sanitised.slice(0, 25).trimEnd();
}

/**
 * Build a complete output filename.
 *
 * @param {string} companyName  - Company name extracted from JD
 * @param {string} jobTitle     - Job title extracted from JD
 * @param {'Resume'|'Analysis'|'CoverLetter'} outputType
 * @returns {string}            - e.g. "Novatrix_Executive Director of Plan_Resume.docx"
 */
export function buildFileName(companyName, jobTitle, outputType) {
  const safeCompany = sanitiseName(companyName) || 'Unknown_Company';
  const safeTitle = abbreviateJobTitle(jobTitle) || 'Unknown_Role';
  const safeType = outputType || 'Output';
  return `${safeCompany}_${safeTitle}_${safeType}.docx`;
}

/**
 * Build the server-side output folder path.
 * @param {string} companyName
 * @param {string} baseDir  - e.g. process.cwd() + '/outputs'
 * @returns {string}
 */
export function buildFolderPath(companyName, baseDir) {
  const safeCompany = sanitiseName(companyName) || 'Unknown_Company';
  return `${baseDir}/${safeCompany}`;
}

// ─── Unit Tests ─────────────────────────────────────────────────────────────
// Run with: node shared/fileNaming.js

if (process.argv[1] && process.argv[1].endsWith('fileNaming.js')) {
  let passed = 0;
  let failed = 0;

  function assert(description, actual, expected) {
    if (actual === expected) {
      console.log(`  ✅  ${description}`);
      passed++;
    } else {
      console.log(`  ❌  ${description}`);
      console.log(`      Expected: ${expected}`);
      console.log(`      Actual:   ${actual}`);
      failed++;
    }
  }

  console.log('\nbuildFileName() unit tests\n');

  // Normal input
  assert(
    'Normal company + short title',
    buildFileName('Novatrix', 'VP of Finance', 'Resume'),
    'Novatrix_VP of Finance_Resume.docx'
  );

  // Title > 25 chars (truncation) — "Executive Director of Pla" = 25 chars exactly
  assert(
    'Job title exceeds 25 chars',
    buildFileName('Novatrix', 'Executive Director of Planning', 'Resume'),
    'Novatrix_Executive Director of Pla_Resume.docx'
  );

  // Invalid characters in company name
  assert(
    'Company name with invalid chars',
    buildFileName('Acme/Corp:Ltd', 'Engineer', 'Analysis'),
    'Acme_Corp_Ltd_Engineer_Analysis.docx'
  );

  // Missing values → defaults
  assert(
    'Empty company name falls back to Unknown_Company',
    buildFileName('', 'Manager', 'Resume'),
    'Unknown_Company_Manager_Resume.docx'
  );

  assert(
    'Null job title falls back to Unknown_Role',
    buildFileName('Globex', null, 'Analysis'),
    'Globex_Unknown_Role_Analysis.docx'
  );

  assert(
    'Both missing → full defaults',
    buildFileName(null, null, 'Resume'),
    'Unknown_Company_Unknown_Role_Resume.docx'
  );

  // Exact 25 chars — no truncation
  assert(
    'Job title exactly 25 chars — no truncation',
    buildFileName('Corp', '1234567890123456789012345', 'Resume'),
    'Corp_1234567890123456789012345_Resume.docx'
  );

  // 26 chars — truncate to 25
  assert(
    'Job title 26 chars — truncated to 25',
    buildFileName('Corp', '12345678901234567890123456', 'Resume'),
    'Corp_1234567890123456789012345_Resume.docx'
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
