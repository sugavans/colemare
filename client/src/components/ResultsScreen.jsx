import React from 'react';
import { useState } from 'react';
import Footer from './Footer';

// ─── Score Banner ─────────────────────────────────────────────────────────────
function ScoreBanner({ analysis, companyName, jobTitle, sectionsWereAdded, scanData }) {
  const score      = analysis?.overallScore || 0;
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg    = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const found      = scanData?.sectionsFound?.length  || 0;
  const partial    = scanData?.sectionsPartial?.length || 0;
  const sectionBannerColor = sectionsWereAdded
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-green-50 border-green-200 text-green-700';

  return (
    <div className={`card border ${scoreBg} mb-6`}>
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">JD Match Score</p>
          <p className={`font-display text-5xl font-bold ${scoreColor}`}>{score}%</p>
          <p className="text-xs text-gray-400 mt-1">{analysis?.requirementsAnalysed || 0} requirements analysed</p>
        </div>
        {analysis?.strengths && analysis.strengths.length > 0 && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Strengths</p>
            <div className="flex flex-wrap gap-2">
              {analysis.strengths.map((s, i) => (
                <span key={i} className="badge-green text-xs">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {(companyName && companyName !== 'Unknown_Company') && (
        <p className="text-xs text-gray-500 mt-3">
          Optimized for: <strong className="text-navy">{jobTitle}</strong> at <strong className="text-navy">{companyName}</strong>
        </p>
      )}
      {scanData && (
        <div className={`mt-3 px-3 py-2 rounded-lg border text-xs font-medium ${sectionBannerColor}`}>
          {found} sections found
          {partial > 0 && ` · ${partial} partial`}
          {sectionsWereAdded ? ' · sections added by you' : ' · all present in original resume ✓'}
        </div>
      )}
    </div>
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────
function SectionDivider({ title }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#1F3864' }}>{title}</h2>
      <hr style={{ borderColor: '#1F3864', marginTop: '4px' }} />
    </div>
  );
}

// ─── Optimized Resume Tab ─────────────────────────────────────────────────────
function ResumeTab({ headers, experience }) {
  // Group similarityNotes by company for easy lookup
  const allNotes = (experience || []).flatMap(job => (job.similarityNotes || []).map(n => ({ company: job.company, note: n })));

  return (
    <div>
      {/* Similarity warnings */}
      {allNotes.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠ Bullet Similarity Notices</h3>
          {allNotes.map((n, i) => (
            <div key={i} className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-card text-sm text-amber-800">
              <strong>{n.company}:</strong> {n.note}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-card shadow-card p-8 max-w-3xl mx-auto" style={{ fontFamily: 'Georgia, serif' }}>
        {/* Title */}
        <h1 className="text-center font-bold text-2xl mb-2" style={{ color: '#1F3864', fontFamily: '"Playfair Display", Georgia, serif' }}>
          {headers?.optimisedTitle || 'Professional'}
        </h1>

        {headers?.contact && (
          <p className="text-center text-sm text-gray-600 mb-6" style={{ lineHeight: 1.6 }}>{headers.contact}</p>
        )}

        {headers?.summary && (
          <section className="mb-6">
            <SectionDivider title="Professional Summary" />
            <p className="text-sm text-gray-700" style={{ lineHeight: 1.7 }}>{headers.summary}</p>
          </section>
        )}

        {headers?.skills && headers.skills.length > 0 && (
          <section className="mb-6">
            <SectionDivider title="Skills / Core Competencies" />
            <p className="text-sm text-gray-700">{headers.skills.join(' | ')}</p>
          </section>
        )}

        {headers?.tools && headers.tools.length > 0 && (
          <section className="mb-6">
            <SectionDivider title="Tools & Technologies" />
            <p className="text-sm text-gray-700">{headers.tools.join(' | ')}</p>
          </section>
        )}

        {experience && experience.length > 0 && (
          <section className="mb-6">
            <SectionDivider title="Work Experience" />
            <div className="space-y-6">
              {experience.map((job, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between flex-wrap gap-1">
                    <h3 className="font-bold text-sm" style={{ color: '#1F3864' }}>{job.company}</h3>
                    <span className="text-xs text-gray-500">{job.startDate} – {job.endDate}</span>
                  </div>
                  {job.companyDescription && (
                    <p className="text-xs text-gray-500 italic mt-0.5">{job.companyDescription}</p>
                  )}
                  <p className="text-sm font-semibold italic mt-1" style={{ color: '#2E5DA6' }}>{job.roleTitle}</p>
                  {job.roleSummary && <p className="text-xs text-gray-600 mt-1">{job.roleSummary}</p>}
                  {job.bullets && job.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1.5 list-none">
                      {job.bullets.map((b, j) => (
                        <li key={j} className="text-sm text-gray-700 flex items-start gap-2" style={{ lineHeight: 1.6 }}>
                          <span className="text-navy mt-0.5 shrink-0">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {headers?.additionalSections && Object.entries(headers.additionalSections).map(([name, content]) =>
          content ? (
            <section key={name} className="mb-6">
              <SectionDivider title={name} />
              <p className="text-sm text-gray-700" style={{ lineHeight: 1.7 }}>{content}</p>
            </section>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─── Match Analysis Tab ───────────────────────────────────────────────────────
function AnalysisTab({ analysis, sectionsWereAdded }) {
  const requirements = analysis?.requirements || [];
  const gaps         = analysis?.gaps         || [];

  const statusColor = s => s === 'STRONG' ? 'text-green-600' : s === 'PARTIAL' ? 'text-amber-600' : 'text-red-600';
  const statusBg    = s => s === 'STRONG' ? 'bg-green-50 border-green-200' : s === 'PARTIAL' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const barColor    = s => s === 'STRONG' ? 'bg-green-500' : s === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500';
  const gapBorder   = p => p === 'HIGH' ? 'border-red-500' : p === 'MEDIUM' ? 'border-amber-500' : 'border-gray-400';
  const gapBadge    = p => p === 'HIGH' ? 'badge-red'  : p === 'MEDIUM' ? 'badge-amber' : 'badge-grey';

  return (
    <div className="space-y-6">
      {sectionsWereAdded && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-700 fade-in">
          <strong>Note:</strong> Some sections were missing from your original resume. Match scores reflect the resume after your additions.
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">Requirements Analysis</h3>
        <div className="space-y-3">
          {requirements.map((req, i) => (
            <div key={i} className={`p-4 rounded-card border ${statusBg(req.status)}`}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{req.name}</p>
                  {req.description && <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  {/* Change 3: 0% + GAP status → show "0% MATCH" not "0% GAP" */}
                  <p className={`text-lg font-bold ${statusColor(req.status)}`}>{req.score}%</p>
                  <span className={`text-xs font-bold ${statusColor(req.status)}`}>
                    {req.status === 'GAP' && req.score === 0 ? 'NO MATCH' : req.status}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1 mb-2">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${barColor(req.status)}`}
                  style={{ width: `${req.score}%` }}
                />
              </div>
              {req.coveredBy && req.coveredBy !== 'Not covered' && (
                <p className="text-xs text-gray-600"><strong>Covered by:</strong> {req.coveredBy}</p>
              )}
              {req.suggestion && req.suggestion !== 'Well covered — no action needed' && (
                <p className="text-xs text-gray-500 mt-1 italic">💡 {req.suggestion}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {gaps.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">Skill Gaps & Recommendations</h3>
          <div className="space-y-3">
            {gaps.map((gap, i) => (
              <div key={i} className={`p-4 rounded-card border border-l-4 bg-white ${gapBorder(gap.priority)}`} style={{ borderLeftWidth: '4px' }}>
                <div className="flex items-start gap-3">
                  <span className={`${gapBadge(gap.priority)} shrink-0`}>{gap.priority}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{gap.description}</p>
                    {gap.suggestion && <p className="text-xs text-gray-500 mt-1">💡 {gap.suggestion}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cover Letter Tab ─────────────────────────────────────────────────────────
function CoverLetterTab({ coverLetter, onDownload, exportData }) {
  if (!coverLetter) return null;
  return (
    <div>
      <div className="bg-white rounded-card shadow-card p-8 max-w-3xl mx-auto mb-4" style={{ fontFamily: 'Georgia, serif', lineHeight: 1.8, fontSize: '14px', color: '#333' }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
          {coverLetter}
        </pre>
      </div>
      <div className="flex justify-center">
        {(exportData?.coverLetterData || exportData?.coverLetterUrl) ? (
          <button
            onClick={() => onDownload(exportData.coverLetterData || exportData.coverLetterUrl, exportData.coverLetterFileName)}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
          >
            ⬇ Download Cover Letter (.docx)
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            Generating Word document…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Download Bar ─────────────────────────────────────────────────────────────
function DownloadBar({ exportData, onDownload }) {
  if (!exportData) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
        Generating Word documents…
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {(exportData.resumeData || exportData.resumeUrl) && (
        <button onClick={() => onDownload(exportData.resumeData || exportData.resumeUrl, exportData.resumeFileName)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          ⬇ Download Resume (.docx)
        </button>
      )}
      {(exportData.analysisData || exportData.analysisUrl) && (
        <button onClick={() => onDownload(exportData.analysisData || exportData.analysisUrl, exportData.analysisFileName)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          ⬇ Download Analysis (.docx)
        </button>
      )}
      {(exportData.coverLetterData || exportData.coverLetterUrl) && (
        <button onClick={() => onDownload(exportData.coverLetterData || exportData.coverLetterUrl, exportData.coverLetterFileName)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          ⬇ Download Cover Letter (.docx)
        </button>
      )}

    </div>
  );
}

// ─── Main Results Screen ──────────────────────────────────────────────────────
export default function ResultsScreen({ results, exportData, scanData, onReset, onGoBack, onOptimize, mode = 'optimize' }) {
  const { headers, experience, analysis, companyName, jobTitle, sectionsWereAdded, coverLetter } = results;

  // Default tab per mode
  const defaultTab = mode === 'match' ? 'analysis' : mode === 'coverletter' ? 'coverletter' : 'resume';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Accepts either a base64 string (production) or a URL (local dev fallback)
  const handleDownload = (dataOrUrl, filename) => {
    const a = document.createElement('a');
    if (dataOrUrl.startsWith('http') || dataOrUrl.startsWith('/')) {
      // Legacy URL path (local dev)
      a.href = dataOrUrl;
    } else {
      // Base64 buffer from production API
      const bytes = Uint8Array.from(atob(dataOrUrl), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      a.href = URL.createObjectURL(blob);
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke object URL after download to free memory
    if (a.href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  // Build tab list — Resume tab only for optimize mode
  const tabs = [];
  if (mode === 'optimize') tabs.push({ id: 'resume',      label: '📄 Optimized Resume' });
  if (analysis)            tabs.push({ id: 'analysis',    label: '📊 Match Analysis' });
  if (coverLetter)         tabs.push({ id: 'coverletter', label: '✉️ Cover Letter' });

  // Action bar config for match / coverletter modes
  const actionBar = mode === 'match' ? {
    optimizeLabel: "✨ Optimize Everything",
  } : mode === 'coverletter' ? {
    optimizeLabel: "✨ Optimize Everything",
  } : null;

  return (
    <div className="px-4 py-8 md:px-8 max-w-4xl mx-auto">

      {/* ── Top action bar — all modes ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {actionBar && (
          <>
            <button onClick={onGoBack} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
              ← Back to Inputs
            </button>
            <button onClick={onOptimize} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
              {actionBar.optimizeLabel}
            </button>
          </>
        )}
        <button onClick={onReset} className="btn-ghost text-gray-500 text-sm py-2 px-4">
          🔄 Start Over
        </button>
      </div>

      {/* Score banner — shown for optimize and match modes */}
      {analysis && (
        <ScoreBanner
          analysis={analysis}
          companyName={companyName}
          jobTitle={jobTitle}
          sectionsWereAdded={sectionsWereAdded}
          scanData={scanData}
        />
      )}

      {/* Cover letter header (cover letter only mode) */}
      {mode === 'coverletter' && !analysis && (
        <div className="card mb-6 flex items-center gap-4">
          <span className="text-3xl">✉️</span>
          <div>
            <h2 className="font-display text-xl text-navy font-bold">Cover Letter</h2>
            {companyName && companyName !== 'Unknown_Company' && (
              <p className="text-sm text-gray-500">{jobTitle} at {companyName}</p>
            )}
          </div>
        </div>
      )}

      {/* Download bar — only for optimize mode */}
      {mode === 'optimize' && (
        <div className="card mb-6">
          <DownloadBar exportData={exportData} onDownload={handleDownload} />
        </div>
      )}

      {/* Match-only download */}
      {mode === 'match' && exportData?.analysisUrl && (
        <div className="card mb-6">
          <button onClick={() => handleDownload(exportData.analysisData || exportData.analysisUrl, exportData.analysisFileName)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            ⬇ Download Analysis (.docx)
          </button>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.id ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="fade-in">
        {activeTab === 'resume'      && <ResumeTab headers={headers} experience={experience} />}
        {activeTab === 'analysis'    && <AnalysisTab analysis={analysis} sectionsWereAdded={sectionsWereAdded} />}
        {activeTab === 'coverletter' && <CoverLetterTab coverLetter={coverLetter} onDownload={handleDownload} exportData={exportData} />}
      </div>



      <Footer />
    </div>
  );
}
