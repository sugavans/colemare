import React from 'react';
const ALL_SECTIONS = [
  { name: 'Contact Information', required: true },
  { name: 'Professional Summary / Objective', required: true },
  { name: 'Work Experience', required: true },
  { name: 'Education', required: true },
  { name: 'Skills / Core Competencies', required: true },
  { name: 'Certifications & Licences', required: false },
  { name: 'Tools & Technologies', required: false },
  { name: 'Achievements & Awards', required: false },
  { name: 'Publications & Presentations', required: false },
  { name: 'Volunteer Work & Community', required: false },
  { name: 'Languages', required: false },
];

function getStatus(sectionName, scanData) {
  if (scanData.sectionsFound?.includes(sectionName)) return 'found';
  if (scanData.sectionsPartial?.includes(sectionName)) return 'partial';
  return 'missing';
}

function StatusBadge({ status, required }) {
  if (status === 'found') {
    return <span className="badge-green">FOUND</span>;
  }
  if (status === 'partial') {
    return <span className="badge-amber">PARTIAL</span>;
  }
  // Missing
  if (required) {
    return <span className="badge-red">MISSING</span>;
  }
  return <span className="badge-grey">NOT INCLUDED</span>;
}

export default function SectionStatusPanel({ scanData }) {
  const found = scanData.sectionsFound?.length || 0;
  const partial = scanData.sectionsPartial?.length || 0;
  const missing = scanData.sectionsMissing?.length || 0;
  const total = 11;
  const present = found + partial;

  const requiredMissingCount = scanData.sectionsMissing?.filter(s => s.required).length || 0;

  const summaryColor =
    requiredMissingCount > 0
      ? 'text-red-600'
      : missing > 0
      ? 'text-amber-600'
      : 'text-green-600';

  const summaryText =
    requiredMissingCount > 0
      ? `We found ${present} of ${total} resume sections. ${requiredMissingCount} required section${requiredMissingCount > 1 ? 's are' : ' is'} missing.`
      : missing > 0
      ? `We found ${present} of ${total} resume sections. ${missing} optional section${missing > 1 ? 's are' : ' is'} not included.`
      : `All ${total} resume sections detected. ✓`;

  return (
    <div className="card mb-6">
      {/* Summary line */}
      <p className={`text-sm font-semibold mb-4 ${summaryColor}`}>{summaryText}</p>

      {/* Section grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_SECTIONS.map(s => {
          const status = getStatus(s.name, scanData);
          return (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 shrink-0">{s.required ? '●' : '○'}</span>
                <span className="text-sm text-gray-700 font-medium truncate">{s.name}</span>
                {s.required && <span className="text-xs text-gray-400 shrink-0">(req.)</span>}
              </div>
              <div className="shrink-0 ml-2">
                <StatusBadge status={status} required={s.required} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">● Required   ○ Optional</p>
    </div>
  );
}
