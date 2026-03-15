import React from 'react';
import { useState, useMemo } from 'react';

const STANDARD_SECTIONS = [
  'Contact Information',
  'Professional Summary / Objective',
  'Work Experience',
  'Education',
  'Skills / Core Competencies',
  'Certifications & Licences',
  'Tools & Technologies',
  'Achievements & Awards',
  'Publications & Presentations',
  'Volunteer Work & Community',
  'Languages',
  '(Other / Ignore)',
];

/**
 * Split resume text into blocks by detecting lines that look like headings:
 * - All caps, or
 * - Short (< 40 chars) with no punctuation mid-line
 */
function splitIntoBlocks(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  let currentHeading = '(Introduction)';
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isHeading =
      (trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 60) ||
      (trimmed.length < 50 && /^[A-Z][A-Za-z\s&/–-]+$/.test(trimmed) && !trimmed.includes('•'));

    if (isHeading) {
      if (currentContent.length > 0) {
        blocks.push({ heading: currentHeading, preview: currentContent.slice(0, 3).join('\n') });
      }
      currentHeading = trimmed;
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  if (currentContent.length > 0) {
    blocks.push({ heading: currentHeading, preview: currentContent.slice(0, 3).join('\n') });
  }

  return blocks;
}

export default function SectionMapper({ resumeText, autoSuggestions = {}, onConfirm, onSkip }) {
  const blocks = useMemo(() => splitIntoBlocks(resumeText), [resumeText]);

  const [mappings, setMappings] = useState(() => {
    const init = {};
    blocks.forEach(b => {
      init[b.heading] = autoSuggestions[b.heading] || '(Other / Ignore)';
    });
    return init;
  });

  const handleChange = (heading, value) => {
    setMappings(prev => ({ ...prev, [heading]: value }));
  };

  const handleConfirm = () => {
    const result = {};
    for (const [heading, standard] of Object.entries(mappings)) {
      if (standard !== '(Other / Ignore)') {
        result[standard] = heading;
      }
    }
    onConfirm(result);
  };

  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>Could not detect sections in the resume text.</p>
        <button onClick={onSkip} className="mt-3 btn-ghost text-sm">
          Skip — Proceed As-Is
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <p className="text-sm text-gray-600 mb-4">
        We've detected <strong>{blocks.length} blocks</strong> in your resume. Use the dropdowns to map each block to a standard resume section.
        Pre-filled suggestions are based on the AI's best guess.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: resume text preview */}
        <div className="bg-gray-50 rounded-card border border-gray-200 p-4 overflow-auto" style={{ maxHeight: '500px' }}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Your Resume</p>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
            {resumeText}
          </pre>
        </div>

        {/* Right: mapping dropdowns */}
        <div className="space-y-2 overflow-auto" style={{ maxHeight: '500px' }}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Section Mapping</p>
          {blocks.map(block => (
            <div key={block.heading} className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-bold text-navy mb-1 truncate">{block.heading}</p>
              {block.preview && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2 font-mono">{block.preview}</p>
              )}
              <select
                className="w-full text-xs border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-navy bg-white"
                value={mappings[block.heading] || '(Other / Ignore)'}
                onChange={e => handleChange(block.heading, e.target.value)}
              >
                {STANDARD_SECTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button onClick={handleConfirm} className="btn-primary">
          Confirm Mapping →
        </button>
        <button onClick={onSkip} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
          Skip — Proceed As-Is
        </button>
      </div>
    </div>
  );
}
