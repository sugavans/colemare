import React from 'react';
import Footer from './Footer';

const STEP_SETS = {
  optimize: [
    { id: 1, label: 'Extracting company & job info + scanning resume sections' },
    { id: 2, label: 'Section review complete' },
    { id: 3, label: 'Analyzing inputs' },
    { id: 4, label: 'Optimizing header sections' },
    { id: 5, label: 'Rewriting experience bullets' },
    { id: 6, label: 'Running match analysis' },
    { id: 7, label: 'Drafting cover letter' },
  ],
  match: [
    { id: 1, label: 'Extracting company & job info' },
    { id: 2, label: 'Analyzing resume against job description' },
    { id: 3, label: 'Generating match report' },
  ],
  coverletter: [
    { id: 1, label: 'Extracting company & job info' },
    { id: 2, label: 'Analyzing resume and job description' },
    { id: 3, label: 'Drafting cover letter' },
  ],
};

const MODE_TITLES = {
  optimize:    { icon: '⚙️', title: 'Optimizing Your Resume',      subtitle: 'This usually takes 60–90 seconds.' },
  match:       { icon: '📊', title: 'Running Match Analysis',       subtitle: 'This usually takes 30–45 seconds.' },
  coverletter: { icon: '✉️', title: 'Drafting Your Cover Letter',   subtitle: 'This usually takes 30–45 seconds.' },
};

function StepIcon({ status }) {
  if (status === 'complete') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-8 h-8 rounded-full bg-navy bg-opacity-10 border-2 border-navy flex items-center justify-center shrink-0">
        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-gray-300" />
    </div>
  );
}

export default function ProcessingScreen({ steps, error, onRetry, mode = 'optimize' }) {
  const stepList  = STEP_SETS[mode] || STEP_SETS.optimize;
  const totalSteps = stepList.length;
  const { icon, title, subtitle } = MODE_TITLES[mode] || MODE_TITLES.optimize;
  const completeCount = Object.values(steps).filter(s => s === 'complete').length;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <div className="card max-w-md w-full text-center">
        {error ? (
          <div className="fade-in">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="font-display text-xl text-navy font-bold mb-2">Something went wrong</h3>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button onClick={onRetry} className="btn-primary">← Try Again</button>
            <p className="text-xs text-gray-400 mt-3">Your resume text has been preserved.</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="font-display text-xl text-navy font-bold mb-1">{title}</h3>
            <p className="text-gray-400 text-sm mb-6">{subtitle}</p>

            <div className="text-left space-y-1 mb-6">
              {stepList.map(step => {
                const status    = steps[step.id] || 'pending';
                const isActive  = status === 'active';
                const isComplete = status === 'complete';
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      isActive   ? 'bg-navy bg-opacity-5 border border-navy border-opacity-20' :
                      isComplete ? 'bg-green-50' : 'bg-transparent'
                    }`}
                  >
                    <StepIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium transition-colors ${
                        isActive ? 'text-navy' : isComplete ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      {isActive && <p className="text-xs text-navy text-opacity-60 mt-0.5 fade-in">In progress…</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
              <div
                className="bg-navy h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(completeCount / totalSteps) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{completeCount} of {totalSteps} steps complete</p>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
