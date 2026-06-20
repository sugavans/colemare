import React from 'react';
import { useState, useCallback } from 'react';
import InputScreen from './components/InputScreen';
import SectionReviewScreen from './components/SectionReviewScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';

const SCREEN = {
  INPUT:          'input',
  SECTION_REVIEW: 'section_review',
  PROCESSING:     'processing',
  RESULTS:        'results',
};

const INITIAL_STEPS = {
  optimize:    { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending', 7: 'pending' },
  match:       { 1: 'pending', 2: 'pending', 3: 'pending' },
  coverletter: { 1: 'pending', 2: 'pending', 3: 'pending' },
};

// In production (Vercel), VITE_API_URL points to the Railway backend.
// In local dev, it's empty and Vite's proxy handles /api → localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL || '';

/** Stream SSE from a POST endpoint, calling onEvent for each parsed event. */
async function readSSE(url, body, onEvent) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Server responded with ${response.status}`);

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try { await onEvent(JSON.parse(line.slice(6))); } catch { /* skip malformed */ }
    }
  }
}

export default function App() {
  const [screen,           setScreen]           = useState(SCREEN.INPUT);
  const [appMode,          setAppMode]           = useState('optimize');
  const [resumeText,       setResumeText]        = useState('');
  const [jobDescription,   setJobDescription]    = useState('');
  const [scanData,         setScanData]          = useState(null);
  const [sectionAdditions, setSectionAdditions]  = useState({});
  const [steps,            setSteps]             = useState(INITIAL_STEPS.optimize);
  const [results,          setResults]           = useState(null);
  const [exportData,       setExportData]        = useState(null);
  const [optimizeError,    setOptimizeError]     = useState(null);

  const setStep = useCallback((step, status) =>
    setSteps(prev => ({ ...prev, [step]: status })), []);

  // ─── Reset helpers ────────────────────────────────────────────────────────
  // clearText: also wipe resume/JD inputs (full Start Over).
  // Without it, inputs are preserved so the user can retry or go back.
  const resetState = useCallback(({ clearText = false } = {}) => {
    setResults(null);
    setExportData(null);
    setOptimizeError(null);
    setSteps(INITIAL_STEPS.optimize);
    setScreen(SCREEN.INPUT);
    if (clearText) {
      setResumeText('');
      setJobDescription('');
      setScanData(null);
      setSectionAdditions({});
      setAppMode('optimize');
    }
  }, []);

  const handleReset  = useCallback(() => resetState({ clearText: true }), [resetState]);
  const handleGoBack = useCallback(() => resetState(),                      [resetState]);
  const handleRetry  = useCallback(() => resetState(),                      [resetState]);

  // ─── Export helper ────────────────────────────────────────────────────────
  const runExport = useCallback(async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) setExportData(await res.json());
    } catch { /* non-blocking — results still shown even if export fails */ }
  }, []);

  const beginProcessing = useCallback((mode) => {
    setScreen(SCREEN.PROCESSING);
    setResults(null);
    setExportData(null);
    setOptimizeError(null);
    setSteps({ ...INITIAL_STEPS[mode] });
  }, []);

  // ─── Generic SSE runner — used by match + coverletter pipelines ───────────
  // `getExportPayload` maps the SSE result event → /api/export request body.
  const runSimplePipeline = useCallback(async (mode, url, body, getExportPayload) => {
    beginProcessing(mode);
    window.posthog?.capture('optimize_started', { mode });
    try {
      await readSSE(`${API_BASE}${url}`, body, async (event) => {
        if (event.type === 'step') {
          setStep(event.step, event.status);
        } else if (event.type === 'result') {
          await runExport(getExportPayload(event));
          window.posthog?.capture('optimize_completed', { mode, overallScore: event.analysis?.overallScore ?? null });
          setResults({ ...event, mode });
          setScreen(SCREEN.RESULTS);
        } else if (event.type === 'error') {
          setOptimizeError(event.message || 'An error occurred.');
        }
      });
    } catch (err) {
      setOptimizeError(err.message || 'Connection error. Please try again.');
    }
  }, [beginProcessing, runExport, setStep]);

  // ─── OPTIMIZE flow ────────────────────────────────────────────────────────
  const handleScan = useCallback(async ({ resumeText: rt, jobDescription: jd }) => {
    setResumeText(rt);
    setJobDescription(jd);
    setAppMode('optimize');
    setOptimizeError(null);
    setScanData(null);
    setSectionAdditions({});
    window.posthog?.capture('optimize_started', { mode: 'optimize' });

    try {
      const res  = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: rt, jobDescription: jd }),
      });
      const data = await res.json();
      setScanData({ ...data, _resumeText: rt });
      const isFunctional = data.resumeType === 'functional' || data.resumeType === 'hybrid';
      if (data.sectionsMissing?.length > 0 || isFunctional) {
        setScreen(SCREEN.SECTION_REVIEW);
      } else {
        startOptimization(rt, jd, data.companyName, data.jobTitle, {}, false, data.resumeType || 'chronological');
      }
    } catch {
      const fallback = {
        companyName: 'Unknown_Company', jobTitle: 'Unknown_Role',
        sectionsFound: [], sectionsPartial: [], sectionsMissing: [],
        fallback: true, _resumeText: rt,
      };
      setScanData(fallback);
      startOptimization(rt, jd, fallback.companyName, fallback.jobTitle, {}, false, 'chronological');
    }
  }, []);

  const handleSectionReviewComplete = useCallback((additions, opts = {}) => {
    const preserveJobOrder = opts.preserveJobOrder ?? false;
    setSectionAdditions(additions || {});
    startOptimization(
      resumeText, jobDescription,
      scanData?.companyName  || 'Unknown_Company',
      scanData?.jobTitle     || 'Unknown_Role',
      additions || {},
      preserveJobOrder,
      scanData?.resumeType   || 'chronological',
    );
  }, [resumeText, jobDescription, scanData]);

  const startOptimization = useCallback(async (rt, jd, companyName, jobTitle, additions, preserveJobOrder = false, resumeType = 'chronological') => {
    beginProcessing('optimize');
    // Steps 1 (scan) and 2 (section review) completed before SSE starts
    setSteps(prev => ({ ...prev, 1: 'complete', 2: 'complete' }));

    try {
      await readSSE(
        `${API_BASE}/api/optimize`,
        { resumeText: rt, jobDescription: jd, companyName, jobTitle, sectionAdditions: additions, preserveJobOrder, resumeType },
        async (event) => {
          if (event.type === 'step') {
            setStep(event.step, event.status);
          } else if (event.type === 'result') {
            await runExport({
              headers:           event.headers,
              experience:        event.experience,
              preservedSections: event.preservedSections,
              analysis:          event.analysis,
              atsPreview:        event.atsPreview,
              coverLetter:       event.coverLetter,
              companyName:       event.companyName,
              jobTitle:          event.jobTitle,
              sectionsWereAdded: event.sectionsWereAdded,
            });
            window.posthog?.capture('optimize_completed', { mode: 'optimize', overallScore: event.analysis?.overallScore ?? null });
            setResults({ ...event, mode: 'optimize' });
            setScreen(SCREEN.RESULTS);
          } else if (event.type === 'error') {
            setOptimizeError(event.message || 'An error occurred. Please try again.');
          }
        },
      );
    } catch (err) {
      setOptimizeError(err.message || 'Connection error. Please try again.');
    }
  }, []);

  // ─── MATCH ONLY flow ──────────────────────────────────────────────────────
  const handleMatchOnly = useCallback(({ resumeText: rt, jobDescription: jd }) => {
    setResumeText(rt);
    setJobDescription(jd);
    setAppMode('match');
    return runSimplePipeline(
      'match', '/api/match-only', { resumeText: rt, jobDescription: jd },
      event => ({ analysis: event.analysis, atsPreview: event.atsPreview, companyName: event.companyName, jobTitle: event.jobTitle, sectionsWereAdded: false }),
    );
  }, [runSimplePipeline]);

  // ─── COVER LETTER flow ────────────────────────────────────────────────────
  const handleCoverLetter = useCallback(({ resumeText: rt, jobDescription: jd }) => {
    setResumeText(rt);
    setJobDescription(jd);
    setAppMode('coverletter');
    return runSimplePipeline(
      'coverletter', '/api/cover-letter', { resumeText: rt, jobDescription: jd },
      event => ({ coverLetter: event.coverLetter, companyName: event.companyName, jobTitle: event.jobTitle }),
    );
  }, [runSimplePipeline]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-body">
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">Colemare</h1>
            <p className="text-blue-200 text-xs">AI-powered resume & cover letter</p>
          </div>
        </div>
        {screen !== SCREEN.INPUT && (
          <button onClick={handleReset} className="text-blue-200 hover:text-white text-sm font-medium transition-colors">
            ← New Resume
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto">
        {screen === SCREEN.INPUT && (
          <InputScreen
            initialResumeText={resumeText}
            initialJobDescription={jobDescription}
            onSubmit={handleScan}
            onMatchOnly={handleMatchOnly}
            onCoverLetter={handleCoverLetter}
          />
        )}
        {screen === SCREEN.SECTION_REVIEW && scanData && (
          <SectionReviewScreen scanData={scanData} onComplete={handleSectionReviewComplete} />
        )}
        {screen === SCREEN.PROCESSING && (
          <ProcessingScreen steps={steps} error={optimizeError} onRetry={handleRetry} mode={appMode} />
        )}
        {screen === SCREEN.RESULTS && results && (
          <ResultsScreen
            results={results}
            exportData={exportData}
            scanData={scanData}
            onReset={handleReset}
            onGoBack={handleGoBack}
            onOptimize={() => handleScan({ resumeText, jobDescription })}
            mode={results.mode || appMode}
          />
        )}
      </main>
    </div>
  );
}
