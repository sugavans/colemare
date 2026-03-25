import React from 'react';
import { useState } from 'react';
import SectionStatusPanel from './SectionStatusPanel';
import AddSectionsEditor from './AddSectionsEditor';
import SectionMapper from './SectionMapper';
import Footer from './Footer';

const MODE = { CHOICE: 'choice', ADD: 'add', MAP: 'map' };

export default function SectionReviewScreen({ scanData, onComplete }) {
  const [mode, setMode]                       = useState(MODE.CHOICE);
  const [confirmingProceed, setConfirmingProceed] = useState(false);

  const requiredMissing  = scanData.sectionsMissing?.filter(s => s.required)  || [];
  const optionalMissing  = scanData.sectionsMissing?.filter(s => !s.required) || [];
  const hasRequiredMissing = requiredMissing.length > 0;

  const handleAddSave    = (additions) => onComplete(additions);
  const handleMapConfirm = (mappings)  => onComplete(mappings);
  const handleProceedAsIs = () => {
    if (!confirmingProceed && hasRequiredMissing) { setConfirmingProceed(true); return; }
    onComplete({});
  };

  return (
    <div className="px-4 py-8 md:px-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-navy mb-1">Review Your Resume Sections</h2>
        <p className="text-gray-500 text-sm">We scanned your resume before optimising. Review detected sections below.</p>
        {scanData.companyName && scanData.companyName !== 'Unknown_Company' && (
          <p className="text-xs text-navy-light mt-1">
            Detected: <strong>{scanData.jobTitle}</strong> at <strong>{scanData.companyName}</strong>
          </p>
        )}
      </div>

      <SectionStatusPanel scanData={scanData} />

      {scanData.sectionsMissing && scanData.sectionsMissing.length > 0 && (
        <div className="mb-6 space-y-2">
          {requiredMissing.map(s => (
            <div key={s.sectionName} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-card text-sm">
              <span className="text-red-500 shrink-0">⚠️</span>
              <div>
                <strong className="text-red-700">{s.sectionName} is missing</strong>
                <span className="text-red-600"> — this section is typically expected by recruiters.</span>
                {s.suggestion && <p className="text-red-500 text-xs mt-0.5 italic">{s.suggestion}</p>}
              </div>
            </div>
          ))}
          {optionalMissing.map(s => (
            <div key={s.sectionName} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-card text-sm">
              <span className="text-gray-400 shrink-0">ℹ️</span>
              <span className="text-gray-500">{s.sectionName} is not included.</span>
            </div>
          ))}
        </div>
      )}

      {mode === MODE.CHOICE && (
        <div className="card">
          <h3 className="text-base font-bold text-navy mb-4 font-body">How would you like to proceed?</h3>
          <div className="flex flex-col gap-3">
            <button onClick={() => setMode(MODE.ADD)} className="btn-primary flex items-center gap-2 justify-center w-full sm:w-auto sm:justify-start">
              ✏️ Add Missing Sections
            </button>
            <button onClick={() => setMode(MODE.MAP)} className="btn-secondary flex items-center gap-2 justify-center w-full sm:w-auto sm:justify-start">
              🔀 Map My Sections
            </button>
            <div>
              <button onClick={handleProceedAsIs} className="btn-ghost flex items-center gap-2 text-gray-500">
                → Proceed Without Changes
              </button>
              {confirmingProceed ? (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-700 fade-in">
                  <p className="font-medium mb-1">⚠ Some required sections are missing.</p>
                  <p className="mb-2">The resume will be optimised as-is. Missing sections will not be added.</p>
                  <button onClick={() => onComplete({})} className="text-amber-700 underline text-sm font-semibold">
                    Confirm — proceed without changes
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1 ml-4">The resume will be optimised as-is. Missing sections will not be added.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === MODE.ADD && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy">✏️ Add Missing Sections</h3>
            <button onClick={() => setMode(MODE.CHOICE)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          </div>
          <AddSectionsEditor missingSections={scanData.sectionsMissing || []} onSave={handleAddSave} onCancel={() => setMode(MODE.CHOICE)} />
        </div>
      )}

      {mode === MODE.MAP && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy">🔀 Map My Sections</h3>
            <button onClick={() => setMode(MODE.CHOICE)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          </div>
          <SectionMapper resumeText={scanData._resumeText || ''} autoSuggestions={{}} onConfirm={handleMapConfirm} onSkip={() => onComplete({})} />
        </div>
      )}

      <Footer />
    </div>
  );
}
