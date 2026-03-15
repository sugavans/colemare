import React from 'react';
import { useState } from 'react';

// ─── Static lookup tables ────────────────────────────────────────────────────
const PLACEHOLDERS = {
  'Contact Information': 'Full name, email address, phone number, city/region, LinkedIn URL (optional)',
  'Professional Summary / Objective': 'Write 2–4 sentences describing your professional background, key expertise, and what you bring to this type of role…',
  'Work Experience': 'List each job:\nCompany Name | Job Title | Start – End Date\n• Key responsibility or achievement\n• Another bullet point…',
  'Education': 'Degree, Institution, Year of Graduation\ne.g. BSc Computer Science, MIT, 2018',
  'Skills / Core Competencies': 'List your core skills, separated by commas or line breaks\ne.g. Project Management, Stakeholder Communication, Budgeting…',
  'Certifications & Licences': 'e.g. PMP — Project Management Professional, 2021\nAWS Certified Solutions Architect, 2023',
  'Tools & Technologies': 'List tools and software, separated by commas\ne.g. Salesforce, Jira, Tableau, Python, Excel',
  'Achievements & Awards': 'e.g. Sales Rep of the Year 2022\nForbes 30 Under 30 — 2021',
  'Publications & Presentations': 'Title, Publication/Venue, Year',
  'Volunteer Work & Community': 'Organisation, Role, Dates',
  'Languages': 'e.g. Spanish — Fluent\nFrench — Conversational\nMandarin — Basic',
};

const WORD_GUIDANCE = {
  'Contact Information': 'Include name, email, phone, and location at minimum.',
  'Professional Summary / Objective': 'Recommended: 50–150 words',
  'Work Experience': 'Include at least one role with company, title, dates, and 2–3 bullets.',
  'Education': 'At least one degree or qualification.',
  'Skills / Core Competencies': 'List 5–15 skills.',
  'Certifications & Licences': 'Recommended: 1–5 certifications',
  'Tools & Technologies': 'List relevant tools, separated by commas.',
  'Achievements & Awards': 'Recommended: 1–5 items',
  'Publications & Presentations': 'Title, venue, year',
  'Volunteer Work & Community': 'Organisation, role, dates',
  'Languages': 'Language — Proficiency Level',
};

// ─── SectionTextarea — extracted to module scope ─────────────────────────────
// IMPORTANT: Must NOT be defined inside the parent component.
// Defining a component inside another component causes React to treat it as a
// new component type on every render, forcing a full remount and losing focus
// mid-typing. Module-scope definition gives it a stable identity.
function SectionTextarea({ section, isOptional, value, isSkipped, onChangeValue, onToggleSkip }) {
  return (
    <div
      className={[
        'p-4 rounded-card border-2 transition-opacity',
        section.required ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50',
        isOptional && isSkipped ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-2">
        <label className="font-semibold text-sm text-navy">
          {section.sectionName}
          {section.required && (
            <span className="ml-2 text-red-500 text-xs">(required)</span>
          )}
        </label>
        {isOptional && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSkipped}
              onChange={() => onToggleSkip(section.sectionName)}
              className="rounded"
            />
            Skip this section
          </label>
        )}
      </div>

      {section.suggestion && (
        <p className="text-xs text-gray-500 mb-2 italic">{section.suggestion}</p>
      )}

      <textarea
        className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy resize-none bg-white"
        rows={section.sectionName === 'Work Experience' ? 8 : 4}
        placeholder={PLACEHOLDERS[section.sectionName] || `Enter content for ${section.sectionName}`}
        value={value}
        onChange={e => onChangeValue(section.sectionName, e.target.value)}
        disabled={isOptional && isSkipped}
        aria-label={`${section.sectionName} content`}
      />

      <p className="text-xs text-gray-400 mt-1">
        {WORD_GUIDANCE[section.sectionName] || ''}
      </p>
    </div>
  );
}

// ─── AddSectionsEditor ───────────────────────────────────────────────────────
export default function AddSectionsEditor({ missingSections, onSave, onCancel }) {
  const required = missingSections.filter(s => s.required);
  const optional  = missingSections.filter(s => !s.required);

  const [values, setValues] = useState(() =>
    Object.fromEntries(missingSections.map(s => [s.sectionName, '']))
  );

  const [skipped, setSkipped] = useState(() =>
    Object.fromEntries(optional.map(s => [s.sectionName, false]))
  );

  const handleChangeValue = (name, val) =>
    setValues(prev => ({ ...prev, [name]: val }));

  const handleToggleSkip = (name) =>
    setSkipped(prev => ({ ...prev, [name]: !prev[name] }));

  const handleSave = () => {
    const additions = {};
    for (const [name, val] of Object.entries(values)) {
      if (val.trim() && !skipped[name]) {
        additions[name] = val.trim();
      }
    }
    onSave(additions);
  };

  return (
    <div className="mt-4 space-y-4 fade-in">
      {required.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-600 mb-3">⚠ Required Missing Sections</h4>
          <div className="space-y-3">
            {required.map(s => (
              <SectionTextarea
                key={s.sectionName}
                section={s}
                isOptional={false}
                value={values[s.sectionName] || ''}
                isSkipped={false}
                onChangeValue={handleChangeValue}
                onToggleSkip={handleToggleSkip}
              />
            ))}
          </div>
        </div>
      )}

      {optional.length > 0 && (
        <div className={required.length > 0 ? 'mt-4' : ''}>
          <h4 className="text-sm font-semibold text-gray-500 mb-3">ℹ Optional Sections</h4>
          <div className="space-y-3">
            {optional.map(s => (
              <SectionTextarea
                key={s.sectionName}
                section={s}
                isOptional={true}
                value={values[s.sectionName] || ''}
                isSkipped={skipped[s.sectionName] || false}
                onChangeValue={handleChangeValue}
                onToggleSkip={handleToggleSkip}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button onClick={handleSave} className="btn-primary">
          Save &amp; Continue →
        </button>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
