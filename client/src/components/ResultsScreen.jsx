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
    <div className="mt-6 mb-3">
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
        {/* Header: Name → contact line → job title */}
        {(() => {
          const contactRaw   = Array.isArray(headers?.contact) ? headers.contact.join('') : String(headers?.contact || '');
          const parts        = contactRaw.split('|').map(p => p.trim()).filter(Boolean);
          const candidateName = parts[0] || '';
          const linkedInPart  = parts.find(p => p.toLowerCase().includes('linkedin.com')) || '';
          const otherParts    = parts.filter(p => p !== candidateName && p !== linkedInPart);
          const linkedInHref  = linkedInPart ? (linkedInPart.startsWith('http') ? linkedInPart : `https://${linkedInPart}`) : '';
          return (
            <>
              {candidateName && (
                <h1 className="text-center font-bold mb-1" style={{ color: '#1F3864', fontFamily: '"Playfair Display", Georgia, serif', fontSize: '2rem' }}>
                  {candidateName}
                </h1>
              )}
              {(otherParts.length > 0 || linkedInPart) && (
                <p className="text-center text-sm text-gray-500 mb-2" style={{ lineHeight: 1.6 }}>
                  {otherParts.join(' | ')}
                  {otherParts.length > 0 && linkedInPart && ' | '}
                  {linkedInPart && (
                    <a href={linkedInHref} target="_blank" rel="noopener noreferrer"
                       style={{ color: '#2E5DA6', textDecoration: 'underline' }}>
                      {linkedInPart}
                    </a>
                  )}
                </p>
              )}
              {headers?.optimisedTitle && (
                <h2 className="text-center font-bold mb-6" style={{ color: '#1F3864', fontSize: '1rem', letterSpacing: '0.01em' }}>
                  {headers.optimisedTitle}
                </h2>
              )}
            </>
          );
        })()}

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
                  {job.roleSummary && (
                    <p className="text-xs text-gray-500 italic mt-1 pl-2 border-l-2 border-navy border-opacity-30">{job.roleSummary}</p>
                  )}
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
// ─── Score & Analytics Tab ────────────────────────────────────────────────────
// Unified tab combining ATS Preview + Match Analysis with 4 sub-views.
// Disclaimer is shown prominently since ATS data is simulated.

function ScoreAnalyticsTab({ analysis, atsPreview, sectionsWereAdded }) {
  const [subTab, setSubTab] = React.useState('overview');

  const requirements  = analysis?.requirements   || [];
  const gaps          = analysis?.gaps           || [];
  const atsKeywords   = analysis?.atsKeywords    || null;
  const gapPlan       = analysis?.gapActionPlan  || [];
  const eligibility   = atsPreview?.eligibilityChecks  || [];
  const breakdown     = atsPreview?.scoringBreakdown   || [];

  const TEAL   = '#0E7490';
  const barColor = s => s >= 80 ? '#22C55E' : s >= 50 ? '#F59E0B' : '#EF4444';

  const dispBg    = atsPreview?.dispositionColor === 'green' ? '#F0FDF4'
                  : atsPreview?.dispositionColor === 'amber' ? '#FFFBEB' : '#FEF2F2';
  const dispColor = atsPreview?.dispositionColor === 'green' ? '#15803D'
                  : atsPreview?.dispositionColor === 'amber' ? '#B45309' : '#B91C1C';

  const resultStyle = r => ({
    pass:    { bg: 'bg-green-100', text: 'text-green-800', label: 'PASS'    },
    fail:    { bg: 'bg-red-100',   text: 'text-red-800',   label: 'FAIL'    },
    caution: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'CAUTION' },
  }[r] || { bg: 'bg-gray-100', text: 'text-gray-600', label: (r || '').toUpperCase() });

  const statusColor = s => s === 'STRONG' ? 'text-green-600' : s === 'PARTIAL' ? 'text-amber-600' : 'text-red-600';
  const statusBg    = s => s === 'STRONG' ? 'bg-green-50 border-green-200' : s === 'PARTIAL' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const barBg       = s => s === 'STRONG' ? 'bg-green-500' : s === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500';
  const gapBorder   = p => p === 'HIGH' ? 'border-red-500' : p === 'MEDIUM' ? 'border-amber-500' : 'border-gray-400';
  const gapBadge    = p => p === 'HIGH' ? 'badge-red' : p === 'MEDIUM' ? 'badge-amber' : 'badge-grey';

  const dispositionLabel = d => ({
    LEAD_WITH_CONFIDENCE:  { text: 'Lead with confidence', bg: 'bg-green-100 text-green-800' },
    REFRAME_TO_STRENGTHEN: { text: 'Reframe to strengthen', bg: 'bg-blue-100 text-blue-800' },
    HANDLE_CAREFULLY:      { text: 'Handle carefully', bg: 'bg-amber-100 text-amber-800' },
    OMIT:                  { text: 'Omit — prep interview', bg: 'bg-red-100 text-red-800' },
  }[d] || null);

  // Next step derivation from data we already have
  const highGaps = gaps.filter(g => g.priority === 'HIGH').length;
  const nextStep = highGaps > 0
    ? `Address ${highGaps} high-priority gap${highGaps > 1 ? 's' : ''} before submitting. See the Gaps tab for interview prep sentences.`
    : gapPlan.length > 0
    ? `Review the gap action plan — ${gapPlan.length} item${gapPlan.length > 1 ? 's' : ''} need preparation.`
    : 'Your resume is well-aligned. Review keywords to ensure ATS compatibility.';

  const subTabs = [
    { id: 'overview',    label: '📋 Overview' },
    { id: 'eligibility', label: '✅ Eligibility' },
    { id: 'gaps',        label: '⚠️ Gaps' },
    { id: 'keywords',    label: '🔑 Keywords' },
  ];

  return (
    <div className="space-y-4">

      {/* Disclaimer */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-card text-xs text-amber-700">
        ⚠️ <strong>Simulation notice:</strong> ATS scores and eligibility checks are AI-simulated for self-assessment only. They do not represent the output of any real employer ATS system. Actual screening results vary by employer, role, and ATS platform.
        {sectionsWereAdded && <span className="ml-2">· Match scores reflect the resume <strong>after your additions</strong>.</span>}
      </div>

      {/* Persistent header — scorecards + next step */}
      <div className="bg-white rounded-card shadow-card p-4 space-y-4">
        {atsPreview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ATS Score</p>
                <p className="text-2xl font-bold text-navy">{atsPreview.atsScore ?? '—'}<span className="text-sm text-gray-400 font-normal"> /100</span></p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Keyword Match</p>
                <p className="text-2xl font-bold text-navy">{atsPreview.keywordMatch ?? '—'}<span className="text-sm text-gray-400 font-normal">%</span></p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Hard Reqs Met</p>
                <p className="text-2xl font-bold text-navy">
                  {atsPreview.hardReqsMet?.met ?? '—'}<span className="text-sm text-gray-400 font-normal"> /{atsPreview.hardReqsMet?.total ?? '—'}</span>
                </p>
              </div>
              <div className="rounded-lg p-3 border" style={{ backgroundColor: dispBg }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: dispColor }}>Disposition</p>
                <p className="text-sm font-bold leading-tight" style={{ color: dispColor }}>{atsPreview.disposition ?? '—'}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">ATS scoring not available for this run.</p>
        )}
        {/* Next step callout */}
        <div className="flex gap-3 items-start bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg p-3">
          <span className="text-base flex-shrink-0 mt-0.5">🎯</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Your next step</p>
            <p className="text-xs text-gray-700 leading-relaxed">{nextStep}</p>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 p-1 bg-white rounded-card shadow-card">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${ subTab === t.id ? 'text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50' }`}
            style={subTab === t.id ? { backgroundColor: TEAL } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview sub-tab ── */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {breakdown.length > 0 && (
            <div className="bg-white rounded-card shadow-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: TEAL }}>Scoring Breakdown</h3>
              <div className="space-y-3">
                {breakdown.map((dim, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">{dim.dimension}</span>
                      <span className="text-xs font-bold" style={{ color: barColor(dim.score) }}>{dim.score}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${dim.score}%`, backgroundColor: barColor(dim.score) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {requirements.length > 0 && (
            <div className="bg-white rounded-card shadow-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: TEAL }}>Requirements Summary</h3>
              <div className="space-y-1">
                {['STRONG','PARTIAL','GAP'].map(status => {
                  const reqs = requirements.filter(r => r.status === status);
                  if (!reqs.length) return null;
                  const colors = { STRONG: '#15803D', PARTIAL: '#B45309', GAP: '#B91C1C' };
                  const bgs    = { STRONG: '#F0FDF4', PARTIAL: '#FFFBEB', GAP: '#FEF2F2'  };
                  return (
                    <div key={status} className="mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: colors[status] }}>
                        {status === 'STRONG' ? 'Strong' : status === 'PARTIAL' ? 'Partial' : 'Gaps'}
                      </p>
                      {reqs.map((r, i) => (
                        <div key={i} className="flex justify-between items-center px-2 py-1 rounded mb-1" style={{ backgroundColor: bgs[status] }}>
                          <span className="text-xs text-gray-700">{r.name}</span>
                          <span className="text-xs font-bold" style={{ color: colors[status] }}>{r.score}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Eligibility sub-tab ── */}
      {subTab === 'eligibility' && (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEAL }}>Eligibility Checks</h3>
            {eligibility.length > 0 && (
              <span className="text-xs text-gray-400">{eligibility.filter(c => c.result === 'pass').length} of {eligibility.length} passed</span>
            )}
          </div>
          {eligibility.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {eligibility.map((chk, i) => {
                const s = resultStyle(chk.result);
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${chk.result === 'pass' ? 'bg-green-500' : chk.result === 'fail' ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <span className="text-sm text-gray-700 truncate">{chk.requirement}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 text-right max-w-32 truncate">{chk.evidence}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-4 text-sm text-gray-400 italic">Eligibility data not available for this run.</p>
          )}
        </div>
      )}

      {/* ── Gaps sub-tab ── */}
      {subTab === 'gaps' && (
        <div className="space-y-4">
          {gapPlan.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: TEAL }}>Gap Action Plan</h3>
              <div className="space-y-3">
                {gapPlan.map((item, i) => (
                  <div key={i} className="p-4 rounded-card border border-l-4 border-amber-400 bg-amber-50">
                    <p className="text-sm font-semibold text-gray-800 mb-1">{item.item}</p>
                    {item.disposition && dispositionLabel(item.disposition) && (
                      <span className={`inline-block mb-2 px-2 py-0.5 rounded text-xs font-medium ${dispositionLabel(item.disposition).bg}`}>
                        {dispositionLabel(item.disposition).text}
                      </span>
                    )}
                    {item.interviewPrep && (
                      <p className="text-xs text-gray-600 italic">🎤 Interview prep: {item.interviewPrep}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: TEAL }}>Skill Gaps & Recommendations</h3>
              <div className="space-y-3">
                {gaps.map((gap, i) => (
                  <div key={i} className={`p-4 rounded-card border border-l-4 bg-white ${gapBorder(gap.priority)}`}>
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
          {gapPlan.length === 0 && gaps.length === 0 && (
            <p className="text-sm text-gray-400 italic p-4 bg-white rounded-card shadow-card">No significant gaps identified.</p>
          )}
        </div>
      )}

      {/* ── Keywords sub-tab ── */}
      {subTab === 'keywords' && (
        <div className="space-y-3">
          {atsKeywords && (atsKeywords.present?.length > 0 || atsKeywords.missing?.length > 0) ? (
            <div className="bg-white rounded-card shadow-card p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: TEAL }}>ATS Keyword Audit</h3>
              {atsKeywords.present?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-green-700 mb-2 uppercase tracking-wide">✅ Present in resume ({atsKeywords.present.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsKeywords.present.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-green-50 border border-green-200 rounded text-xs text-green-800">{kw}</span>)}
                  </div>
                </div>
              )}
              {atsKeywords.missing?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">❌ Missing from resume ({atsKeywords.missing.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsKeywords.missing.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-800">{kw}</span>)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic p-4 bg-white rounded-card shadow-card">Keyword audit not available for this run.</p>
          )}
          {requirements.length > 0 && (
            <div className="bg-white rounded-card shadow-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: TEAL }}>Requirements Analysis</h3>
              <div className="space-y-2">
                {requirements.map((req, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${statusBg(req.status)}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-gray-800">{req.name}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-sm font-bold ${statusColor(req.status)}`}>{req.score}%</span>
                        <span className={`text-xs font-bold ${statusColor(req.status)}`}>{req.status}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1 mb-1">
                      <div className={`h-1 rounded-full ${barBg(req.status)}`} style={{ width: `${req.score}%` }} />
                    </div>
                    {req.coveredBy && req.coveredBy !== 'Not covered' && (
                      <p className="text-xs text-gray-500">Covered by: {req.coveredBy}</p>
                    )}
                    {req.disposition && dispositionLabel(req.disposition) && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${dispositionLabel(req.disposition).bg}`}>
                        {dispositionLabel(req.disposition).text}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cover Letter Tab ─────────────────────────────────────────────────────────
function parseCoverLetterLine(line, i) {
  const trimmed = line.trim().replace(/—/g, ',').replace(/–/g, '-');
  const boldBullet = trimmed.match(/^-\s+\*\*(.+?)\*\*(.*)$/);
  const plainBullet = !boldBullet && trimmed.match(/^-\s+(.+)$/);
  if (boldBullet) {
    return (
      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <span style={{ flexShrink: 0 }}>•</span>
        <span><strong>{boldBullet[1]}</strong>{boldBullet[2]}</span>
      </div>
    );
  }
  if (plainBullet) {
    return (
      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <span style={{ flexShrink: 0 }}>•</span>
        <span>{plainBullet[1]}</span>
      </div>
    );
  }
  return trimmed === ''
    ? <div key={i} style={{ marginBottom: '8px' }} />
    : <p key={i} style={{ marginBottom: '8px' }}>{trimmed}</p>;
}

function CoverLetterTab({ coverLetter, onDownload, exportData }) {
  if (!coverLetter) return null;
  return (
    <div>
      <div className="bg-white rounded-card shadow-card p-8 max-w-3xl mx-auto mb-4" style={{ fontFamily: 'Georgia, serif', lineHeight: 1.8, fontSize: '14px', color: '#333' }}>
        {coverLetter.split('\n').map((line, i) => parseCoverLetterLine(line, i))}
      </div>
      <div className="flex justify-center">
        {(exportData?.coverLetterData || exportData?.coverLetterUrl) ? (
          <button
            onClick={() => onDownload(exportData.coverLetterData || exportData.coverLetterUrl, exportData.coverLetterFileName, 'coverletter')}
            className="btn-cl flex items-center gap-2 text-sm py-2 px-4"
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
    <div className="flex items-center justify-between flex-wrap gap-3 p-4"
      style={{ borderLeft: '4px solid #0E7490' }}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#0E7490' }}>Your outputs are ready</p>
        <p className="text-xs text-gray-400">Download any document as a formatted Word file (.docx)</p>
      </div>
      <div className="flex gap-2 p-1 bg-gray-50 border border-gray-200 rounded-lg flex-wrap">
        {(exportData.analysisData || exportData.analysisUrl) && (
          <button onClick={() => onDownload(exportData.analysisData || exportData.analysisUrl, exportData.analysisFileName, 'analysis')}
            className="btn-match flex items-center gap-2 text-sm py-2 px-4" title="Download Score & Analytics (.docx)">
            ⬇ Score & Analytics
          </button>
        )}
        {(exportData.resumeData || exportData.resumeUrl) && (
          <button onClick={() => onDownload(exportData.resumeData || exportData.resumeUrl, exportData.resumeFileName, 'resume')}
            className="btn-opt flex items-center gap-2 text-sm py-2 px-4" title="Download Optimized Resume (.docx)">
            ⬇ Resume
          </button>
        )}
        {(exportData.coverLetterData || exportData.coverLetterUrl) && (
          <button onClick={() => onDownload(exportData.coverLetterData || exportData.coverLetterUrl, exportData.coverLetterFileName, 'coverletter')}
            className="btn-cl flex items-center gap-2 text-sm py-2 px-4" title="Download Cover Letter (.docx)">
            ⬇ Cover Letter
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Results Screen ──────────────────────────────────────────────────────
export default function ResultsScreen({ results, exportData, scanData, onReset, onGoBack, onOptimize, mode = 'optimize' }) {
  const { headers, experience, analysis, companyName, jobTitle, sectionsWereAdded, coverLetter } = results;

  const atsPreview = results?.atsPreview || null;

  // Score & Analytics first for optimize+match, cover letter for coverletter mode
  const defaultTab = mode === 'coverletter' ? 'coverletter' : 'scoreanalytics';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Accepts either a base64 string (production) or a URL (local dev fallback)
  const handleDownload = (dataOrUrl, filename, documentType) => {
    if (!dataOrUrl) return;
    window.posthog?.capture('download_clicked', { documentType });
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

  // Tabs: Score & Analytics first, then Resume (optimize only), then Cover Letter
  const tabs = [];
  if (analysis || atsPreview)  tabs.push({ id: 'scoreanalytics', label: '📊 Score & Analytics', color: '#0E7490' });
  if (mode === 'optimize')     tabs.push({ id: 'resume',         label: '📄 Optimized Resume',  color: '#1F3864' });
  if (coverLetter)             tabs.push({ id: 'coverletter',    label: '✉️ Cover Letter',       color: '#6D28D9' });

  // Per-tab color
  const tabColor = (id) => ({ scoreanalytics: '#0E7490', resume: '#1F3864', coverletter: '#6D28D9' }[id] || '#1F3864');

  const modeColors = {
    match:       { primary: '#0E7490' },
    coverletter: { primary: '#6D28D9' },
    optimize:    { primary: '#1F3864' },
  };
  const mc = modeColors[mode] || modeColors.optimize;

  // Job context bar
  const jobLocation        = scanData?.jobLocation || 'Not available';
  const workType           = scanData?.workType    || 'Not available';
  const workBadge          = { Remote: { bg: '#DCFCE7', color: '#15803D' }, Hybrid: { bg: '#DBEAFE', color: '#1D4ED8' }, 'On-site': { bg: '#FEF9C3', color: '#A16207' } }[workType] || { bg: '#F3F4F6', color: '#6B7280' };
  const candidateName      = (headers?.contact || '').split('|')[0].trim() || '';

  // Action bar config for match / coverletter modes
  const actionBar = mode === 'match' ? {
    optimizeLabel: "✨ Optimize Everything",
  } : mode === 'coverletter' ? {
    optimizeLabel: "✨ Optimize Everything",
  } : null;

  return (
    <div className="px-4 py-8 md:px-8 max-w-4xl mx-auto">

      {/* ── Start Over — top right ─────────────────────────────────────────── */}
      <div className="flex justify-end mb-3">
        <button onClick={onReset} className="btn-ghost text-gray-400 text-sm py-1.5 px-3 flex items-center gap-1">
          ↩ Start Over
        </button>
      </div>

      {/* Score banner */}
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
        <div className="card mb-4 flex items-center gap-4">
          <span className="text-3xl">✉️</span>
          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: '#6D28D9' }}>Cover Letter</h2>
            {companyName && companyName !== 'Unknown_Company' && (
              <p className="text-sm text-gray-500">{jobTitle} at {companyName}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Persistent Job Context Bar ─────────────────────────────────────── */}
      <div className="rounded-card mb-4 px-5 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{ background: '#1F3864' }}>
        <div className="flex items-center gap-4 flex-wrap">
          {jobTitle && jobTitle !== 'Unknown_Role' && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>Role</div>
              <div className="text-sm font-semibold text-white">{jobTitle}</div>
            </div>
          )}
          {companyName && companyName !== 'Unknown_Company' && (
            <>
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,.2)' }} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>Company</div>
                <div className="text-sm font-semibold text-white">{companyName}</div>
              </div>
            </>
          )}
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,.2)' }} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>Location</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
              {jobLocation}
              {workType !== 'Not available' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: workBadge.bg, color: workBadge.color }}>
                  {workType}
                </span>
              )}
            </div>
          </div>
          {candidateName && (
            <>
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,.2)' }} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>Candidate</div>
                <div className="text-sm font-semibold text-white flex items-center gap-1">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                  {candidateName}
                </div>
              </div>
            </>
          )}
        </div>
        {analysis && (
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: analysis.overallScore >= 80 ? '#22C55E' : analysis.overallScore >= 60 ? '#F59E0B' : '#EF4444', color: '#fff' }}>
            {analysis.overallScore}% Match
          </span>
        )}
      </div>

      {/* ── Download bar (optimize + match) ───────────────────────────────── */}
      {(mode === 'optimize' || mode === 'match') && (
        <div className="card mb-4">
          <DownloadBar exportData={exportData} onDownload={handleDownload} />
        </div>
      )}

      {/* Back to Inputs + Upgrade CTA (match/coverletter modes) */}
      {actionBar && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={onGoBack} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            ← Back to Inputs
          </button>
          <button onClick={onOptimize} className="btn-opt flex items-center gap-2 text-sm py-2 px-4">
            {actionBar.optimizeLabel}
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); window.posthog?.capture('tab_switched', { tabName: tab.id }); }}
              className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px"
              style={activeTab === tab.id
                ? { borderBottomColor: tab.color, color: tab.color, background: `${tab.color}0a`, borderRadius: '6px 6px 0 0' }
                : { borderBottomColor: 'transparent', color: '#9CA3AF' }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tab.color, display: 'inline-block', opacity: activeTab === tab.id ? 1 : 0.4 }} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="fade-in">
        {activeTab === 'scoreanalytics' && (
          <ScoreAnalyticsTab
            analysis={analysis}
            atsPreview={atsPreview}
            sectionsWereAdded={sectionsWereAdded}
          />
        )}
        {activeTab === 'resume'         && <ResumeTab headers={headers} experience={experience} />}
        {activeTab === 'coverletter'    && <CoverLetterTab coverLetter={coverLetter} onDownload={handleDownload} exportData={exportData} />}
      </div>

      <Footer />
    </div>
  );
}
