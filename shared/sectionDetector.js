/**
 * sectionDetector.js
 * Section label constants, required/optional classification, and tag helpers.
 * Used by both the backend (for API prompting) and the frontend (for display).
 */

export const SECTION_NAMES = {
  CONTACT: 'Contact Information',
  SUMMARY: 'Professional Summary / Objective',
  EXPERIENCE: 'Work Experience',
  EDUCATION: 'Education',
  SKILLS: 'Skills / Core Competencies',
  CERTIFICATIONS: 'Certifications & Licences',
  TOOLS: 'Tools & Technologies',
  ACHIEVEMENTS: 'Achievements & Awards',
  PUBLICATIONS: 'Publications & Presentations',
  VOLUNTEER: 'Volunteer Work & Community',
  LANGUAGES: 'Languages',
};

export const ALL_SECTION_NAMES = Object.values(SECTION_NAMES);

export const REQUIRED_SECTIONS = [
  SECTION_NAMES.CONTACT,
  SECTION_NAMES.SUMMARY,
  SECTION_NAMES.EXPERIENCE,
  SECTION_NAMES.EDUCATION,
  SECTION_NAMES.SKILLS,
];

export const OPTIONAL_SECTIONS = [
  SECTION_NAMES.CERTIFICATIONS,
  SECTION_NAMES.TOOLS,
  SECTION_NAMES.ACHIEVEMENTS,
  SECTION_NAMES.PUBLICATIONS,
  SECTION_NAMES.VOLUNTEER,
  SECTION_NAMES.LANGUAGES,
];

export function isRequired(sectionName) {
  return REQUIRED_SECTIONS.includes(sectionName);
}

/**
 * Internal section tags used by the AI during optimisation.
 * These are never shown to the user directly.
 */
export const SECTION_TAGS = {
  [SECTION_NAMES.CONTACT]: '[CONTACT]',
  [SECTION_NAMES.SUMMARY]: '[SUMMARY]',
  [SECTION_NAMES.SKILLS]: '[SKILLS]',
  [SECTION_NAMES.TOOLS]: '[TOOLS]',
  [SECTION_NAMES.EXPERIENCE]: '[EXPERIENCE:{CompanyName}]',
  [SECTION_NAMES.EDUCATION]: '[EDUCATION]',
  [SECTION_NAMES.CERTIFICATIONS]: '[CERTIFICATIONS]',
  [SECTION_NAMES.ACHIEVEMENTS]: '[ACHIEVEMENTS]',
  [SECTION_NAMES.PUBLICATIONS]: '[PUBLICATIONS]',
  [SECTION_NAMES.VOLUNTEER]: '[VOLUNTEER]',
  [SECTION_NAMES.LANGUAGES]: '[LANGUAGES]',
};

/**
 * Placeholder copy for the inline Add Sections editor.
 */
export const SECTION_PLACEHOLDERS = {
  [SECTION_NAMES.CONTACT]: 'Full name, email address, phone number, city/region, LinkedIn URL (optional)',
  [SECTION_NAMES.SUMMARY]: 'Write 2–4 sentences describing your professional background, key expertise, and what you bring to this type of role...',
  [SECTION_NAMES.EXPERIENCE]: 'List each job with: Company Name | Job Title | Start Date – End Date\nThen bullet points describing what you did and the impact you made.',
  [SECTION_NAMES.EDUCATION]: 'Degree, Institution, Year of Graduation (e.g. BSc Computer Science, MIT, 2018)',
  [SECTION_NAMES.SKILLS]: 'List your core skills, separated by commas or line breaks (e.g. Project Management, Stakeholder Communication, Budgeting...)',
  [SECTION_NAMES.CERTIFICATIONS]: 'List any relevant certifications or licences (e.g. PMP, AWS Solutions Architect, CPA)',
  [SECTION_NAMES.TOOLS]: 'List tools and software you use (e.g. Salesforce, Jira, Tableau, Python, Excel)',
  [SECTION_NAMES.ACHIEVEMENTS]: 'List notable awards, recognitions, or achievements (e.g. Sales Rep of the Year 2022, Forbes 30 Under 30)',
  [SECTION_NAMES.PUBLICATIONS]: 'List any publications, conference talks, or presentations',
  [SECTION_NAMES.VOLUNTEER]: 'List volunteer roles or community involvement',
  [SECTION_NAMES.LANGUAGES]: 'List languages and proficiency levels (e.g. Spanish — Fluent, French — Conversational)',
};

export const SECTION_WORD_GUIDANCE = {
  [SECTION_NAMES.CONTACT]: 'Include name, email, phone, and location at minimum.',
  [SECTION_NAMES.SUMMARY]: 'Recommended: 50–150 words',
  [SECTION_NAMES.EXPERIENCE]: 'Include at least one role with company, title, dates, and key responsibilities.',
  [SECTION_NAMES.EDUCATION]: 'At least one degree or qualification.',
  [SECTION_NAMES.SKILLS]: 'List 5–15 skills, separated by commas or line breaks.',
  [SECTION_NAMES.CERTIFICATIONS]: 'Recommended: 1–5 certifications',
  [SECTION_NAMES.TOOLS]: 'List relevant tools, separated by commas.',
  [SECTION_NAMES.ACHIEVEMENTS]: 'Recommended: 1–5 items',
  [SECTION_NAMES.PUBLICATIONS]: 'Title, publication/venue, year',
  [SECTION_NAMES.VOLUNTEER]: 'Organisation, role, dates',
  [SECTION_NAMES.LANGUAGES]: 'Language — Proficiency Level',
};
