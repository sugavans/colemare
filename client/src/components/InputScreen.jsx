import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import Footer from './Footer';

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function InputScreen({ initialResumeText = '', initialJobDescription = '', onSubmit, onMatchOnly, onCoverLetter }) {
  const [resumeText, setResumeText]         = useState(initialResumeText);
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [error, setError]                   = useState('');
  const [loadingMode, setLoadingMode]       = useState(null); // 'optimize' | 'match' | 'coverletter'
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);

  useEffect(() => {
    setResumeText(initialResumeText);
    setJobDescription(initialJobDescription);
  }, [initialResumeText, initialJobDescription]);

  const validate = () => {
    setHasSubmittedOnce(true);
    if (!resumeText.trim() || !jobDescription.trim()) {
      setError('Please paste both your resume and job description before continuing.');
      return false;
    }
    setError('');
    return true;
  };

  const handleOptimize = useCallback(async () => {
    if (!validate()) return;
    setLoadingMode('optimize');
    try { await onSubmit({ resumeText, jobDescription }); }
    catch { setError('Something went wrong. Please try again.'); }
    finally { setLoadingMode(null); }
  }, [resumeText, jobDescription, onSubmit]);

  const handleMatchOnly = useCallback(async () => {
    if (!validate()) return;
    setLoadingMode('match');
    try { await onMatchOnly({ resumeText, jobDescription }); }
    catch { setError('Something went wrong. Please try again.'); }
    finally { setLoadingMode(null); }
  }, [resumeText, jobDescription, onMatchOnly]);

  const handleCoverLetter = useCallback(async () => {
    if (!validate()) return;
    setLoadingMode('coverletter');
    try { await onCoverLetter({ resumeText, jobDescription }); }
    catch { setError('Something went wrong. Please try again.'); }
    finally { setLoadingMode(null); }
  }, [resumeText, jobDescription, onCoverLetter]);

  const handleClear = useCallback(() => {
    setResumeText('');
    setJobDescription('');
    setError('');
    setHasSubmittedOnce(false);
  }, []);

  const totalWords  = wordCount(resumeText) + wordCount(jobDescription);
  const enoughWords = totalWords >= 700;
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
          {/* ATS Tip */}
          <div style={{ backgroundColor: '#EAF4EA', borderLeft: '4px solid #27AE60', padding: '10px 14px', fontSize: '13px', color: '#444444', borderRadius: '0 6px 6px 0', lineHeight: '1.6' }}>
            <p><strong>💡 For best results, paste a plain-text ATS-friendly resume.</strong></p>
            <p style={{ marginTop: '4px' }}>
              This tool works best when your resume does not contain tables, text boxes, columns, images, or graphics.
              Resumes built in those formats may lose structure when pasted as text.
              If your resume uses a template with tables or columns, copy and paste only the text content,
              reorganized as simple paragraphs and bullet points, before pasting here.
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

      {/* Word count nudge — only shown when both fields have text but total < 700 */}
      {resumeText.trim() && jobDescription.trim() && !enoughWords && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-card text-amber-700 text-sm text-center">
          Add more content to unlock — {totalWords} / 700 words minimum across both fields.
        </div>
      )}

      {/* ── Three action buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-4">

          {/* Left: Score My Resume */}
          <button
            onClick={handleMatchOnly}
            disabled={anyLoading || !bothFilled}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm"
            style={{ minWidth: '160px', maxWidth: '190px', textAlign: 'center' }}
            title="Analyze how well your resume matches the job description — no rewriting"
          >
            {loadingMode === 'match' ? (
              <span className="flex items-center gap-2"><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: '14px', height: '14px', borderWidth: '2px' }} /> Analyzing…</span>
            ) : (
              <span>📊 Score My Resume</span>
            )}
          </button>

          {/* Centre: Draft Cover Letter */}
          <button
            onClick={handleCoverLetter}
            disabled={anyLoading || !bothFilled}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm"
            style={{ minWidth: '160px', maxWidth: '190px', textAlign: 'center' }}
            title="Generate a tailored cover letter for this role — no resume rewriting"
          >
            {loadingMode === 'coverletter' ? (
              <span className="flex items-center gap-2"><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: '14px', height: '14px', borderWidth: '2px' }} /> Drafting…</span>
            ) : (
              <span>✉️ Draft Cover Letter</span>
            )}
          </button>

          {/* Right: Optimize Everything — primary CTA */}
          <button
            onClick={handleOptimize}
            disabled={anyLoading || !bothFilled}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-sm"
            style={{ minWidth: '160px', maxWidth: '190px', textAlign: 'center' }}
            title="Optimize your resume, run a match analysis, and draft a cover letter — all in one go"
          >
            {loadingMode === 'optimize' ? (
              <span className="flex items-center gap-2"><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Scanning resume…</span>
            ) : (
              <span>✨ Optimize Everything</span>
            )}
          </button>
        </div>

        {(resumeText || jobDescription) && !anyLoading && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
            Clear & reset
          </button>
        )}
      </div>

      {/* Feature strip */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-gray-500">
        {[
          { icon: '🔍', text: 'Detects missing sections before optimising' },
          { icon: '✍️', text: 'Rewrites every bullet using what/how/so-what' },
          { icon: '📊', text: 'Scores every JD requirement individually' },
        ].map(f => (
          <div key={f.text} className="flex flex-col items-center gap-1 p-4 rounded-card bg-white shadow-card">
            <span className="text-2xl">{f.icon}</span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
