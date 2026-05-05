import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import Footer from './Footer';

const MIN_WORDS = 700;

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Button configuration — one entry per workflow.
// Order matches left-to-right layout: Score | Cover Letter | Optimize.
const WORKFLOWS = [
  {
    mode:         'match',
    className:    'btn-match',
    label:        '📊 Score My Resume',
    loadingLabel: 'Analyzing…',
    title:        'Analyze how well your resume matches the job description — no rewriting',
  },
  {
    mode:         'coverletter',
    className:    'btn-cl',
    label:        '✉️ Draft Cover Letter',
    loadingLabel: 'Drafting…',
    title:        'Generate a tailored cover letter for this role — no resume rewriting',
  },
  {
    mode:         'optimize',
    className:    'btn-opt',
    label:        '✨ Optimize Everything',
    loadingLabel: 'Scanning resume…',
    title:        'Optimize your resume, run a match analysis, and draft a cover letter — all in one go',
  },
];

// Reusable inline spinner used inside each loading button.
const ButtonSpinner = () => (
  <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: '14px', height: '14px', borderWidth: '2px' }} />
);

export default function InputScreen({ initialResumeText = '', initialJobDescription = '', onSubmit, onMatchOnly, onCoverLetter }) {
  const [resumeText,    setResumeText]    = useState(initialResumeText);
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [error,         setError]         = useState('');
  const [loadingMode,   setLoadingMode]   = useState(null); // 'optimize' | 'match' | 'coverletter'

  useEffect(() => {
    setResumeText(initialResumeText);
    setJobDescription(initialJobDescription);
  }, [initialResumeText, initialJobDescription]);

  const validate = () => {
    if (!resumeText.trim() || !jobDescription.trim()) {
      setError('Please paste both your resume and job description before continuing.');
      return false;
    }
    if (resumeText.trim() === jobDescription.trim()) {
      setError('Your resume and job description appear to be identical. Please check and correct before continuing.');
      return false;
    }
    setError('');
    return true;
  };

  // Maps workflow mode → the correct prop handler.
  const handlerFor = { optimize: onSubmit, match: onMatchOnly, coverletter: onCoverLetter };

  const handleClick = useCallback(async (mode) => {
    if (!validate()) return;
    setLoadingMode(mode);
    try { await handlerFor[mode]({ resumeText, jobDescription }); }
    catch { setError('Something went wrong. Please try again.'); }
    finally { setLoadingMode(null); }
  }, [resumeText, jobDescription, onSubmit, onMatchOnly, onCoverLetter]);

  const handleClear = useCallback(() => {
    setResumeText('');
    setJobDescription('');
    setError('');
  }, []);

  const totalWords  = wordCount(resumeText) + wordCount(jobDescription);
  const enoughWords = totalWords >= MIN_WORDS;
  const anyLoading  = loadingMode !== null;
  const bothFilled  = resumeText.trim() && jobDescription.trim() && enoughWords;

  return (
    <div className="px-4 py-8 md:px-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h2 className="font-display text-3xl md:text-4xl text-navy font-bold mb-2">
          Personalize Your Resume &amp; Cover Letter
        </h2>
        <p className="text-gray-500 text-base max-w-xl mx-auto">
          Paste your resume and a job description. We'll detect missing sections, rewrite every bullet, and score your match — then export polished Word documents.
        </p>
      </div>

      {/* Two-column input grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Resume column */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-navy tracking-widest uppercase">
            Your Resume
          </label>
          <textarea
            className="w-full rounded-card border border-gray-200 p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent resize-none shadow-card"
            style={{ minHeight: '400px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6' }}
            placeholder="Paste your full resume here as plain text…"
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            disabled={anyLoading}
          />
          <div style={{ backgroundColor: '#EAF4EA', borderLeft: '4px solid #27AE60', padding: '10px 14px', fontSize: '13px', color: '#444444', borderRadius: '0 6px 6px 0', lineHeight: '1.6' }}>
            <p><strong>💡 For best results, paste a plain-text ATS-friendly resume.</strong></p>
            <p style={{ marginTop: '4px' }}>
              This tool works best when your resume does not contain tables, text boxes, columns, images, or graphics.
              If your resume uses a template with those formats, copy only the text content, reorganized as simple paragraphs and bullet points.
            </p>
          </div>
          <p className="text-xs text-gray-400 text-right">{wordCount(resumeText)} words</p>
        </div>

        {/* Job Description column */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-navy tracking-widest uppercase">
            Job Description
          </label>
          <textarea
            className="w-full rounded-card border border-gray-200 p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent resize-none shadow-card"
            style={{ minHeight: '400px', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.6' }}
            placeholder="Paste the full job description here — include all requirements, responsibilities, and qualifications…"
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            disabled={anyLoading}
          />
          <p className="text-xs text-gray-400 text-right">{wordCount(jobDescription)} words</p>
        </div>
      </div>

      {/* Validation error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-card text-red-700 text-sm fade-in">
          ⚠ {error}
        </div>
      )}

      {/* Word count nudge */}
      {resumeText.trim() && jobDescription.trim() && !enoughWords && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-card text-amber-700 text-sm text-center">
          Add more content to unlock — {totalWords} / {MIN_WORDS} words minimum across both fields.
        </div>
      )}

      {/* Three action buttons — data-driven from WORKFLOWS config */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {WORKFLOWS.map(({ mode, className, label, loadingLabel, title }) => (
            <button
              key={mode}
              onClick={() => handleClick(mode)}
              disabled={anyLoading || !bothFilled}
              className={`${className} flex items-center justify-center text-sm`}
              style={{ width: '176px', textAlign: 'center' }}
              title={title}
            >
              {loadingMode === mode ? (
                <span className="flex items-center gap-2"><ButtonSpinner /> {loadingLabel}</span>
              ) : (
                <span>{label}</span>
              )}
            </button>
          ))}
        </div>

        {(resumeText || jobDescription) && !anyLoading && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
            Clear &amp; reset
          </button>
        )}
      </div>

      {/* Feature strip — aligned to the three workflows */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-gray-500">
        {[
          { icon: '📊', label: 'Score My Resume',     color: '#0E7490', text: 'Scores your resume against every JD requirement with an honest match percentage and ATS keyword audit.' },
          { icon: '✉️', label: 'Draft Cover Letter',  color: '#6D28D9', text: "Writes a tailored cover letter that connects your real experience to the employer's specific needs — no fabrication." },
          { icon: '✨', label: 'Optimize Everything', color: '#1F3864', text: 'Rewrites every bullet, reorders your skills, and delivers a scored analysis and cover letter — all in one run.' },
        ].map(f => (
          <div key={f.label} className="flex flex-col items-center gap-2 p-4 rounded-card bg-white shadow-card">
            <span className="text-2xl">{f.icon}</span>
            <span className="font-semibold text-xs tracking-wide uppercase" style={{ color: f.color }}>{f.label}</span>
            <span className="text-gray-500 text-xs leading-relaxed">{f.text}</span>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
